import { Module } from "@nestjs/common";
import { DatabaseModule } from "./interfaces/modules/database.module";
import { AwsModule } from "./interfaces/modules/aws.module";
import { ApplicationModule } from "./interfaces/modules/application.module";
import { QueueModule } from "./interfaces/modules/queue.module";
import { HealthController } from "./interfaces/http/health.controller";

@Module({
  imports: [DatabaseModule, AwsModule, ApplicationModule, QueueModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
