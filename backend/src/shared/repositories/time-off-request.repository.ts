import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { BaseRepository } from './base.repository';
import { TimeOffRequest } from '../entities/time-off-request.entity';

/**
 * Time Off Request Repository
 * 
 * Handles all database operations for time-off requests.
 * This repository manages the lifecycle of requests and ensures data integrity.
 * 
 * Why this exists:
 * - Centralizes all time-off request database operations
 * - Provides optimized queries for request workflows
 * - Ensures data consistency during request processing
 */
export class TimeOffRequestRepository extends BaseRepository<TimeOffRequest> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(dataSource, TimeOffRequest, 'time_off_request');
  }

  /**
   * Find a request by its unique identifier
   * @param requestId - Unique request ID
   * @returns Request or null
   */
  async findByRequestId(requestId: string): Promise<TimeOffRequest | null> {
    return this.findOne({ requestId });
  }

  /**
   * Find overlapping requests for an employee
   * @param employeeId - Employee identifier
   * @param locationId - Location identifier
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Array of overlapping requests
   */
  async findOverlappingRequests(
    employeeId: string,
    locationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TimeOffRequest[]> {
    return this.repository
      .createQueryBuilder('request')
      .where('request.employeeId = :employeeId', { employeeId })
      .andWhere('request.locationId = :locationId', { locationId })
      .andWhere('request.status IN (:...statuses)', { statuses: ['pending', 'approved'] })
      .andWhere('request.startDate <= :endDate', { endDate })
      .andWhere('request.endDate >= :startDate', { startDate })
      .getMany();
  }
}
