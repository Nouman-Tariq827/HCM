import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { BaseRepository } from './base.repository';
import { TimeOffPolicy } from '../entities/time-off-policy.entity';

/**
 * Time Off Policy Repository
 * 
 * Handles all database operations for time-off policies.
 * This repository provides access to company-wide and location-specific policies.
 * 
 * Why this exists:
 * - Centralizes all policy database operations
 * - Enables efficient policy lookups
 * - Supports policy management workflows
 */
export class TimeOffPolicyRepository extends BaseRepository<TimeOffPolicy> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(dataSource, TimeOffPolicy, 'time_off_policy');
  }

  /**
   * Find a policy by location and type
   * @param locationId - Location identifier
   * @param policyType - Policy type
   * @returns Policy or null
   */
  async findByLocationAndType(locationId: string, policyType: string): Promise<TimeOffPolicy | null> {
    return this.findOne({ locationId, policyType });
  }

  /**
   * Find all policies for a location
   * @param locationId - Location identifier
   * @returns Array of policies
   */
  async findByLocation(locationId: string): Promise<TimeOffPolicy[]> {
    return this.findMany({ where: { locationId } });
  }
}
