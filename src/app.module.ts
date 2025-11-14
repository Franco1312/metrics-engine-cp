import { Module } from "@nestjs/common";
import { DatabaseModule } from "./interfaces/modules/database.module";
import { AwsModule } from "./interfaces/modules/aws.module";
import { ApplicationModule } from "./interfaces/modules/application.module";

@Module({
  imports: [DatabaseModule, AwsModule, ApplicationModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
