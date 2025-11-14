import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database.module";
import { AwsModule } from "./aws.module";
import {
  applicationServiceProviders,
  useCaseProviders,
  USE_CASE_TOKENS,
} from "../providers/application.provider";

/**
 * Módulo de aplicación
 * Proporciona servicios de aplicación y use cases
 */
@Module({
  imports: [DatabaseModule, AwsModule],
  providers: [...applicationServiceProviders, ...useCaseProviders],
  exports: [
    ...applicationServiceProviders,
    ...useCaseProviders,
    USE_CASE_TOKENS.ON_PROJECTION_UPDATE,
    USE_CASE_TOKENS.ON_METRIC_RUN_STARTED,
    USE_CASE_TOKENS.ON_METRIC_RUN_HEARTBEAT,
    USE_CASE_TOKENS.ON_METRIC_RUN_COMPLETED,
  ],
})
export class ApplicationModule {}
