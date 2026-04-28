import { Entity, PrimaryGeneratedColumn, Column, Index, Unique, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Employee } from './employee.entity';
import { TimeOffRequest } from './time-off-request.entity';

/**
 * Current Balance Entity
 * 
 * Stores the current time-off balance for each employee per policy type and location.
 * This is the primary entity for balance queries and updates.
 * 
 * Why this entity exists:
 * - Fast balance lookups for validation
 * - Supports concurrent balance operations
 * - Tracks synchronization state with HCM
 * - Enables version-based conflict resolution
 */
@Entity('current_balances')
@Unique(['employeeId', 'locationId', 'policyType']) // Prevent duplicate balance records
@Index(['employeeId', 'policyType']) // Fast employee-policy lookups
@Index(['lastSyncAt']) // Sync status monitoring
export class CurrentBalance {
  /**
   * Primary key for internal database operations
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Employee identifier (foreign key reference)
   * Links to the employees table
   */
  @Column({ type: 'varchar', length: 50 })
  employeeId: string;

  /**
   * Location identifier
   * Critical for policy application and balance segregation
   */
  @Column({ type: 'varchar', length: 50 })
  locationId: string;

  /**
   * Policy type for this balance record
   * Examples: vacation, sick, personal, etc.
   */
  @Column({ type: 'varchar', length: 50 })
  policyType: string;

  /**
   * Current available balance in days
   * Can support fractional days (0.5 increments)
   * Never negative - enforced at application level
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  currentBalance: number;

  /**
   * Timestamp of last HCM synchronization
   * Null if never synchronized
   * Used for staleness detection
   */
  @Column({ type: 'datetime', nullable: true })
  lastSyncAt: Date;

  /**
   * Version number for optimistic locking
   * Incremented on each update
   * Critical for conflict resolution
   */
  @Column({ type: 'integer', default: 0 })
  syncVersion: number;

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

  // Relationships

  /**
   * Many-to-one relationship with Employee
   * Establishes foreign key constraint
   */
  @ManyToOne(() => Employee, employee => employee.balances)
  @JoinColumn([
    { name: 'employeeId', referencedColumnName: 'employeeId' },
    { name: 'locationId', referencedColumnName: 'locationId' }
  ])
  employee: Employee;

  /**
   * One-to-many relationship with time-off requests
   * Enables efficient querying of requests for this balance
   */
  @OneToMany(() => TimeOffRequest, request => request.balance)
  requests: TimeOffRequest[];

  // Business logic methods

  /**
   * Checks if balance is sufficient for requested deduction
   * @param requestedDays - Days requested for time-off
   * @returns True if sufficient balance
   */
  hasSufficientBalance(requestedDays: number): boolean {
    return this.currentBalance >= requestedDays;
  }

  /**
   * Deducts specified days from balance
   * @param days - Number of days to deduct
   * @throws Error if insufficient balance
   */
  deduct(days: number): void {
    if (!this.hasSufficientBalance(days)) {
      throw new Error(`Insufficient balance. Available: ${this.currentBalance}, Requested: ${days}`);
    }
    
    this.currentBalance -= days;
    this.incrementVersion();
  }

  /**
   * Adds specified days to balance
   * @param days - Number of days to add
   */
  add(days: number): void {
    this.currentBalance += days;
    this.incrementVersion();
  }

  /**
   * Increments sync version for conflict detection
   * Called on every balance modification
   */
  private incrementVersion(): void {
    this.syncVersion++;
  }

  /**
   * Checks if balance data is stale based on configured TTL
   * @param staleThresholdMs - Staleness threshold in milliseconds
   * @returns True if data is considered stale
   */
  isStale(staleThresholdMs: number = 300000): boolean { // 5 minutes default
    if (!this.lastSyncAt) {
      return true; // Never synced
    }
    
    const now = new Date();
    const timeSinceSync = now.getTime() - this.lastSyncAt.getTime();
    return timeSinceSync > staleThresholdMs;
  }

  /**
   * Validates balance data integrity
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
    
    if (this.syncVersion < 0) {
      throw new Error('Sync version cannot be negative');
    }
  }

  /**
   * Creates a copy of the balance record
   * Useful for audit trails and version tracking
   */
  clone(): CurrentBalance {
    const clone = new CurrentBalance();
    clone.employeeId = this.employeeId;
    clone.locationId = this.locationId;
    clone.policyType = this.policyType;
    clone.currentBalance = this.currentBalance;
    clone.lastSyncAt = this.lastSyncAt;
    clone.syncVersion = this.syncVersion;
    return clone;
  }
}
