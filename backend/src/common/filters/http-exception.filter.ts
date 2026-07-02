import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';
    let errors: { field: string; issue: string }[] | undefined = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resBody = exception.getResponse();

      if (typeof resBody === 'object' && resBody !== null) {
        const body = resBody as Record<string, unknown>;
        error = (body.error as string) || exception.name;

        if (Array.isArray(body.message)) {
          errors = (body.message as string[]).map((msg: string) => {
            const parts = msg.split(' ');
            const field = parts[0] || 'unknown';
            return {
              field,
              issue: msg,
            };
          });
          message = 'Validation failed.';
        } else {
          message = (body.message as string) || exception.message;
        }
      } else if (typeof resBody === 'string') {
        message = resBody;
      }
    } else {
      this.logger.error(exception);
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'Internal Server Error';
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      error,
      message,
      ...(errors ? { errors } : {}),
      timestamp: new Date().toISOString(),
    });
  }
}
