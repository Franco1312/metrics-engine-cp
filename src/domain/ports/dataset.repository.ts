import { Dataset } from '@/domain/entities/dataset.entity';
import { TransactionClient } from '@/domain/interfaces/database-client.interface';

export interface DatasetRepository {
  findById(id: string, client?: TransactionClient): Promise<Dataset | null>;
  findAll(client?: TransactionClient): Promise<Dataset[]>;
}

