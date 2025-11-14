import { Series } from '../entities/series.entity';
import { TransactionClient } from '../interfaces/database-client.interface';

export interface SeriesRepository {
  findByCode(code: string, client?: TransactionClient): Promise<Series | null>;
  findByCodes(
    codes: string[],
    client?: TransactionClient,
  ): Promise<Series[]>;
  findAll(client?: TransactionClient): Promise<Series[]>;
}

