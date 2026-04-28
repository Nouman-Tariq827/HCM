import { Entity, PrimaryGeneratedColumn, Column, Index, Unique, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Time Off Policy Entity
 * 
 * Stores policy configurations for each location and policy type.
 * This entity governs how time-off requests are validated and processed.
 * 
 * Why this entity exists:
 * - Centralized policy management per location
 * - Enables flexible policy configuration
 * - Supports different rules per location
 * - Provides audit trail for policy changes
 */
@Entity('time_off_policies')
@Unique(['locationId', 'policyType']) // Prevent duplicate policy records
@Index(['locationId', 'policyType']) // Fast policy lookups
export class TimeOffPolicy {
  /**
   * Primary key for internal database operations
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Location identifier
   * Policies are location-specific to support regional differences
   */
  @Column({ type: 'varchar', length: 50 })
  locationId: string;

  /**
   * Policy type identifier
   * Examples: vacation, sick, personal, bereavement, etc.
   */
  @Column({ type: 'varchar', length: 50 })
  policyType: string;

  /**
   * Maximum days allowed per year for this policy
   * Used for validation and balance limits
   */
  @Column({ type: 'integer' })
  maxDaysPerYear: number;

  /**
   * Minimum notice period in days
   * Employees must request time-off this many days in advance
   * 0 means no notice requirement
   */
  @Column({ type: 'integer', default: 0 })
  minNoticeDays: number;

  /**
   * Monthly accrual rate
   * How many days are earned each month
   * Null for policies that don't accrue (e.g., fixed annual allocation)
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  accrualRate: number;

  /**
   * Expiration policy for unused days
   * Examples: use_it_or_lose_it, rollover_max_30_days, carry_forward_all
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  expirationPolicy: string;

  /**
   * Whether fractional days are allowed
   * Some policies only allow whole days
   */
  @Column({ type: 'boolean', default: true })
  allowsFractionalDays: boolean;

  /**
   * Maximum consecutive days allowed
   * Prevents excessively long time-off periods
   * Null means no limit
   */
  @Column({ type: 'integer', nullable: true })
  maxConsecutiveDays: number;

  /**
   * Whether manager approval is required
   * Some policies may be auto-approved
   */
  @Column({ type: 'boolean', default: true })
  requiresManagerApproval: boolean;

  /**
   * Whether HR approval is required
   * For sensitive or extended time-off requests
   */
  @Column({ type: 'boolean', default: false })
  requiresHRApproval: boolean;

  /**
   * Blackout dates when this policy cannot be used
   * JSON array of date ranges (e.g., peak season)
   * Format: [{"start":"2024-12-20","end":"2024-12-31"}]
   */
  @Column({ type: 'text', nullable: true })
  blackoutDates: string;

  /**
   * Policy description
   * Human-readable description of policy rules
   */
  @Column({ type: 'text', nullable: true })
  description: string;

  /**
   * Whether this policy is currently active
   * Disabled policies cannot be used for new requests
   */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

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
   * Validates if a request meets minimum notice requirements
   * @param requestDate - Date of time-off request
   * @param currentDate - Current date (defaults to now)
   * @returns True if notice requirement is met
   */
  meetsNoticeRequirement(requestDate: Date, currentDate: Date = new Date()): boolean {
    if (this.minNoticeDays === 0) {
      return true; // No notice requirement
    }
    
    const noticePeriodMs = this.minNoticeDays * 24 * 60 * 60 * 1000;
    const timeDifference = requestDate.getTime() - currentDate.getTime();
    
    return timeDifference >= noticePeriodMs;
  }

  /**
   * Validates if requested days exceed maximum allowed
   * @param requestedDays - Number of days requested
   * @returns True if within limits
   */
  isWithinMaxDays(requestedDays: number): boolean {
    if (!this.maxConsecutiveDays) {
      return true; // No limit
    }
    
    return requestedDays <= this.maxConsecutiveDays;
  }

  /**
   * Validates if fractional days are allowed for this policy
   * @param requestedDays - Number of days requested
   * @returns True if fractional days are allowed or request is whole days
   */
  allowsRequestedFraction(requestedDays: number): boolean {
    if (this.allowsFractionalDays) {
      return true;
    }
    
    // Check if request is whole days
    return Number.isInteger(requestedDays);
  }

  /**
   * Checks if a date falls within blackout periods
   * @param date - Date to check
   * @returns True if date is in blackout period
   */
  isBlackoutDate(date: Date): boolean {
    if (!this.blackoutDates) {
      return false; // No blackout dates configured
    }
    
    try {
      const blackoutPeriods = JSON.parse(this.blackoutDates);
      const checkDate = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      return blackoutPeriods.some((period: any) => {
        const start = new Date(period.start).toISOString().split('T')[0];
        const end = new Date(period.end).toISOString().split('T')[0];
        
        return checkDate >= start && checkDate <= end;
      });
    } catch (error) {
      // Invalid JSON - treat as no blackout dates
      return false;
    }
  }

  /**
   * Calculates maximum rollover days based on expiration policy
   * @returns Maximum rollover days allowed
   */
  getMaxRolloverDays(): number {
    if (!this.expirationPolicy) {
      return 0; // No rollover by default
    }
    
    switch (this.expirationPolicy) {
      case 'use_it_or_lose_it':
        return 0;
      case 'rollover_max_30_days':
        return 30;
      case 'rollover_max_60_days':
        return 60;
      case 'carry_forward_all':
        return this.maxDaysPerYear; // No limit
      default:
        return 0;
    }
  }

  /**
   * Validates policy data integrity
   * @throws Error if validation fails
   */
  validate(): void {
    if (!this.locationId || this.locationId.trim().length === 0) {
      throw new Error('Location ID is required');
    }
    
    if (!this.policyType || this.policyType.trim().length === 0) {
      throw new Error('Policy type is required');
    }
    
    if (this.maxDaysPerYear <= 0) {
      throw new Error('Max days per year must be positive');
    }
    
    if (this.minNoticeDays < 0) {
      throw new Error('Min notice days cannot be negative');
    }
    
    if (this.accrualRate !== null && this.accrualRate <= 0) {
      throw new Error('Accrual rate must be positive when specified');
    }
    
    if (this.maxConsecutiveDays !== null && this.maxConsecutiveDays <= 0) {
      throw new Error('Max consecutive days must be positive when specified');
    }
  }

  /**
   * Returns a summary of key policy rules
   * Useful for API responses and user notifications
   */
  getPolicySummary(): string {
    const rules = [];
    
    if (this.minNoticeDays > 0) {
      rules.push(`${this.minNoticeDays} days notice required`);
    }
    
    if (this.maxConsecutiveDays) {
      rules.push(`Max ${this.maxConsecutiveDays} consecutive days`);
    }
    
    if (!this.allowsFractionalDays) {
      rules.push('Whole days only');
    }
    
    if (this.requiresManagerApproval) {
      rules.push('Manager approval required');
    }
    
    if (this.requiresHRApproval) {
      rules.push('HR approval required');
    }
    
    return rules.length > 0 ? rules.join(', ') : 'No special restrictions';
  }
}
