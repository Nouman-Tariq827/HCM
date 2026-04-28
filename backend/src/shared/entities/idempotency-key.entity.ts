import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Idempotency Key Entity
 * 
 * Ensures idempotent operations by tracking processed requests.
 * This entity is critical for preventing duplicate operations and ensuring data consistency.
 * 
 * Why this entity exists:
 * - Prevent duplicate time-off deductions
 * - Enable safe retry mechanisms
 * - Provide audit trail for request processing
 * - Support request deduplication across service restarts
 */
@Entity('idempotency_keys')
@Index(['requestId']) // Fast lookup by request ID
@Index(['clientId', 'operationType']) // Client-specific filtering
@Index(['expiresAt']) // Efficient cleanup of expired keys
export class IdempotencyKey {
  /**
   * Primary key for internal database operations
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Unique request identifier from client
   * Must be unique across all clients and operations
   * Critical for idempotency guarantee
   */
  @Column({ type: 'varchar', length: 100, unique: true })
  requestId: string;

  /**
   * Client identifier that sent the request
   * Used for client-specific operations and monitoring
   */
  @Column({ type: 'varchar', length: 50 })
  clientId: string;

  /**
   * Type of operation being performed
   * Examples: balance_deduct, balance_add, sync_start
   */
  @Column({ type: 'varchar', length: 50 })
  operationType: string;

  /**
   * Employee identifier if operation is employee-specific
   * Null for system-wide operations
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  employeeId: string;

  /**
   * Policy type if operation is policy-specific
   * Null for non-policy operations
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  policyType: string;

  /**
   * Hash of the request body for content validation
   * Ensures request content hasn't changed between retries
   * SHA-256 hash of JSON.stringify(requestBody)
   */
  @Column({ type: 'varchar', length: 64 })
  requestHash: string;

  /**
   * Cached response data for successful operations
   * Stored as JSON string
   * Enables immediate response for duplicate requests
   */
  @Column({ type: 'text', nullable: true })
  responseData: string;

  /**
   * Current processing status
   * Examples: processing, completed, failed, expired
   */
  @Column({ type: 'varchar', length: 20 })
  status: string;

  /**
   * Timestamp when this idempotency key expires
   * After this time, the key can be reused
   * Prevents unlimited growth of the table
   */
  @Column({ type: 'datetime' })
  expiresAt: Date;

  /**
   * Number of retry attempts for this request
   * Helps identify problematic operations
   */
  @Column({ type: 'integer', default: 0 })
  retryCount: number;

  /**
   * Error message if operation failed
   * Null for successful operations
   */
  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  /**
   * Processing duration in milliseconds
   * Helps monitor performance and identify bottlenecks
   */
  @Column({ type: 'integer', nullable: true })
  processingDuration: number;

  /**
   * Additional metadata in JSON format
   * Flexible storage for operation-specific data
   */
  @Column({ type: 'text', nullable: true })
  metadata: string;

  /**
   * Record creation timestamp
   */
  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  /**
   * Record update timestamp
   */
  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  // Business logic methods

  /**
   * Checks if the idempotency key has expired
   * @returns True if key is expired
   */
  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  /**
   * Checks if the request is currently being processed
   * @returns True if status is processing
   */
  isProcessing(): boolean {
    return this.status === 'processing';
  }

  /**
   * Checks if the request completed successfully
   * @returns True if status is completed
   */
  isCompleted(): boolean {
    return this.status === 'completed';
  }

  /**
   * Checks if the request failed
   * @returns True if status is failed
   */
  isFailed(): boolean {
    return this.status === 'failed';
  }

  /**
   * Validates request hash matches stored hash
   * @param requestBody - Request body to validate
   * @returns True if hashes match
   */
  validateRequestHash(requestBody: any): boolean {
    const currentHash = IdempotencyKey.generateRequestHash(requestBody);
    return currentHash === this.requestHash;
  }

  /**
   * Generates SHA-256 hash of request body
   * @param requestBody - Request body to hash
   * @returns SHA-256 hash as hex string
   */
  static generateRequestHash(requestBody: any): string {
    const crypto = require('crypto');
    const jsonString = JSON.stringify(requestBody, Object.keys(requestBody).sort());
    return crypto.createHash('sha256').update(jsonString).digest('hex');
  }

  /**
   * Marks request as processing
   * Should be called when starting to process a request
   */
  markProcessing(): void {
    this.status = 'processing';
    this.retryCount++;
  }

  /**
   * Marks request as completed with response data
   * @param responseData - Response data to cache
   * @param processingDuration - Time taken to process in milliseconds
   */
  markCompleted(responseData: any, processingDuration: number): void {
    this.status = 'completed';
    this.responseData = JSON.stringify(responseData);
    this.processingDuration = processingDuration;
    this.errorMessage = null; // Clear any previous error
  }

  /**
   * Marks request as failed with error message
   * @param error - Error message or Error object
   * @param processingDuration - Time taken before failure in milliseconds
   */
  markFailed(error: string | Error, processingDuration?: number): void {
    this.status = 'failed';
    this.errorMessage = error instanceof Error ? error.message : error;
    this.processingDuration = processingDuration || null;
    this.responseData = null; // Clear any previous response
  }

  /**
   * Retrieves cached response data
   * @returns Parsed response data or null
   */
  getResponseData(): any {
    if (!this.responseData) {
      return null;
    }
    
    try {
      return JSON.parse(this.responseData);
    } catch (error) {
      return null;
    }
  }

  /**
   * Stores metadata as JSON
   * @param data - Object to store
   */
  setMetadata(data: any): void {
    this.metadata = JSON.stringify(data);
  }

  /**
   * Retrieves metadata as object
   * @returns Parsed metadata object or null
   */
  getMetadata(): any {
    if (!this.metadata) {
      return null;
    }
    
    try {
      return JSON.parse(this.metadata);
    } catch (error) {
      return null;
    }
  }

  /**
   * Extends expiration time
   * @param additionalHours - Number of hours to extend
   */
  extendExpiration(additionalHours: number): void {
    const currentExpiry = new Date(this.expiresAt);
    this.expiresAt = new Date(currentExpiry.getTime() + (additionalHours * 60 * 60 * 1000));
  }

  /**
   * Creates a new idempotency key for a request
   * @param requestId - Unique request identifier
   * @param clientId - Client identifier
   * @param operationType - Type of operation
   * @param requestBody - Request body for hashing
   * @param ttlHours - Time to live in hours (default: 24)
   * @returns New IdempotencyKey instance
   */
  static create(
    requestId: string,
    clientId: string,
    operationType: string,
    requestBody: any,
    ttlHours: number = 24
  ): IdempotencyKey {
    const key = new IdempotencyKey();
    key.requestId = requestId;
    key.clientId = clientId;
    key.operationType = operationType;
    key.requestHash = IdempotencyKey.generateRequestHash(requestBody);
    key.status = 'processing';
    key.retryCount = 0;
    
    // Set expiration time
    const now = new Date();
    key.expiresAt = new Date(now.getTime() + (ttlHours * 60 * 60 * 1000));
    
    return key;
  }

  /**
   * Validates idempotency key data integrity
   * @throws Error if validation fails
   */
  validate(): void {
    if (!this.requestId || this.requestId.trim().length === 0) {
      throw new Error('Request ID is required');
    }
    
    if (!this.clientId || this.clientId.trim().length === 0) {
      throw new Error('Client ID is required');
    }
    
    if (!this.operationType || this.operationType.trim().length === 0) {
      throw new Error('Operation type is required');
    }
    
    if (!this.requestHash || this.requestHash.trim().length === 0) {
      throw new Error('Request hash is required');
    }
    
    if (!this.status || this.status.trim().length === 0) {
      throw new Error('Status is required');
    }
    
    if (!this.expiresAt) {
      throw new Error('Expires at timestamp is required');
    }
    
    if (this.retryCount < 0) {
      throw new Error('Retry count cannot be negative');
    }
    
    if (this.processingDuration !== null && this.processingDuration < 0) {
      throw new Error('Processing duration cannot be negative');
    }
    
    // Validate request hash format (should be 64 character hex string)
    if (!/^[a-f0-9]{64}$/i.test(this.requestHash)) {
      throw new Error('Request hash must be a valid SHA-256 hash');
    }
  }

  /**
   * Returns a summary of the idempotency key status
   * Useful for monitoring and debugging
   */
  getStatusSummary(): string {
    const age = Date.now() - this.createdAt.getTime();
    const ageMinutes = Math.round(age / (1000 * 60));
    
    let summary = `${this.status.toUpperCase()} (${ageMinutes} min old)`;
    
    if (this.retryCount > 0) {
      summary += `, ${this.retryCount} retries`;
    }
    
    if (this.processingDuration) {
      summary += `, ${this.processingDuration}ms`;
    }
    
    if (this.isExpired()) {
      summary += ' (EXPIRED)';
    }
    
    return summary;
  }
}
