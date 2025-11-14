import { DatasetUpdate } from '@/domain/entities/dataset-update.entity';

/**
 * Servicio de dominio para validar ventanas de tiempo
 * Lógica de negocio pura sin dependencias externas
 */
export class TimeWindowValidatorService {
  /**
   * Valida si una actualización de dataset es válida para un run pendiente
   * basándose en la ventana de tiempo requerida.
   *
   * @param update - La actualización de dataset a validar
   * @param requiredDays - Número de días mínimos requeridos desde la creación del update
   * @param referenceDate - Fecha de referencia (por defecto: ahora)
   * @returns true si la actualización es válida, false en caso contrario
   */
  static isUpdateValid(
    update: DatasetUpdate,
    requiredDays: number,
    referenceDate: Date = new Date(),
  ): boolean {
    if (requiredDays <= 0) {
      return true; // Sin restricción de tiempo
    }

    const cutoffDate = new Date(referenceDate);
    cutoffDate.setDate(cutoffDate.getDate() - requiredDays);

    return update.createdAt >= cutoffDate;
  }

  /**
   * Calcula la fecha límite (cutoff) para una ventana de tiempo
   *
   * @param requiredDays - Número de días requeridos
   * @param referenceDate - Fecha de referencia (por defecto: ahora)
   * @returns La fecha límite
   */
  static calculateCutoffDate(
    requiredDays: number,
    referenceDate: Date = new Date(),
  ): Date {
    const cutoffDate = new Date(referenceDate);
    cutoffDate.setDate(cutoffDate.getDate() - requiredDays);
    return cutoffDate;
  }
}

