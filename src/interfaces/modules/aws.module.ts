import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database.module";
import { awsProviders } from "../providers/aws.provider";

/**
 * Módulo de AWS
 * Proporciona clientes de AWS (SNS, S3)
 */
@Module({
  imports: [DatabaseModule],
  providers: [...awsProviders],
  exports: [...awsProviders],
})
export class AwsModule {}
