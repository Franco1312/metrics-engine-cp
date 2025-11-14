import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

/**
 * Interfaz común para ejecutar queries (usada por TransactionClient y DatabaseClient)
 */
export interface QueryClient {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
}

/**
 * Cliente de transacción que permite ejecutar queries dentro de una transacción
 */
export interface TransactionClient extends QueryClient {
  release(): void;
}

/**
 * Interfaz para el cliente de base de datos
 * Permite ejecutar queries y manejar transacciones
 */
export interface DatabaseClient {
  /**
   * Ejecuta una query simple
   */
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;

  /**
   * Inicia una transacción y ejecuta un callback
   * Si el callback lanza un error, la transacción se revierte automáticamente
   */
  transaction<T>(
    callback: (client: TransactionClient) => Promise<T>,
  ): Promise<T>;

  /**
   * Obtiene un cliente del pool (para uso avanzado)
   */
  getClient(): Promise<PoolClient>;

  /**
   * Cierra todas las conexiones del pool
   */
  close(): Promise<void>;
}

