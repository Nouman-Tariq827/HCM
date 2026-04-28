import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Sync Status Entity
 * 
 * Tracks the status and progress of synchronization operations with HCM.
 * This entity is critical for monitoring sync health and debugging issues.
 * 
 * Why this entity exists:
 * - Monitor synchronization operations in real-time
 * - Track sync performance and success rates
 * - Enable retry mechanisms for failed syncs
 * - Provide audit trail for compliance
 */
@Entity('sync_status')
@Index(['syncType', 'status']) // Filter by type and status
@Index(['startedAt']) // Time-based monitoring
export class SyncStatus {
  /**
   * Primary key for internal database operations
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Type of synchronization operation
   * Examples: full_batch, incremental, real_time, manual
   */
  @Column({ type: 'varchar', length: 50 })
  syncType: string;

  /**
   * Current status of the sync operation
   * Examples: pending, in_progress, completed, failed, cancelled
   */
  @Column({ type: 'varchar', length: 50 })
  status: string;

  /**
   * Timestamp when sync operation started
   * Never null - set when operation is created
   */
  @Column({ type: 'datetime' })
  startedAt: Date;

  /**
   * Timestamp when sync operation completed
   * Null for ongoing operations
   */
  @Column({ type: 'datetime', nullable: true })
  completedAt?: Date;

  /**
   * Number of employees processed so far
   * Used for progress tracking
   */
  @Column({ type: 'integer', default: 0 })
  employeesProcessed: number;

  /**
   * Total number of employees to process
   * Set at sync start based on operation type
   */
  @Column({ type: 'integer', default: 0 })
  employeesTotal: number;

  /**
   * Number of conflicts detected during sync
   * Important for monitoring data quality
   */
  @Column({ type: 'integer', default: 0 })
  conflictsDetected: number;

  /**
   * Number of conflicts successfully resolved
   * Helps track resolution effectiveness
   */
  @Column({ type: 'integer', default: 0 })
  conflictsResolved: number;

  /**
   * Error message if sync failed
   * Null for successful or ongoing operations
   */
  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  /**
   * Priority level of this sync operation
   * Higher priority operations get more resources
   * Examples: low, medium, high, critical
   */
  @Column({ type: 'varchar', length: 20, default: 'medium' })
  priority: string;

  /**
   * Estimated duration in seconds
   * Used for resource planning and user expectations
   */
  @Column({ type: 'integer', nullable: true })
  estimatedDuration: number;

  /**
   * Actual duration in seconds
   * Calculated when operation completes
   */
  @Column({ type: 'integer', nullable: true })
  actualDuration: number;

  /**
   * Batch size used for this sync
   * Helps optimize future sync operations
   */
  @Column({ type: 'integer', nullable: true })
  batchSize: number;

  /**
   * Number of retry attempts
   * Tracks resilience and helps identify systemic issues
   */
  @Column({ type: 'integer', default: 0 })
  retryAttempts: number;

  /**
   * Additional metadata in JSON format
   * Flexible storage for operation-specific data
   */
  @Column({ type: 'text', nullable: true })
  metadata: string;

  /**
   * User who initiated this sync
   * Null for system-initiated syncs
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  initiatedBy: string;

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
   * Calculates completion percentage
   * @returns Percentage complete (0-100)
   */
  getCompletionPercentage(): number {
    if (this.employeesTotal === 0) {
      return 0;
    }
    
    return Math.round((this.employeesProcessed / this.employeesTotal) * 100);
  }

  /**
   * Alias for getCompletionPercentage
   * @returns Percentage complete (0-100)
   */
  getProgressPercentage(): number {
    return this.getCompletionPercentage();
  }

  /**
   * Calculates processing rate (employees per minute)
   * @returns Processing rate or null if insufficient data
   */
  getProcessingRate(): number | null {
    if (!this.startedAt || this.employeesProcessed === 0) {
      return null;
    }
    
    const now = new Date();
    const endTime = this.completedAt || now;
    const durationMinutes = (endTime.getTime() - this.startedAt.getTime()) / (1000 * 60);
    
    return durationMinutes > 0 ? Math.round(this.employeesProcessed / durationMinutes) : null;
  }

  /**
   * Estimates remaining time in minutes
   * @returns Estimated remaining minutes or null if insufficient data
   */
  getEstimatedRemainingTime(): number | null {
    const rate = this.getProcessingRate();
    if (!rate || this.employeesTotal === 0) {
      return null;
    }
    
    const remainingEmployees = this.employeesTotal - this.employeesProcessed;
    return Math.round(remainingEmployees / rate);
  }

  /**
   * Alias for getEstimatedRemainingTime
   * @returns Estimated remaining minutes or null if insufficient data
   */
  getEstimatedRemainingMinutes(): number | null {
    return this.getEstimatedRemainingTime();
  }

  /**
   * Gets estimated completion time
   * @returns Date or null if insufficient data
   */
  getEstimatedCompletion(): Date | null {
    const remainingMinutes = this.getEstimatedRemainingTime();
    if (remainingMinutes === null) {
      return null;
    }
    
    const completionDate = new Date();
    completionDate.setMinutes(completionDate.getMinutes() + remainingMinutes);
    return completionDate;
  }

  /**
   * Checks if sync operation is currently running
   * @returns True if status is in_progress
   */
  isRunning(): boolean {
    return this.status === 'in_progress';
  }

  /**
   * Checks if sync operation completed successfully
   * @returns True if status is completed
   */
  isCompleted(): boolean {
    return this.status === 'completed';
  }

  /**
   * Checks if sync operation failed
   * @returns True if status is failed
   */
  isFailed(): boolean {
    return this.status === 'failed';
  }

  /**
   * Marks sync as completed
   * Sets completion timestamp and calculates duration
   */
  markCompleted(): void {
    this.status = 'completed';
    this.completedAt = new Date();
    
    if (this.startedAt) {
      this.actualDuration = Math.round(
        (this.completedAt.getTime() - this.startedAt.getTime()) / 1000
      );
    }
  }

  /**
   * Marks sync as failed with error message
   * @param error - Error message or Error object
   */
  markFailed(error: string | Error): void {
    this.status = 'failed';
    this.completedAt = new Date();
    this.errorMessage = error instanceof Error ? error.message : error;
    
    if (this.startedAt) {
      this.actualDuration = Math.round(
        (this.completedAt.getTime() - this.startedAt.getTime()) / 1000
      );
    }
  }

  /**
   * Increments retry counter
   */
  incrementRetryAttempts(): void {
    this.retryAttempts++;
  }

  /**
   * Updates conflict counters
   * @param detected - Number of new conflicts detected
   * @param resolved - Number of conflicts resolved
   */
  updateConflictCounters(detected: number = 0, resolved: number = 0): void {
    this.conflictsDetected += detected;
    this.conflictsResolved += resolved;
  }

  /**
   * Updates progress counter
   * @param processed - Number of employees processed in this batch
   */
  updateProgress(processed: number): void {
    this.employeesProcessed += processed;
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
   * Validates sync status data integrity
   * @throws Error if validation fails
   */
  validate(): void {
    if (!this.syncType || this.syncType.trim().length === 0) {
      throw new Error('Sync type is required');
    }
    
    if (!this.status || this.status.trim().length === 0) {
      throw new Error('Status is required');
    }
    
    if (!this.startedAt) {
      throw new Error('Started at timestamp is required');
    }
    
    if (this.employeesProcessed < 0) {
      throw new Error('Employees processed cannot be negative');
    }
    
    if (this.employeesTotal < 0) {
      throw new Error('Employees total cannot be negative');
    }
    
    if (this.employeesProcessed > this.employeesTotal) {
      throw new Error('Employees processed cannot exceed total');
    }
    
    if (this.conflictsDetected < 0) {
      throw new Error('Conflicts detected cannot be negative');
    }
    
    if (this.conflictsResolved < 0) {
      throw new Error('Conflicts resolved cannot be negative');
    }
    
    if (this.conflictsResolved > this.conflictsDetected) {
      throw new Error('Conflicts resolved cannot exceed detected');
    }
  }

  /**
   * Returns a human-readable status summary
   * Useful for monitoring dashboards and notifications
   */
  getStatusSummary(): string {
    const percentage = this.getCompletionPercentage();
    const rate = this.getProcessingRate();
    const remaining = this.getEstimatedRemainingTime();
    
    let summary = `${this.status.toUpperCase()}: ${percentage}% (${this.employeesProcessed}/${this.employeesTotal})`;
    
    if (rate) {
      summary += ` at ${rate} emp/min`;
    }
    
    if (remaining && this.isRunning()) {
      summary += `, ~${remaining} min remaining`;
    }
    
    if (this.conflictsDetected > 0) {
      summary += `, ${this.conflictsDetected} conflicts`;
    }
    
    return summary;
  }
}
