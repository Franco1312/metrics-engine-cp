import { Series } from "@/domain/entities/series.entity";

interface SeriesData {
  code?: string;
  name?: string;
  description?: string;
  unit?: string;
  frequency?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class SeriesBuilder {
  private data: SeriesData = {
    code: "series1",
    name: "Test Series",
    description: "Test description",
    unit: "unit",
    frequency: "daily",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
  };

  withCode(code: string): this {
    this.data.code = code;
    return this;
  }

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  build(): Series {
    return {
      code: this.data.code!,
      name: this.data.name,
      description: this.data.description,
      unit: this.data.unit,
      frequency: this.data.frequency,
      createdAt: this.data.createdAt!,
      updatedAt: this.data.updatedAt!,
    };
  }
}
