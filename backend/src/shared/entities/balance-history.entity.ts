import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Employee } from './employee.entity';

/**
 * Balance History Entity
 * 
 * Stores the complete audit trail of all balance changes.
 * This entity is critical for compliance, debugging, and reporting.
 * 
 * Why this entity exists:
 * - Complete audit trail for all balance operations
 * - Supports historical reporting and analytics
 * - Enables rollback capabilities for errors
 * - Provides compliance documentation
 */
@Entity('balance_history')
@Index(['employeeId', 'policyType']) // Fast employee-policy history lookups
@Index(['transactionType']) // Filter by transaction type
@Index(['createdAt']) // Time-based queries and cleanup
export class BalanceHistory {
  /**
   * Primary key for internal database operations
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Employee identifier
   * Links to the employees table
   */
  @Column({ type: 'varchar', length: 50 })
  employeeId: string;

  /**
   * Location identifier
   * Critical for policy context
   */
  @Column({ type: 'varchar', length: 50 })
  locationId: string;

  /**
   * Policy type for this history record
   */
  @Column({ type: 'varchar', length: 50 })
  policyType: string;

  /**
   * Balance before the transaction
   * Used for rollback and audit verification
   */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  balanceBefore: number;

  /**
   * Balance after the transaction
   * Final state after applying the change
   */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  balanceAfter: number;

  /**
   * Amount of change (can be positive or negative)
   * Positive for additions, negative for deductions
   */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  changeAmount: number;

  /**
   * Type of transaction that caused the balance change
   * Examples: deduction, refund, adjustment, accrual
   */
  @Column({ type: 'varchar', length: 50 })
  transactionType: string;

  /**
   * External reference identifier
   * Links to external systems (HCM, time-off requests, etc.)
   * Optional - not all transactions have external references
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceId: string;

  /**
   * Human-readable reason for the balance change
   * Important for audit and user understanding
   */
  @Column({ type: 'text', nullable: true })
  reason: string;

  /**
   * Source system that initiated the transaction
   * Examples: readyon, hcm_sync, manual_adjustment
   * Critical for tracking data provenance
   */
  @Column({ type: 'varchar', length: 50 })
  sourceSystem: string;

  /**
   * Record creation timestamp
   */
  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  // Relationships

  /**
   * Many-to-one relationship with Employee
   * Establishes foreign key constraint
   */
  @ManyToOne(() => Employee, employee => employee.history)
  @JoinColumn([
    { name: 'employeeId', referencedColumnName: 'employeeId' },
    { name: 'locationId', referencedColumnName: 'locationId' }
  ])
  employee: Employee;

  // Business logic methods

  /**
   * Validates the mathematical integrity of the balance change
   * Ensures balanceAfter = balanceBefore + changeAmount
   */
  validateBalanceIntegrity(): boolean {
    const expectedAfter = this.balanceBefore + this.changeAmount;
    const tolerance = 0.01; // Allow for floating point precision
    
    return Math.abs(this.balanceAfter - expectedAfter) <= tolerance;
  }

  /**
   * Determines if this is a deduction transaction
   */
  isDeduction(): boolean {
    return this.changeAmount < 0;
  }

  /**
   * Determines if this is an addition transaction
   */
  isAddition(): boolean {
    return this.changeAmount > 0;
  }

  /**
   * Checks if this transaction was initiated by external system
   */
  isFromExternalSystem(): boolean {
    return this.sourceSystem !== 'readyon';
  }

  /**
   * Creates a reverse transaction for rollback purposes
   * @returns New BalanceHistory record that reverses this transaction
   */
  createRollbackTransaction(): BalanceHistory {
    const rollback = new BalanceHistory();
    rollback.employeeId = this.employeeId;
    rollback.locationId = this.locationId;
    rollback.policyType = this.policyType;
    rollback.balanceBefore = this.balanceAfter;
    rollback.balanceAfter = this.balanceBefore;
    rollback.changeAmount = -this.changeAmount;
    rollback.transactionType = 'rollback';
    rollback.referenceId = `rollback_${this.id}`;
    rollback.reason = `Rollback of transaction ${this.id}: ${this.reason}`;
    rollback.sourceSystem = 'readyon';
    
    return rollback;
  }

  /**
   * Validates history record data integrity
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
    
    if (!this.transactionType || this.transactionType.trim().length === 0) {
      throw new Error('Transaction type is required');
    }
    
    if (!this.sourceSystem || this.sourceSystem.trim().length === 0) {
      throw new Error('Source system is required');
    }
    
    if (!this.validateBalanceIntegrity()) {
      throw new Error('Balance integrity validation failed');
    }
  }

  /**
   * Returns a formatted description of the transaction
   * Useful for audit logs and user notifications
   */
  getTransactionDescription(): string {
    const action = this.isDeduction() ? 'Deducted' : 'Added';
    const days = Math.abs(this.changeAmount);
    
    return `${action} ${days} ${this.policyType} days. Reason: ${this.reason || 'No reason provided'}`;
  }
}
