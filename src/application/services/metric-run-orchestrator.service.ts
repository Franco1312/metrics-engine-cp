import { Metric } from "@/domain/entities/metric.entity";
import { DatasetUpdate } from "@/domain/entities/dataset-update.entity";
import { MetricRun } from "@/domain/entities/metric-run.entity";
import { MetricRunRepository } from "@/domain/ports/metric-run.repository";
import { MetricRepository } from "@/domain/ports/metric.repository";
import { PendingDatasetRepository } from "@/domain/ports/pending-dataset.repository";
import { DatasetUpdateRepository } from "@/domain/ports/dataset-update.repository";
import { SNSPublisher } from "@/domain/interfaces/sns-publisher.interface";
import { MetricRunRequestEvent } from "@/domain/dto/metric-run-request-event.dto";
import { METRIC_RUN_STATUS } from "@/domain/constants/metric-status";
import { Logger } from "@/domain/interfaces/logger.interface";
import { LOG_EVENTS } from "@/domain/constants/log-events";
import { TransactionClient } from "@/domain/interfaces/database-client.interface";
import { MetricDependencyExtractorService } from "@/domain/services/metric-dependency-extractor.service";
import { SeriesRepository } from "@/domain/ports/series.repository";
import { DatasetRepository } from "@/domain/ports/dataset.repository";

/**
 * Servicio de aplicación para orquestar la creación y emisión de runs
 */
export class MetricRunOrchestratorService {
  constructor(
    private readonly metricRunRepository: MetricRunRepository,
    private readonly metricRepository: MetricRepository,
    private readonly pendingDatasetRepository: PendingDatasetRepository,
    private readonly datasetUpdateRepository: DatasetUpdateRepository,
    private readonly seriesRepository: SeriesRepository,
    private readonly datasetRepository: DatasetRepository,
    private readonly snsPublisher: SNSPublisher,
    private readonly logger: Logger,
  ) {}

  /**
   * Crea un run para una métrica
   * Todos los runs se crean como pendientes, y si todas las dependencias ya están listas,
   * se emiten inmediatamente.
   *
   * @param metric - La métrica para la cual crear el run
   * @param currentDatasetId - ID del dataset que acaba de actualizarse
   * @param currentUpdate - La actualización actual
   * @param requiredDatasetIds - IDs de todos los datasets requeridos
   * @param client - Cliente de transacción opcional
   * @returns El run creado
   */
  async createRunForMetric(
    metric: Metric,
    currentDatasetId: string,
    currentUpdate: DatasetUpdate,
    requiredDatasetIds: string[],
    client?: TransactionClient,
  ): Promise<MetricRun> {
    const run = await this.createPendingRun(metric, client);
    await this.createPendingDatasets(
      run.id,
      currentDatasetId,
      currentUpdate,
      requiredDatasetIds,
      client,
    );

    const isReady = await this.isRunReady(run.id, client);
    if (isReady) {
      await this.emitPendingRun(run.id, client);
    }

    return run;
  }

  /**
   * Crea un run con estado PENDING_DEPENDENCIES
   */
  private async createPendingRun(
    metric: Metric,
    client?: TransactionClient,
  ): Promise<MetricRun> {
    const run = await this.metricRunRepository.create(
      {
        metricId: metric.id,
        metricCode: metric.code,
        status: METRIC_RUN_STATUS.PENDING_DEPENDENCIES,
      },
      client,
    );

    this.logger.info({
      event: LOG_EVENTS.ON_RUN_DISPATCHED,
      msg: "Created run for metric",
      data: {
        runId: run.id,
        metricCode: metric.code,
      },
    });

    return run;
  }

  /**
   * Crea los pending datasets para todos los datasets requeridos
   */
  private async createPendingDatasets(
    runId: string,
    currentDatasetId: string,
    currentUpdate: DatasetUpdate,
    requiredDatasetIds: string[],
    client?: TransactionClient,
  ): Promise<void> {
    for (const datasetId of requiredDatasetIds) {
      const isCurrentDataset = datasetId === currentDatasetId;
      await this.pendingDatasetRepository.create(
        {
          runId,
          datasetId,
          requiredDays: 7, // TODO: Esto debería venir de configuración de la métrica
          received: isCurrentDataset,
          receivedUpdateId: isCurrentDataset ? currentUpdate.id : undefined,
          receivedAt: isCurrentDataset ? currentUpdate.createdAt : undefined,
        },
        client,
      );
    }
  }

  /**
   * Verifica si un run está listo (todas las dependencias resueltas)
   */
  private async isRunReady(
    runId: string,
    client?: TransactionClient,
  ): Promise<boolean> {
    const pendingCount =
      await this.pendingDatasetRepository.countPendingByRunId(runId, client);
    return pendingCount === 0;
  }

  /**
   * Emite un run pendiente que está listo para ejecutarse
   *
   * @param runId - ID del run a emitir
   * @param client - Cliente de transacción opcional
   */
  async emitPendingRun(
    runId: string,
    client?: TransactionClient,
  ): Promise<void> {
    const run = await this.metricRunRepository.findById(runId, client);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    if (run.status !== METRIC_RUN_STATUS.PENDING_DEPENDENCIES) {
      throw new Error(
        `Run ${runId} is not in pending_dependencies status: ${run.status}`,
      );
    }

    // Obtener la métrica
    const metric = await this.metricRepository.findById(run.metricId, client);
    if (!metric) {
      throw new Error(`Metric not found: ${run.metricId}`);
    }

    // Obtener los datasets requeridos desde los pending datasets
    const pendingDatasets = await this.pendingDatasetRepository.findByRunId(
      runId,
      client,
    );

    const requiredDatasetIds = pendingDatasets.map((p) => p.datasetId);

    // Emitir el run
    await this.emitRun(run, metric, requiredDatasetIds, client);

    // Actualizar el estado del run a QUEUED
    await this.metricRunRepository.updateStatus(
      runId,
      METRIC_RUN_STATUS.QUEUED,
      client,
    );
  }

  /**
   * Emite un run (publica el evento SNS)
   */
  private async emitRun(
    run: MetricRun,
    metric: Metric,
    requiredDatasetIds: string[],
    client?: TransactionClient,
  ): Promise<void> {
    const datasetUpdates = await this.fetchLatestDatasetUpdates(
      requiredDatasetIds,
      client,
    );

    const datasetUpdateIds = datasetUpdates.map((update) => update.id);
    await this.metricRunRepository.linkDatasetUpdates(
      run.id,
      datasetUpdateIds,
      client,
    );

    const seriesCodes =
      MetricDependencyExtractorService.extractSeriesCodes(metric);
    const inputs = await this.buildRunInputs(
      seriesCodes,
      requiredDatasetIds,
      client,
    );
    const catalog = this.buildDatasetCatalog(datasetUpdates);
    const event = this.buildMetricRunRequestEvent(run, metric, inputs, catalog);

    await this.snsPublisher.publishMetricRunRequest(event);

    this.logger.info({
      event: LOG_EVENTS.ON_RUN_DISPATCHED,
      msg: "Metric run event published",
      data: {
        runId: run.id,
        metricCode: metric.code,
        datasetUpdatesCount: datasetUpdates.length,
      },
    });
  }

  /**
   * Obtiene las últimas actualizaciones de los datasets requeridos
   */
  private async fetchLatestDatasetUpdates(
    datasetIds: string[],
    client?: TransactionClient,
  ): Promise<DatasetUpdate[]> {
    const updates: DatasetUpdate[] = [];
    for (const datasetId of datasetIds) {
      const update = await this.datasetUpdateRepository.findLatestByDatasetId(
        datasetId,
        client,
      );
      if (update) {
        updates.push(update);
      }
    }
    return updates;
  }

  /**
   * Construye los inputs del run mapeando cada serie a su dataset correspondiente
   */
  private async buildRunInputs(
    seriesCodes: string[],
    requiredDatasetIds: string[],
    client?: TransactionClient,
  ): Promise<MetricRunRequestEvent["inputs"]> {
    const inputs: MetricRunRequestEvent["inputs"] = [];

    for (const seriesCode of seriesCodes) {
      const dataset = await this.findDatasetForSeries(
        seriesCode,
        requiredDatasetIds,
        client,
      );
      if (dataset) {
        inputs.push({
          datasetId: dataset.id,
          seriesCode,
        });
      }
    }

    return inputs;
  }

  /**
   * Encuentra el dataset que contiene una serie y está en la lista de requeridos
   */
  private async findDatasetForSeries(
    seriesCode: string,
    requiredDatasetIds: string[],
    client?: TransactionClient,
  ) {
    const datasets = await this.datasetRepository.findBySeriesCodes(
      [seriesCode],
      client,
    );
    return datasets.find((d) => requiredDatasetIds.includes(d.id));
  }

  /**
   * Construye el catálogo de datasets a partir de las actualizaciones
   */
  private buildDatasetCatalog(
    datasetUpdates: DatasetUpdate[],
  ): MetricRunRequestEvent["catalog"] {
    const catalog: MetricRunRequestEvent["catalog"] = {
      datasets: {},
    };

    for (const update of datasetUpdates) {
      catalog.datasets[update.datasetId] = {
        manifestPath: update.versionManifestPath,
        projectionsPath: update.projectionsPath,
      };
    }

    return catalog;
  }

  /**
   * Construye el evento de solicitud de run de métrica con todos los atributos necesarios
   */
  private buildMetricRunRequestEvent(
    run: MetricRun,
    metric: Metric,
    inputs: MetricRunRequestEvent["inputs"],
    catalog: MetricRunRequestEvent["catalog"],
  ): MetricRunRequestEvent {
    // Validar que la expresión no tenga operaciones window_op anidadas sin window
    this.validateWindowOpsInExpression(metric.expressionJson, metric.code);

    return {
      type: "metric_run_requested",
      runId: run.id,
      metricCode: metric.code,
      expressionType: metric.expressionType,
      expressionJson: metric.expressionJson,
      inputs,
      catalog,
      output: {
        basePath: `s3://bucket/metrics/${metric.code}/`,
      },
      messageGroupId: metric.code,
      messageDeduplicationId: run.id,
    };
  }

  /**
   * Valida que todas las operaciones window_op (lag, sma, etc.) en la expresión tengan window definido
   */
  private validateWindowOpsInExpression(
    expression: any,
    metricCode: string,
    path: string = "expressionJson",
  ): void {
    if (!expression || typeof expression !== "object") {
      return;
    }

    // Si tiene 'op' y 'series' y 'window', es una window_op
    if ("op" in expression && "series" in expression) {
      if (!("window" in expression) || expression.window == null) {
        throw new Error(
          `Metric ${metricCode}: window_op operation at '${path}' is missing 'window' field or it is null. ` +
            `All window operations (lag, sma, ema, etc.) must have a valid window value (integer >= 1).`,
        );
      }

      if (typeof expression.window !== "number" || expression.window < 1) {
        throw new Error(
          `Metric ${metricCode}: window_op operation at '${path}' has invalid window value: ${expression.window}. ` +
            `Window must be a positive integer >= 1.`,
        );
      }
    }

    // Validar recursivamente en operandos anidados
    if ("left" in expression) {
      this.validateWindowOpsInExpression(
        expression.left,
        metricCode,
        `${path}.left`,
      );
    }
    if ("right" in expression) {
      this.validateWindowOpsInExpression(
        expression.right,
        metricCode,
        `${path}.right`,
      );
    }
    if ("series" in expression && typeof expression.series === "object") {
      this.validateWindowOpsInExpression(
        expression.series,
        metricCode,
        `${path}.series`,
      );
    }
    if ("operands" in expression && Array.isArray(expression.operands)) {
      expression.operands.forEach((operand: any, index: number) => {
        this.validateWindowOpsInExpression(
          operand,
          metricCode,
          `${path}.operands[${index}]`,
        );
      });
    }
  }
}
