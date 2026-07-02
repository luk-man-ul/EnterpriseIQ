import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3000;
  const frontendUrl =
    configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';

  // Enable versioned API global prefix
  app.setGlobalPrefix('api/v1');

  // Configure CORS policies restricted to Next.js origin
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  // Parse Cookie headers into req.cookies
  app.use(cookieParser());

  // Global exception formatter filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Enable Shutdown Hooks for graceful connection/resource releases
  app.enableShutdownHooks();

  await app.listen(port);
}
void bootstrap();
