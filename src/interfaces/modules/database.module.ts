import { Module, Global } from "@nestjs/common";
import {
  configProvider,
  loggerProvider,
  databaseProvider,
  repositoriesProviders,
} from "../providers";

/**
 * Módulo global de base de datos
 * Proporciona configuración, logger, cliente de base de datos y repositorios
 */
@Global()
@Module({
  providers: [
    configProvider,
    loggerProvider,
    databaseProvider,
    ...repositoriesProviders,
  ],
  exports: [
    configProvider,
    loggerProvider,
    databaseProvider,
    ...repositoriesProviders,
  ],
})
export class DatabaseModule {}
