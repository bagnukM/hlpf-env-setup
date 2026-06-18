import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const traceId = randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object') {
        const obj = body as any;
        message = obj.message || obj.error || message;
        // ValidationPipe повертає масив помилок
        if (Array.isArray(obj.message)) {
          details = obj.message;
          message = 'Validation failed';
        }
      }
    }

    // Логуємо з traceId для дебагу
    this.logger.error(
      `[${traceId}] ${request.method} ${request.url} — ${status} — ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      error: {
        code: status,
        message,
        ...(details && { details }),
        traceId,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
