import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database.module";
import { AwsModule } from "./aws.module";
import {
  applicationServiceProviders,
  useCaseProviders,
} from "../providers/application.provider";

/**
 * Módulo de aplicación
 * Proporciona servicios de aplicación y use cases
 */
@Module({
  imports: [DatabaseModule, AwsModule],
  providers: [...applicationServiceProviders, ...useCaseProviders],
  exports: [...applicationServiceProviders, ...useCaseProviders],
})
export class ApplicationModule {}
