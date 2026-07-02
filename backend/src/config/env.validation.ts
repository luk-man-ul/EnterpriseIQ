import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  PORT = 3000;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  @IsOptional()
  FRONTEND_URL = 'http://localhost:3000';

  @IsString()
  JWT_SECRET!: string;

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN = '7d';
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
