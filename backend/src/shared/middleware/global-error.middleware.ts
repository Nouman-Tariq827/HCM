import {
  Injectable,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Catch,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

/**
 * Global Error Response Format
 * Standardized error response structure for all API errors
 */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    requestId?: string;
    timestamp: string;
    retryable?: boolean;
    retryAfter?: number;
    path?: string;
  };
}

/**
 * Global Error Handling Filter
 * 
 * This filter provides centralized error handling for all HTTP requests.
 * It catches exceptions, formats error responses consistently, and provides
 * appropriate logging for monitoring and debugging.
 * 
 * Why this exists:
 * - Centralizes error handling logic
 * - Provides consistent error response format
 * - Enables proper error logging and monitoring
 * - Handles different error types appropriately
 * - Prevents error details leakage in production
 */
@Catch()
@Injectable()
export class GlobalErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalErrorFilter.name);
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isProduction = this.configService.get<string>('nodeEnv') === 'production';
  }

  /**
   * Filter handler for error processing
   * @param exception - Exception object
   * @param host - Arguments host
   */
  catch(exception: any, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Skip if response has already been sent
    if (response.headersSent) {
      return;
    }

    // Generate request ID if not present
    const requestId = request.headers['x-request-id'] as string || 
                     request.headers['x-trace-id'] as string || 
                     this.generateRequestId();

    // Log the error with context
    this.logError(exception, request, requestId);

    // Determine error type and appropriate response
    const errorResponse = this.formatErrorResponse(exception, request, requestId);

    // Send error response
    response.status(errorResponse.statusCode).json(errorResponse.body);
  }

  /**
   * Log error with appropriate context
   * @param error - Error object
   * @param request - Express request object
   * @param requestId - Request identifier
   */
  private logError(error: Error, request: Request, requestId: string): void {
    const logContext = {
      requestId,
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      clientIp: this.getClientIp(request),
      userId: request.headers['x-user-id'],
      clientId: request.headers['x-client-id'],
      body: this.sanitizeRequestBody(request.body),
      query: request.query,
      params: request.params,
    };

    if (error instanceof HttpException) {
      // HTTP exceptions (validation errors, business logic errors)
      this.logger.warn(`HTTP Exception: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        ...logContext,
      });
    } else {
      // Unexpected errors
      this.logger.error(`Unexpected Error: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        ...logContext,
      });
    }
  }

  /**
   * Format error response based on error type
   * @param error - Error object
   * @param request - Express request object
   * @param requestId - Request identifier
   * @returns Formatted error response
   */
  private formatErrorResponse(
    error: Error,
    request: Request,
    requestId: string
  ): { statusCode: number; body: ErrorResponse } {
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details: any = undefined;
    let retryable = false;
    let retryAfter: number | undefined = undefined;

    if (error instanceof HttpException) {
      statusCode = error.getStatus();
      const exceptionResponse = error.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        // Handle validation errors from class-validator
        if (statusCode === HttpStatus.BAD_REQUEST && 
            Array.isArray((exceptionResponse as any).message)) {
          errorCode = 'VALIDATION_ERROR';
          message = 'Request validation failed';
          details = {
            validationErrors: (exceptionResponse as any).message,
          };
        } else {
          // Handle other structured error responses
          errorCode = this.getErrorCodeFromStatus(statusCode);
          message = (exceptionResponse as any).message || error.message;
          details = (exceptionResponse as any).details || undefined;
        }
      } else {
        errorCode = this.getErrorCodeFromStatus(statusCode);
        message = exceptionResponse as string || error.message;
      }
    } else {
      // Handle specific error types
      const errorInfo = this.handleSpecificError(error);
      statusCode = errorInfo.statusCode;
      errorCode = errorInfo.errorCode;
      message = errorInfo.message;
      details = errorInfo.details;
      retryable = errorInfo.retryable;
      retryAfter = errorInfo.retryAfter;
    }

    // Sanitize error details in production
    if (this.isProduction && statusCode >= 500) {
      details = undefined;
      message = 'An internal server error occurred';
    }

    const errorBody: ErrorResponse = {
      success: false,
      error: {
        code: errorCode,
        message,
        details,
        requestId,
        timestamp: new Date().toISOString(),
        retryable,
        retryAfter,
        path: request.url,
      },
    };

    return { statusCode, body: errorBody };
  }

  /**
   * Handle specific error types with custom logic
   * @param error - Error object
   * @returns Error handling information
   */
  private handleSpecificError(error: Error): {
    statusCode: number;
    errorCode: string;
    message: string;
    details?: any;
    retryable: boolean;
    retryAfter?: number;
  } {
    const errorMessage = error.message.toLowerCase();

    // Database errors
    if (errorMessage.includes('database') || errorMessage.includes('sql')) {
      if (errorMessage.includes('timeout') || errorMessage.includes('connection')) {
        return {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          errorCode: 'DATABASE_UNAVAILABLE',
          message: 'Database service temporarily unavailable',
          retryable: true,
          retryAfter: 30,
        };
      }

      if (errorMessage.includes('constraint') || errorMessage.includes('duplicate')) {
        return {
          statusCode: HttpStatus.CONFLICT,
          errorCode: 'DATA_CONFLICT',
          message: 'Data conflict detected',
          details: { originalError: error.message },
          retryable: false,
        };
      }

      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorCode: 'DATABASE_ERROR',
        message: 'Database operation failed',
        retryable: true,
        retryAfter: 5,
      };
    }

    // HCM system errors
    if (errorMessage.includes('hcm') || errorMessage.includes('external')) {
      if (errorMessage.includes('timeout') || errorMessage.includes('unavailable')) {
        return {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          errorCode: 'HCM_UNAVAILABLE',
          message: 'HCM system temporarily unavailable',
          retryable: true,
          retryAfter: 60,
        };
      }

      if (errorMessage.includes('rate limit') || errorMessage.includes('throttled')) {
        return {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          errorCode: 'HCM_RATE_LIMITED',
          message: 'HCM system rate limit exceeded',
          retryable: true,
          retryAfter: 300, // 5 minutes
        };
      }

      if (errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) {
        return {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          errorCode: 'HCM_AUTH_ERROR',
          message: 'HCM system authentication failed',
          retryable: false,
        };
      }

      return {
        statusCode: HttpStatus.BAD_GATEWAY,
        errorCode: 'HCM_ERROR',
        message: 'HCM system error',
        retryable: true,
        retryAfter: 30,
      };
    }

    // Circuit breaker errors
    if (errorMessage.includes('circuit breaker') || errorMessage.includes('circuitbreaker')) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        errorCode: 'CIRCUIT_BREAKER_OPEN',
        message: 'Service temporarily unavailable due to repeated failures',
        retryable: true,
        retryAfter: 60,
      };
    }

    // Idempotency errors
    if (errorMessage.includes('idempotency') || errorMessage.includes('duplicate')) {
      return {
        statusCode: HttpStatus.CONFLICT,
        errorCode: 'IDEMPOTENCY_CONFLICT',
        message: 'Request already processed or in progress',
        retryable: false,
      };
    }

    // Network/Connection errors
    if (errorMessage.includes('network') || errorMessage.includes('connection') || 
        errorMessage.includes('econnrefused') || errorMessage.includes('etimedout')) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        errorCode: 'NETWORK_ERROR',
        message: 'Network connectivity issue',
        retryable: true,
        retryAfter: 15,
      };
    }

    // Default to internal server error
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      details: this.isProduction ? undefined : { originalError: error.message },
      retryable: false,
    };
  }

  /**
   * Get error code from HTTP status
   * @param status - HTTP status code
   * @returns Error code string
   */
  private getErrorCodeFromStatus(status: number): string {
    const statusToCodeMap: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'RESOURCE_NOT_FOUND',
      [HttpStatus.METHOD_NOT_ALLOWED]: 'METHOD_NOT_ALLOWED',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
      [HttpStatus.BAD_GATEWAY]: 'BAD_GATEWAY',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
      [HttpStatus.GATEWAY_TIMEOUT]: 'GATEWAY_TIMEOUT',
    };

    return statusToCodeMap[status] || 'UNKNOWN_ERROR';
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
   * Sanitize request body for logging (remove sensitive data)
   * @param body - Request body
   * @returns Sanitized body
   */
  private sanitizeRequestBody(body: any): any {
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
    ];

    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
