import { DataSource, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { BaseRepository } from './base.repository';
import { BalanceHistory } from '../entities/balance-history.entity';

/**
 * Balance History Repository
 * 
 * Handles all balance history database operations.
 * This repository provides audit trails and historical reporting for balance changes.
 * 
 * Why this exists:
 * - Centralizes all balance history database operations
 * - Provides optimized historical queries
 * - Supports compliance and auditing requirements
 */
export class BalanceHistoryRepository extends BaseRepository<BalanceHistory> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(dataSource, BalanceHistory, 'balance_history');
  }

  /**
   * Create a new history record
   * @param data - History record data
   * @returns Created history record
   */
  async createHistoryRecord(data: {
    employeeId: string;
    locationId: string;
    policyType: string;
    balanceBefore: number;
    balanceAfter: number;
    changeAmount: number;
    transactionType: string;
    referenceId?: string;
    reason: string;
    sourceSystem: string;
  }): Promise<BalanceHistory> {
    return this.create(data);
  }

  /**
   * Find history records by reference ID
   * @param referenceId - Reference identifier
   * @returns Array of history records
   */
  async findByReferenceId(referenceId: string): Promise<BalanceHistory[]> {
    return this.findMany({ where: { referenceId } });
  }

  /**
   * Find history records for an employee with pagination and filtering
   * @param employeeId - Employee identifier
   * @param locationId - Location identifier
   * @param options - Query options (pagination, filters)
   * @returns Paginated history records
   */
  async findByEmployeeWithPagination(
    employeeId: string,
    locationId: string,
    options: {
      policyType?: string;
      transactionType?: string;
      startDate?: Date;
      endDate?: Date;
      page: number;
      limit: number;
    }
  ): Promise<{
    data: BalanceHistory[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const where: FindOptionsWhere<BalanceHistory> = {
      employeeId,
      locationId,
    };

    if (options.policyType) {
      where.policyType = options.policyType;
    }

    if (options.transactionType) {
      where.transactionType = options.transactionType;
    }

    if (options.startDate) {
      where.createdAt = MoreThanOrEqual(options.startDate);
    }

    if (options.endDate) {
      where.createdAt = LessThanOrEqual(options.endDate);
    }

    const [data, total] = await this.repository.findAndCount({
      where,
      order: { createdAt: 'DESC' } as any,
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    });

    return {
      data,
      total,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil(total / options.limit),
    };
  }
}
