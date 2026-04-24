import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { CurrentBalance } from './current-balance.entity';
import { BalanceHistory } from './balance-history.entity';

/**
 * Employee Entity
 * 
 * Represents an employee in the system with their basic information.
 * This entity serves as the foundation for all time-off related operations.
 * 
 * Why this entity exists:
 * - Central employee information storage
 * - Links to balance and history records
 * - Supports multi-location employees
 * - Enables employee status tracking
 */
@Entity('employees')
@Index(['employeeId']) // Fast lookup by employee ID
@Index(['locationId']) // Fast filtering by location
@Index(['isActive']) // Quick filtering for active employees
export class Employee {
  /**
   * Primary key for internal database operations
   * Auto-incrementing for optimal performance
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * External employee identifier from HCM system
   * Must be unique across all locations
   * Used for HCM synchronization and API lookups
   */
  @Column({ type: 'varchar', length: 50, unique: true })
  employeeId: string;

  /**
   * Location identifier where employee belongs
   * Employees can have multiple locations (handled via separate records)
   * Critical for policy application and balance segregation
   */
  @Column({ type: 'varchar', length: 50 })
  locationId: string;

  /**
   * Employee's first name
   * Used for display and audit purposes
   */
  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  /**
   * Employee's last name
   * Used for display and audit purposes
   */
  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  /**
   * Employee's email address
   * Used for notifications and authentication
   * Must be valid email format (validated at application level)
   */
  @Column({ type: 'varchar', length: 255 })
  email: string;

  /**
   * Employee status indicator
   * Determines if employee can request time-off
   * Inactive employees cannot make requests but history is preserved
   */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * Timestamp when employee record was created
   * Automatically managed by TypeORM
   */
  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  /**
   * Timestamp when employee record was last updated
   * Automatically managed by TypeORM
   */
  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;

  // Relationships

  /**
   * One-to-many relationship with current balances
   * An employee can have multiple balance records (one per policy type)
   */
  @OneToMany(() => CurrentBalance, balance => balance.employee)
  balances: CurrentBalance[];

  /**
   * One-to-many relationship with balance history
   * Tracks all balance changes for audit and compliance
   */
  @OneToMany(() => BalanceHistory, history => history.employee)
  history: BalanceHistory[];

  // Computed properties

  /**
   * Full name computed from first and last name
   * Not stored in database, computed on access
   */
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  /**
   * Validates employee data before database operations
   * Ensures data integrity at entity level
   */
  validate(): void {
    if (!this.employeeId || this.employeeId.trim().length === 0) {
      throw new Error('Employee ID is required');
    }
    
    if (!this.locationId || this.locationId.trim().length === 0) {
      throw new Error('Location ID is required');
    }
    
    if (!this.email || !this.isValidEmail(this.email)) {
      throw new Error('Valid email is required');
    }
  }

  /**
   * Basic email validation
   * In production, consider using a more robust validator
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
