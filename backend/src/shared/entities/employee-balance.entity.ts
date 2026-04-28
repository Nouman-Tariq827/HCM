import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { TimeOffRequest } from './time-off-request.entity';

/**
 * EmployeeBalance Entity
 * 
 * Represents the current time-off balance for an employee at a specific location
 * for a particular policy type. This entity is the core data model for balance
 * management and synchronization with the HCM system.
 * 
 * Why this exists:
 * - Stores per-employee, per-location, per-policy balances
 * - Supports optimistic locking for concurrent operations
 * - Enables synchronization tracking with HCM system
 * - Provides audit trail through versioning
 * - Supports performance with strategic indexing
 */
@Entity('employee_balances')
@Index(['employeeId', 'locationId', 'policyType'], { unique: true }) // Composite unique key for balance lookup
@Index(['employeeId']) // Fast lookup by employee
@Index(['locationId']) // Fast filtering by location
@Index(['policyType']) // Fast filtering by policy type
@Index(['lastSyncedAt']) // Efficient sync queries
@Index(['isStale']) // Quick identification of stale balances
@Index(['updatedAt']) // Performance for recent changes
export class EmployeeBalance {
  /**
   * Primary key for internal database operations
   * Auto-incrementing for optimal performance
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * External employee identifier from HCM system
   * Must be unique across all locations for proper HCM integration
   * Used for synchronization and API lookups
   */
  @Column({ type: 'varchar', length: 50 })
  employeeId: string;

  /**
   * Location identifier where employee belongs
   * Critical for multi-location organizations
   * Employees can have different balances per location
   */
  @Column({ type: 'varchar', length: 50 })
  locationId: string;

  /**
   * Type of time-off policy (vacation, sick, personal, bereavement)
   * Enables separate balance tracking per policy type
   * Supports different accrual rules and limits per policy
   */
  @Column({ type: 'varchar', length: 50 })
  policyType: string;

  /**
   * Current available balance in days
   * Can include fractional days (0.5 increments)
   * Negative values indicate overdrawn balances (if allowed)
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  currentBalance: number;

  /**
   * Maximum allowed balance for this policy
   * Prevents excessive balance accumulation
   * Enforced by business logic in service layer
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxBalance?: number;

  /**
   * Last synchronization timestamp with HCM system
   * Critical for determining data freshness
   * Used for stale balance detection and sync scheduling
   */
  @Column({ type: 'datetime', nullable: true })
  lastSyncedAt?: Date;

  /**
   * HCM system version of this balance record
   * Used for conflict detection during synchronization
   * Enables optimistic locking with external system
   */
  @Column({ type: 'integer', default: 1 })
  hcmVersion: number;

  /**
   * Internal version for optimistic locking
   * Prevents concurrent modification conflicts
   * Incremented on each update operation
   */
  @Column({ type: 'integer', default: 1 })
  version: number;

  /**
   * Flag indicating if balance data is stale
   * Computed based on lastSyncedAt and TTL
   * Used for performance optimization and sync prioritization
   */
  @Column({ type: 'boolean', default: false })
  isStale: boolean;

  /**
   * Timestamp when balance becomes stale
   * Calculated based on business rules and sync frequency
   * Used for automated sync scheduling
   */
  @Column({ type: 'datetime', nullable: true })
  staleAt?: Date;

  /**
   * HCM system source identifier
   * Tracks which HCM instance provided this data
   * Important for multi-HCM environments
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  hcmSource?: string;

  /**
   * Additional metadata in JSON format
   * Flexible storage for policy-specific data
   * Can include accrual rates, carry-over rules, etc.
   */
  @Column({ type: 'text', nullable: true })
  metadata?: string;

  /**
   * Record creation timestamp
   * Used for audit trail and history tracking
   */
  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  /**
   * Record last update timestamp
   * Used for change tracking and delta detection
   */
  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  /**
   * One-to-many relationship with time-off requests
   * Enables efficient querying of employee requests
   */
  @OneToMany(() => TimeOffRequest, request => request.balance)
  requests: TimeOffRequest[];

  // Business logic methods

  /**
   * Check if employee has sufficient balance for requested days
   * @param requestedDays - Days requested for time-off
   * @returns True if sufficient balance
   */
  hasSufficientBalance(requestedDays: number): boolean {
    return this.currentBalance >= requestedDays;
  }

  /**
   * Get remaining balance after deducting requested days
   * @param requestedDays - Days to deduct
   * @returns Remaining balance
   */
  getRemainingBalance(requestedDays: number): number {
    return this.currentBalance - requestedDays;
  }

  /**
   * Check if balance is stale based on TTL
   * @param staleThresholdMs - Staleness threshold in milliseconds
   * @returns True if stale
   */
  isStaleByThreshold(staleThresholdMs: number = 300000): boolean {
    if (!this.lastSyncedAt) {
      return true; // Never synced is stale
    }
    
    const now = new Date();
    const timeSinceSync = now.getTime() - this.lastSyncedAt.getTime();
    return timeSinceSync > staleThresholdMs;
  }

  /**
   * Check if balance exceeds maximum allowed
   * @param additionalDays - Days to add (optional)
   * @returns True if exceeds maximum
   */
  exceedsMaxBalance(additionalDays: number = 0): boolean {
    if (!this.maxBalance) {
      return false; // No maximum set
    }
    
    return (this.currentBalance + additionalDays) > this.maxBalance;
  }

  /**
   * Update balance with version increment
   * @param newBalance - New balance value
   * @param incrementVersion - Whether to increment version
   */
  updateBalance(newBalance: number, incrementVersion: boolean = true): void {
    this.currentBalance = newBalance;
    if (incrementVersion) {
      this.version++;
    }
    this.updatedAt = new Date();
  }

  /**
   * Mark as synchronized with HCM
   * @param hcmVersion - HCM version number
   * @param hcmSource - HCM source identifier
   */
  markAsSynchronized(hcmVersion: number, hcmSource?: string): void {
    this.lastSyncedAt = new Date();
    this.hcmVersion = hcmVersion;
    this.hcmSource = hcmSource;
    this.isStale = false;
    this.staleAt = null;
    this.updatedAt = new Date();
  }

  /**
   * Mark as stale for resynchronization
   * @param staleAt - When it became stale (optional)
   */
  markAsStale(staleAt?: Date): void {
    this.isStale = true;
    this.staleAt = staleAt || new Date();
    this.updatedAt = new Date();
  }

  /**
   * Get metadata as object
   * @returns Parsed metadata object
   */
  getMetadata(): any {
    if (!this.metadata) {
      return {};
    }
    
    try {
      return JSON.parse(this.metadata);
    } catch (error) {
      return {};
    }
  }

  /**
   * Set metadata from object
   * @param data - Metadata object to store
   */
  setMetadata(data: any): void {
    this.metadata = JSON.stringify(data);
  }

  /**
   * Validate balance constraints
   * @throws Error if validation fails
   */
  validate(): void {
    if (!this.employeeId || this.employeeId.trim().length === 0) {
      throw new Error('Employee ID is required');
    }
    
    if (!this.locationId || this.locationId.trim().length === 0) {
      throw new Error('Location ID is required');
    }
    
    if (!this.policyType || this.policyType.trim().length === 0) {
      throw new Error('Policy type is required');
    }
    
    if (this.currentBalance < 0) {
      throw new Error('Balance cannot be negative');
    }
    
    if (this.maxBalance !== null && this.maxBalance < 0) {
      throw new Error('Maximum balance cannot be negative');
    }
    
    if (this.version < 0) {
      throw new Error('Version cannot be negative');
    }
    
    if (this.hcmVersion < 0) {
      throw new Error('HCM version cannot be negative');
    }
  }

  /**
   * Get balance summary for API responses
   * @returns Balance summary object
   */
  getSummary(): {
    employeeId: string;
    locationId: string;
    policyType: string;
    currentBalance: number;
    maxBalance?: number;
    lastSyncedAt?: string;
    isStale: boolean;
    version: number;
  } {
    return {
      employeeId: this.employeeId,
      locationId: this.locationId,
      policyType: this.policyType,
      currentBalance: this.currentBalance,
      maxBalance: this.maxBalance,
      lastSyncedAt: this.lastSyncedAt?.toISOString(),
      isStale: this.isStale,
      version: this.version,
    };
  }
}
