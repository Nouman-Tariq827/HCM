import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { CurrentBalance } from './current-balance.entity';

/**
 * TimeOffRequest Entity
 * 
 * Represents a time-off request submitted by an employee. This entity tracks
 * the complete lifecycle of time-off requests from submission through approval
 * to completion, with full audit trail and HCM synchronization support.
 * 
 * Why this exists:
 * - Tracks time-off request lifecycle and status
 * - Enables audit trail for compliance
 * - Supports HCM system synchronization
 * - Provides business rule enforcement
 * - Handles request approval workflows
 */
@Entity('time_off_requests')
@Index(['employeeId', 'locationId']) // Fast lookup by employee and location
@Index(['status']) // Efficient status-based queries
@Index(['startDate', 'endDate']) // Date range queries
@Index(['requestId']) // External request identifier lookup
@Index(['approverId']) // Approver-specific queries
@Index(['createdAt']) // Recent requests
@Index(['updatedAt']) // Recently modified requests
export class TimeOffRequest {
  /**
   * Primary key for internal database operations
   * Auto-incrementing for optimal performance
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * External request identifier from client system
   * Must be unique for idempotency and tracking
   * Used for client reference and deduplication
   */
  @Column({ type: 'varchar', length: 100, unique: true })
  requestId: string;

  /**
   * Employee identifier who submitted the request
   * Foreign key reference to employee
   * Used for employee-specific queries and reporting
   */
  @Column({ type: 'varchar', length: 50 })
  employeeId: string;

  /**
   * Location identifier where request applies
   * Critical for multi-location organizations
   * Affects balance calculation and approval routing
   */
  @Column({ type: 'varchar', length: 50 })
  locationId: string;

  /**
   * Policy type for this time-off request
   * Determines which balance to deduct from
   * Affects approval rules and notification routing
   */
  @Column({ type: 'varchar', length: 50 })
  policyType: string;

  /**
   * Current status of the time-off request
   * Drives workflow and business logic
   * Used for filtering and reporting
   */
  @Column({ 
    type: 'varchar', 
    length: 20,
    default: 'pending'
  })
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed' | 'expired';

  /**
   * Start date of time-off period
   * Used for business day calculations
   * Critical for overlap detection and scheduling
   */
  @Column({ type: 'date' })
  startDate: Date;

  /**
   * End date of time-off period
   * Inclusive end date for calculation purposes
   * Must be on or after start date
   */
  @Column({ type: 'date' })
  endDate: Date;

  /**
   * Number of days requested (calculated)
   * Includes business days or calendar days based on policy
   * Used for balance validation and tracking
   */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  requestedDays: number;

  /**
   * Number of days actually approved (may differ from requested)
   * Set during approval process
   * Used for final balance deduction
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  approvedDays?: number;

  /**
   * Reason for time-off request
   * Required for approval and audit purposes
   * Used for compliance and reporting
   */
  @Column({ type: 'varchar', length: 500 })
  reason: string;

  /**
   * Additional comments or notes
   * Optional field for extra context
   * Used for approval decisions and communication
   */
  @Column({ type: 'text', nullable: true })
  comments?: string;

  /**
   * Employee who approved the request
   * Foreign key to approver (could be employee ID or manager ID)
   * Set when status changes to approved
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  approverId?: string;

  /**
   * Name of approver for display purposes
   * Denormalized for performance in reporting
   * Set during approval process
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  approverName?: string;

  /**
   * Timestamp when request was approved
   * Used for approval SLA tracking
   * Set when status changes to approved
   */
  @Column({ type: 'datetime', nullable: true })
  approvedAt?: Date;

  /**
   * Reason for rejection (if rejected)
   * Required field for rejected requests
   * Used for employee communication
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  rejectionReason?: string;

  /**
   * Timestamp when request was rejected
   * Used for rejection tracking
   * Set when status changes to rejected
   */
  @Column({ type: 'datetime', nullable: true })
  rejectedAt?: Date;

  /**
   * Timestamp when request was cancelled
   * Used for cancellation tracking
   * Set when status changes to cancelled
   */
  @Column({ type: 'datetime', nullable: true })
  cancelledAt?: Date;

  /**
   * Reason for cancellation
   * Required field for cancelled requests
   * Used for audit trail
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  cancellationReason?: string;

  /**
   * External system reference identifier
   * Links to external systems (HCM, HRIS, etc.)
   * Used for cross-system data correlation
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  externalReference?: string;

  /**
   * HCM system request identifier
   * Links to corresponding HCM request record
   * Used for bidirectional synchronization
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  hcmRequestId?: string;

  /**
   * HCM system version of this request
   * Used for conflict detection during sync
   * Enables optimistic locking with HCM
   */
  @Column({ type: 'integer', default: 1 })
  hcmVersion: number;

  /**
   * Last synchronization timestamp with HCM
   * Critical for determining sync status
   * Used for conflict resolution
   */
  @Column({ type: 'datetime', nullable: true })
  lastSyncedAt?: Date;

  /**
   * Sync status with HCM system
   * Tracks synchronization state
   * Used for sync monitoring and retry logic
   */
  @Column({ 
    type: 'varchar', 
    length: 20,
    default: 'pending'
  })
  syncStatus: 'pending' | 'synced' | 'conflict' | 'failed';

  /**
   * Sync error message if sync failed
   * Used for troubleshooting and retry logic
   * Cleared on successful sync
   */
  @Column({ type: 'text', nullable: true })
  syncError?: string;

  /**
   * Number of sync retry attempts
   * Used for retry logic and monitoring
   * Reset on successful sync
   */
  @Column({ type: 'integer', default: 0 })
  syncRetries: number;

  /**
   * Balance snapshot at time of request
   * Captures balance state for audit purposes
   * Used for conflict detection and rollback
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  balanceAtRequest?: number;

  /**
   * Balance after request completion
   * Final balance after deduction
   * Used for audit and verification
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  balanceAfterCompletion?: number;

  /**
   * Priority level of the request
   * Used for approval routing and SLA tracking
   * Affects notification and escalation rules
   */
  @Column({ 
    type: 'varchar', 
    length: 20,
    default: 'normal'
  })
  priority: 'low' | 'normal' | 'high' | 'urgent';

  /**
   * Department or business unit
   * Used for reporting and approval routing
   * Affects workflow rules and notifications
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  department?: string;

  /**
   * Additional metadata in JSON format
   * Flexible storage for request-specific data
   * Can include policy exceptions, special conditions, etc.
   */
  @Column({ type: 'text', nullable: true })
  metadata?: string;

  /**
   * Record creation timestamp
   * Used for audit trail and analytics
   */
  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  /**
   * Record last update timestamp
   * Used for change tracking and sync delta detection
   */
  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  /**
   * Many-to-one relationship with employee balance
   * Enables efficient balance lookup and validation
   */
  @ManyToOne(() => CurrentBalance, balance => balance.requests)
  @JoinColumn([
    { name: 'employeeId', referencedColumnName: 'employeeId' },
    { name: 'locationId', referencedColumnName: 'locationId' },
    { name: 'policyType', referencedColumnName: 'policyType' }
  ])
  balance: CurrentBalance;

  // Business logic methods

  /**
   * Check if request is currently active
   * @returns True if request is approved and not expired
   */
  isActive(): boolean {
    return this.status === 'approved' && !this.isExpired();
  }

  /**
   * Check if request has expired
   * @returns True if end date is in the past
   */
  isExpired(): boolean {
    return new Date() > this.endDate;
  }

  /**
   * Check if request can be cancelled
   * @returns True if request can be cancelled
   */
  canBeCancelled(): boolean {
    return ['pending', 'approved'].includes(this.status) && !this.isExpired();
  }

  /**
   * Check if request is pending approval
   * @returns True if request is pending
   */
  isPending(): boolean {
    return this.status === 'pending';
  }

  /**
   * Check if request is approved
   * @returns True if request is approved
   */
  isApproved(): boolean {
    return this.status === 'approved';
  }

  /**
   * Check if request is rejected
   * @returns True if request is rejected
   */
  isRejected(): boolean {
    return this.status === 'rejected';
  }

  /**
   * Check if request is cancelled
   * @returns True if request is cancelled
   */
  isCancelled(): boolean {
    return this.status === 'cancelled';
  }

  /**
   * Calculate business days between start and end dates
   * @returns Number of business days
   */
  calculateBusinessDays(): number {
    let businessDays = 0;
    const currentDate = new Date(this.startDate);

    while (currentDate <= this.endDate) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Saturday or Sunday
        businessDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return businessDays;
  }

  /**
   * Approve the request
   * @param approverId - Approver identifier
   * @param approverName - Approver name
   * @param approvedDays - Days to approve (optional, defaults to requested)
   */
  approve(approverId: string, approverName: string, approvedDays?: number): void {
    this.status = 'approved';
    this.approverId = approverId;
    this.approverName = approverName;
    this.approvedDays = approvedDays || this.requestedDays;
    this.approvedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Reject the request
   * @param reason - Rejection reason
   */
  reject(reason: string): void {
    this.status = 'rejected';
    this.rejectionReason = reason;
    this.rejectedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Cancel the request
   * @param reason - Cancellation reason
   */
  cancel(reason: string): void {
    this.status = 'cancelled';
    this.cancellationReason = reason;
    this.cancelledAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Mark as completed
   * @param finalBalance - Balance after completion
   */
  complete(finalBalance?: number): void {
    this.status = 'completed';
    this.balanceAfterCompletion = finalBalance;
    this.updatedAt = new Date();
  }

  /**
   * Check if request overlaps with another request
   * @param otherRequest - Another time-off request
   * @returns True if dates overlap
   */
  overlapsWith(otherRequest: TimeOffRequest): boolean {
    return this.startDate <= otherRequest.endDate && 
           this.endDate >= otherRequest.startDate &&
           this.employeeId === otherRequest.employeeId &&
           this.locationId === otherRequest.locationId;
  }

  /**
   * Get request summary for API responses
   * @returns Request summary object
   */
  getSummary(): {
    id: number;
    requestId: string;
    employeeId: string;
    locationId: string;
    policyType: string;
    status: string;
    startDate: string;
    endDate: string;
    requestedDays: number;
    approvedDays?: number;
    reason: string;
    priority: string;
    createdAt: string;
    updatedAt: string;
  } {
    return {
      id: this.id,
      requestId: this.requestId,
      employeeId: this.employeeId,
      locationId: this.locationId,
      policyType: this.policyType,
      status: this.status,
      startDate: this.startDate.toISOString().split('T')[0],
      endDate: this.endDate.toISOString().split('T')[0],
      requestedDays: this.requestedDays,
      approvedDays: this.approvedDays,
      reason: this.reason,
      priority: this.priority,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  /**
   * Validate request constraints
   * @throws Error if validation fails
   */
  validate(): void {
    if (!this.requestId || this.requestId.trim().length === 0) {
      throw new BadRequestException('Request ID is required');
    }
    
    if (!this.employeeId || this.employeeId.trim().length === 0) {
      throw new BadRequestException('Employee ID is required');
    }
    
    if (!this.locationId || this.locationId.trim().length === 0) {
      throw new BadRequestException('Location ID is required');
    }
    
    if (!this.policyType || this.policyType.trim().length === 0) {
      throw new BadRequestException('Policy type is required');
    }
    
    if (!this.startDate) {
      throw new BadRequestException('Start date is required');
    }
    
    if (!this.endDate) {
      throw new BadRequestException('End date is required');
    }
    
    if (this.startDate > this.endDate) {
      throw new BadRequestException('Start date must be on or before end date');
    }
    
    if (this.requestedDays <= 0) {
      throw new BadRequestException('Requested days must be positive');
    }
    
    if (!this.reason || this.reason.trim().length === 0) {
      throw new BadRequestException('Reason is required');
    }
    
    if (this.approvedDays !== null && this.approvedDays <= 0) {
      throw new BadRequestException('Approved days must be positive');
    }
  }

  /**
   * Mark as synchronized with HCM
   * @param hcmVersion - HCM version number
   */
  markAsSynchronized(hcmVersion: number): void {
    this.lastSyncedAt = new Date();
    this.hcmVersion = hcmVersion;
    this.syncStatus = 'synced';
    this.syncError = null;
    this.syncRetries = 0;
    this.updatedAt = new Date();
  }

  /**
   * Mark sync as failed
   * @param error - Error message
   */
  markSyncFailed(error: string): void {
    this.syncStatus = 'failed';
    this.syncError = error;
    this.syncRetries++;
    this.updatedAt = new Date();
  }

  /**
   * Reset sync status for retry
   */
  resetSyncStatus(): void {
    this.syncStatus = 'pending';
    this.syncError = null;
    this.updatedAt = new Date();
  }
}
