import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * Logging Interceptor
 * 
 * Provides comprehensive logging for all HTTP requests and responses.
 * This interceptor logs request details, processing time, and response information
 * for monitoring and debugging purposes.
 * 
 * Why this exists:
 * - Centralizes request/response logging
 * - Provides performance monitoring
 * - Enables audit trail for API calls
 * - Helps with debugging and troubleshooting
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  /**
   * Intercept HTTP requests and log them
   * @param context - Execution context
   * @param next - Next handler
   * @returns Observable with logging
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const startTime = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Generate request ID if not present
    const requestId = request.headers['x-request-id'] as string || 
                     request.headers['x-trace-id'] as string || 
                     this.generateRequestId();

    // Add request ID to response headers
    response.setHeader('x-request-id', requestId);

    // Log incoming request
    this.logIncomingRequest(request, requestId);

    // Intercept response and log it
    return next.handle().pipe(
      tap({
        next: (value) => {
          this.logOutgoingResponse(request, response, requestId, startTime, value);
        },
        error: (error) => {
          this.logErrorResponse(request, response, requestId, startTime, error);
        },
      })
    );
  }

  /**
   * Log incoming request details
   * @param request - Express request object
   * @param requestId - Request identifier
   */
  private logIncomingRequest(request: Request, requestId: string): void {
    const logData = {
      requestId,
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      clientIp: this.getClientIp(request),
      userId: request.headers['x-user-id'],
      clientId: request.headers['x-client-id'],
      contentType: request.headers['content-type'],
      contentLength: request.headers['content-length'],
      query: this.sanitizeQuery(request.query),
      params: request.params,
      // Only log body for non-sensitive endpoints
      body: this.shouldLogBody(request) ? this.sanitizeBody(request.body) : '[SKIPPED]',
    };

    this.logger.log(`Incoming Request: ${request.method} ${request.url}`, logData);
  }

  /**
   * Log successful response
   * @param request - Express request object
   * @param response - Express response object
   * @param requestId - Request identifier
   * @param startTime - Request start time
   * @param responseBody - Response body
   */
  private logOutgoingResponse(
    request: Request,
    response: Response,
    requestId: string,
    startTime: number,
    responseBody: any
  ): void {
    const processingTime = Date.now() - startTime;
    const statusCode = response.statusCode;

    const logData = {
      requestId,
      method: request.method,
      url: request.url,
      statusCode,
      processingTime: `${processingTime}ms`,
      responseSize: this.getResponseSize(responseBody),
      clientIp: this.getClientIp(request),
      // Only log response body for non-sensitive endpoints
      responseBody: this.shouldLogBody(request) ? this.sanitizeResponseBody(responseBody) : '[SKIPPED]',
    };

    const logLevel = statusCode >= 400 ? 'warn' : 'log';
    this.logger[logLevel](`Outgoing Response: ${request.method} ${request.url} ${statusCode} (${processingTime}ms)`, logData);
  }

  /**
   * Log error response
   * @param request - Express request object
   * @param response - Express response object
   * @param requestId - Request identifier
   * @param startTime - Request start time
   * @param error - Error object
   */
  private logErrorResponse(
    request: Request,
    response: Response,
    requestId: string,
    startTime: number,
    error: any
  ): void {
    const processingTime = Date.now() - startTime;
    const statusCode = error.status || error.response?.status || 500;

    const logData = {
      requestId,
      method: request.method,
      url: request.url,
      statusCode,
      processingTime: `${processingTime}ms`,
      errorMessage: error.message,
      errorStack: error.stack,
      clientIp: this.getClientIp(request),
      userId: request.headers['x-user-id'],
      clientId: request.headers['x-client-id'],
    };

    this.logger.error(`Error Response: ${request.method} ${request.url} ${statusCode} (${processingTime}ms)`, logData);
  }

  /**
   * Generate unique request ID
   * @returns Request ID string
   */
  private generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `req_${timestamp}_${random}`;
  }

  /**
   * Get client IP address from request
   * @param request - Express request object
   * @returns Client IP address
   */
  private getClientIp(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (request.headers['x-real-ip'] as string) ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Determine if request body should be logged
   * @param request - Express request object
   * @returns True if body should be logged
   */
  private shouldLogBody(request: Request): boolean {
    const sensitivePaths = [
      '/api/v1/auth/login',
      '/api/v1/auth/refresh',
      '/api/v1/users/change-password',
    ];

    const sensitiveMethods = ['POST', 'PUT', 'PATCH'];
    
    // Skip logging for sensitive paths
    if (sensitivePaths.some(path => request.path.startsWith(path))) {
      return false;
    }

    // Only log body for certain methods
    if (!sensitiveMethods.includes(request.method)) {
      return false;
    }

    // Check content type
    const contentType = request.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      return false;
    }

    return true;
  }

  /**
   * Sanitize request body for logging
   * @param body - Request body
   * @returns Sanitized body
   */
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'apiKey',
      'authorization',
      'credential',
      'ssn',
      'socialSecurityNumber',
      'creditCard',
      'bankAccount',
    ];

    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Truncate large objects
    const jsonString = JSON.stringify(sanitized);
    if (jsonString.length > 1000) {
      return '[LARGE_BODY_TRUNCATED]';
    }

    return sanitized;
  }

  /**
   * Sanitize response body for logging
   * @param body - Response body
   * @returns Sanitized body
   */
  private sanitizeResponseBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    // Remove sensitive data from error responses
    if (body.error && body.error.details) {
      const sanitized = { ...body };
      sanitized.error = { ...body.error };
      
      // Remove stack traces in production
      if (process.env.NODE_ENV === 'production') {
        delete sanitized.error.details.stack;
        delete sanitized.error.details.originalError;
      }

      return sanitized;
    }

    return body;
  }

  /**
   * Sanitize query parameters for logging
   * @param query - Query parameters
   * @returns Sanitized query parameters
   */
  private sanitizeQuery(query: any): any {
    if (!query || typeof query !== 'object') {
      return query;
    }

    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'apiKey',
    ];

    const sanitized = { ...query };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Get response size for logging
   * @param responseBody - Response body
   * @returns Response size in bytes
   */
  private getResponseSize(responseBody: any): string {
    if (!responseBody) {
      return '0 bytes';
    }

    try {
      const jsonString = JSON.stringify(responseBody);
      const bytes = new Blob([jsonString]).size;
      
      if (bytes < 1024) {
        return `${bytes} bytes`;
      } else if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(2)} KB`;
      } else {
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
      }
    } catch (error) {
      return 'unknown';
    }
  }
}
