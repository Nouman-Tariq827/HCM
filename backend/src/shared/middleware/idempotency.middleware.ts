import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { IdempotencyKeyRepository } from '@/shared/repositories/idempotency-key.repository';
import { IdempotencyKey } from '@/shared/entities/idempotency-key.entity';

/**
 * Idempotency Middleware
 * 
 * Ensures that duplicate requests with the same ID are not processed multiple times.
 * This middleware is critical for preventing duplicate balance deductions and ensuring
 * data consistency across retry scenarios.
 * 
 * Why this exists:
 * - Prevents duplicate operations
 * - Enables safe retry mechanisms
 * - Provides consistent responses for duplicate requests
 * - Maintains data integrity
 */
@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  constructor(
    private readonly idempotencyRepository: IdempotencyKeyRepository,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Middleware handler for idempotency processing
   * @param request - Express request object
   * @param response - Express response object
   * @param next - Next function
   */
  async use(request: Request, response: Response, next: NextFunction): Promise<void> {
    // Skip idempotency for GET requests and health checks
    if (request.method === 'GET' || request.path.includes('/health')) {
      return next();
    }

    const requestId = this.getRequestId(request);
    const clientId = this.getClientId(request);

    if (!requestId || !clientId) {
      // Idempotency is optional for some endpoints
      return next();
    }

    try {
      // Generate request hash
      const requestHash = this.generateRequestHash(request.body);

      // Check for existing idempotency key
      const existingKey = await this.idempotencyRepository.findByRequestAndHash(
        requestId,
        requestHash
      );

      if (existingKey) {
        // Handle existing request
        await this.handleExistingRequest(existingKey, response);
        return;
      }

      // Create new idempotency key
      await this.createIdempotencyKey(requestId, clientId, request, requestHash);

      // Continue with request processing
      next();
    } catch (error) {
      // If idempotency check fails, continue with request
      // but log the error for monitoring
      console.error('Idempotency check failed:', error);
      next();
    }
  }

  /**
   * Handle existing request based on its status
   * @param key - Existing idempotency key
   * @param response - Express response object
   */
  private async handleExistingRequest(key: IdempotencyKey, response: Response): Promise<void> {
    if (key.isProcessing()) {
      // Request is still being processed
      throw new HttpException(
        {
          success: false,
          error: {
            code: 'REQUEST_PROCESSING',
            message: 'Request is already being processed',
            requestId: key.requestId,
            timestamp: new Date().toISOString(),
            retryable: false,
          },
        },
        HttpStatus.CONFLICT
      );
    }

    if (key.isCompleted()) {
      // Request completed successfully, return cached response
      const cachedResponse = key.getResponseData();
      response.status(200).json(cachedResponse);
      return;
    }

    if (key.isFailed()) {
      // Request failed, return error response
      throw new HttpException(
        {
          success: false,
          error: {
            code: 'REQUEST_FAILED',
            message: 'Request previously failed',
            details: key.errorMessage,
            requestId: key.requestId,
            timestamp: new Date().toISOString(),
            retryable: true,
            retryAfter: 30,
          },
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Create new idempotency key
   * @param requestId - Request identifier
   * @param clientId - Client identifier
   * @param request - Express request object
   * @param requestHash - Request body hash
   */
  private async createIdempotencyKey(
    requestId: string,
    clientId: string,
    request: Request,
    requestHash: string
  ): Promise<void> {
    const operationType = this.getOperationType(request);
    const employeeId = this.getEmployeeId(request);
    const policyType = this.getPolicyType(request);

    await this.idempotencyRepository.createIdempotencyKey({
      requestId,
      clientId,
      operationType,
      employeeId,
      policyType,
      requestHash,
      ttlHours: 24, // 24 hours TTL
    });
  }

  /**
   * Get request ID from headers or body
   * @param request - Express request object
   * @returns Request ID
   */
  private getRequestId(request: Request): string {
    return (request.headers['x-request-id'] as string) ||
           (request.body?.requestId as string);
  }

  /**
   * Get client ID from headers
   * @param request - Express request object
   * @returns Client ID
   */
  private getClientId(request: Request): string {
    return (request.headers['x-client-id'] as string) ||
           (request.body?.clientId as string) ||
           'unknown';
  }

  /**
   * Get operation type from request
   * @param request - Express request object
   * @returns Operation type
   */
  private getOperationType(request: Request): string {
    const path = request.path;
    
    if (path.includes('/validate')) {
      return 'balance_validate';
    }
    
    if (path.includes('/deduct')) {
      return 'balance_deduct';
    }
    
    if (path.includes('/add')) {
      return 'balance_add';
    }
    
    if (path.includes('/sync')) {
      return 'sync_operation';
    }
    
    return 'unknown';
  }

  /**
   * Get employee ID from request body
   * @param request - Express request object
   * @returns Employee ID
   */
  private getEmployeeId(request: Request): string {
    return request.body?.employeeId;
  }

  /**
   * Get policy type from request body
   * @param request - Express request object
   * @returns Policy type
   */
  private getPolicyType(request: Request): string {
    return request.body?.policyType;
  }

  /**
   * Generate SHA-256 hash of request body
   * @param body - Request body
   * @returns Hash string
   */
  private generateRequestHash(body: any): string {
    if (!body) {
      return 'empty_body';
    }

    const crypto = require('crypto');
    
    // Sort keys to ensure consistent hashing
    const sortedKeys = Object.keys(body).sort();
    const sortedBody: any = {};
    
    for (const key of sortedKeys) {
      sortedBody[key] = body[key];
    }
    
    const jsonString = JSON.stringify(sortedBody);
    return crypto.createHash('sha256').update(jsonString).digest('hex');
  }
}
