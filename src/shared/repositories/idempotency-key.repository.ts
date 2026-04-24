import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { BaseRepository } from './base.repository';
import { IdempotencyKey } from '../entities/idempotency-key.entity';
import * as crypto from 'crypto';

/**
 * Idempotency Key Repository
 * 
 * Handles all idempotency-related database operations.
 * This repository ensures that duplicate requests are detected and handled correctly.
 * 
 * Why this exists:
 * - Prevents duplicate operations for the same request
 * - Stores response data for replaying idempotent responses
 * - Manages request lifecycle (processing, completed, failed)
 */
export class IdempotencyKeyRepository extends BaseRepository<IdempotencyKey> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(dataSource, IdempotencyKey, 'idempotency_key');
  }

  /**
   * Find an idempotency key by request and hash
   * @param requestId - Unique request identifier
   * @param requestHash - Hash of the request body
   * @returns Idempotency key or null
   */
  async findByRequestAndHash(requestId: string, requestHash: string): Promise<IdempotencyKey | null> {
    return this.findOne({ requestId, requestHash });
  }

  /**
   * Find an idempotency key by request and client
   * @param requestId - Unique request identifier
   * @param clientId - Client identifier
   * @returns Idempotency key or null
   */
  async findByRequestAndClient(requestId: string, clientId: string): Promise<IdempotencyKey | null> {
    return this.findOne({ requestId, clientId });
  }

  /**
   * Create a new idempotency key
   * @param data - Idempotency key data
   * @returns Created key
   */
  async createIdempotencyKey(data: {
    requestId: string;
    clientId: string;
    operationType: string;
    employeeId?: string;
    policyType?: string;
    requestHash: string;
    ttlHours?: number;
  }): Promise<IdempotencyKey> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (data.ttlHours || 24));

    const key = this.repository.create({
      ...data,
      status: 'processing',
      expiresAt,
      createdAt: new Date(),
    });
    return this.repository.save(key);
  }

  /**
   * Mark an idempotency key as completed with response data
   * @param requestId - Request identifier
   * @param clientId - Client identifier
   * @param responseData - Response data to cache
   * @param processingTime - Time taken to process the request
   */
  async markCompleted(
    requestId: string,
    clientId: string,
    responseData: any,
    processingTime: number
  ): Promise<void> {
    await this.repository.update(
      { requestId, clientId },
      {
        status: 'completed',
        responseData: JSON.stringify(responseData),
        processingDuration: processingTime,
      }
    );
  }

  /**
   * Mark an idempotency key as failed
   * @param requestId - Request identifier
   * @param clientId - Client identifier
   * @param error - Error object or message
   * @param processingTime - Time taken until failure
   */
  async markFailed(
    requestId: string,
    clientId: string,
    error: any,
    processingTime: number
  ): Promise<void> {
    await this.repository.update(
      { requestId, clientId },
      {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
        processingDuration: processingTime,
      }
    );
  }

  /**
   * Generate a unique hash for a request payload
   * @param data - Request data
   * @returns MD5 hash of the data
   */
  static generateRequestHash(data: any): string {
    const str = JSON.stringify(data);
    return crypto.createHash('md5').update(str).digest('hex');
  }
}
