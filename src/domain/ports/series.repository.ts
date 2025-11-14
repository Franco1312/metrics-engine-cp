import { Series } from '@/domain/entities/series.entity';
import { TransactionClient } from '@/domain/interfaces/database-client.interface';

export interface SeriesRepository {
  findByCode(code: string, client?: TransactionClient): Promise<Series | null>;
  findByCodes(
    codes: string[],
    client?: TransactionClient,
  ): Promise<Series[]>;
  findAll(client?: TransactionClient): Promise<Series[]>;
}

