import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : null;
    const message =
      status >= 500
        ? 'An unexpected error occurred'
        : typeof body === 'string'
          ? body
          : body && 'message' in body
            ? body.message
            : 'Request failed';
    const traceId = response.getHeader('x-request-id');

    if (status >= 500) {
      this.logger.error({
        message: 'Unhandled request error',
        traceId,
        method: request.method,
        path: request.path,
        error: exception instanceof Error ? exception.stack : String(exception),
      });
    } else {
      this.logger.warn({ message: 'Request failed', traceId, status, method: request.method, path: request.path });
    }

    response.status(status).json({ statusCode: status, message, traceId });
  }
}
