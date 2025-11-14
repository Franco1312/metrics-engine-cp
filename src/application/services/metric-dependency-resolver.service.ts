import { MetricRepository } from "@/domain/ports/metric.repository";
import { SeriesRepository } from "@/domain/ports/series.repository";
import { DatasetRepository } from "@/domain/ports/dataset.repository";
import { Metric } from "@/domain/entities/metric.entity";
import { Logger } from "@/domain/interfaces/logger.interface";
import { LOG_EVENTS } from "@/domain/constants/log-events";
import { TransactionClient } from "@/domain/interfaces/database-client.interface";
import { MetricDependencyExtractorService } from "@/domain/services/metric-dependency-extractor.service";
import { SeriesNotFoundError } from "@/domain/errors/series-not-found.error";

/**
 * Servicio de aplicación para resolver dependencias de métricas
 */
export class MetricDependencyResolverService {
  constructor(
    private readonly metricRepository: MetricRepository,
    private readonly seriesRepository: SeriesRepository,
    private readonly datasetRepository: DatasetRepository,
    private readonly logger: Logger,
  ) {}

  /**
   * Encuentra todas las métricas que dependen de series de un dataset
   *
   * @param datasetId - ID del dataset
   * @param client - Cliente de transacción opcional
   * @returns Array de métricas que dependen de este dataset
   */
  async findMetricsForDataset(
    datasetId: string,
    client?: TransactionClient,
  ): Promise<Metric[]> {
    const dataset = await this.datasetRepository.findById(datasetId, client);
    if (!dataset) {
      this.logger.info({
        event: LOG_EVENTS.ON_DEPENDENCY_PENDING,
        msg: "Dataset not found",
        data: { datasetId },
      });
      return [];
    }

    const allMetrics = await this.metricRepository.findAll(client);
    const dependentMetrics = await this.filterMetricsByDataset(
      allMetrics,
      datasetId,
      client,
    );

    this.logger.info({
      event: LOG_EVENTS.ON_DEPENDENCY_RESOLVED,
      msg: "Found metrics dependent on dataset",
      data: {
        datasetId,
        metricCount: dependentMetrics.length,
      },
    });

    return dependentMetrics;
  }

  /**
   * Filtra métricas que dependen del dataset especificado
   */
  private async filterMetricsByDataset(
    metrics: Metric[],
    datasetId: string,
    client?: TransactionClient,
  ): Promise<Metric[]> {
    const dependentMetrics: Metric[] = [];

    for (const metric of metrics) {
      const requiredDatasets = await this.resolveRequiredDatasets(
        metric.id,
        client,
      );

      if (requiredDatasets.includes(datasetId)) {
        dependentMetrics.push(metric);
      }
    }

    return dependentMetrics;
  }

  /**
   * Resuelve los IDs de datasets requeridos para una métrica
   *
   * @param metricId - ID de la métrica
   * @param client - Cliente de transacción opcional
   * @returns Array de IDs de datasets requeridos
   */
  async resolveRequiredDatasets(
    metricId: string,
    client?: TransactionClient,
  ): Promise<string[]> {
    const metric = await this.metricRepository.findById(metricId, client);
    if (!metric) {
      return [];
    }

    const seriesCodes =
      MetricDependencyExtractorService.extractSeriesCodes(metric);
    if (seriesCodes.length === 0) {
      return [];
    }

    await this.validateSeriesExist(seriesCodes, client);

    const datasets = await this.datasetRepository.findBySeriesCodes(
      seriesCodes,
      client,
    );
    const uniqueDatasetIds = this.extractUniqueDatasetIds(datasets);

    this.logger.info({
      event: LOG_EVENTS.ON_DEPENDENCY_RESOLVED,
      msg: "Resolved required datasets for metric",
      data: {
        metricId,
        metricCode: metric.code,
        seriesCodes,
        datasetIds: uniqueDatasetIds,
      },
    });

    return uniqueDatasetIds;
  }

  /**
   * Valida que todas las series existan
   */
  private async validateSeriesExist(
    seriesCodes: string[],
    client?: TransactionClient,
  ): Promise<void> {
    const series = await this.seriesRepository.findByCodes(seriesCodes, client);
    const foundSeriesCodes = new Set(series.map((s) => s.code));
    const missingSeries = seriesCodes.filter(
      (code) => !foundSeriesCodes.has(code),
    );

    if (missingSeries.length > 0) {
      throw new SeriesNotFoundError(
        `Series not found: ${missingSeries.join(", ")}`,
      );
    }
  }

  /**
   * Extrae IDs únicos de datasets
   */
  private extractUniqueDatasetIds(datasets: { id: string }[]): string[] {
    const datasetIds = datasets.map((d) => d.id);
    return Array.from(new Set(datasetIds));
  }
}
