import { DataSource, FindOptionsWhere } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { BaseRepository } from './base.repository';
import { CurrentBalance } from '../entities/current-balance.entity';
import { BalanceHistory } from '../entities/balance-history.entity';

/**
 * Balance Repository
 * 
 * Handles all balance-related database operations including current balances
 * and historical records. This repository enforces business rules at the data layer.
 * 
 * Why this exists:
 * - Centralizes all balance database operations
 * - Enforces data integrity constraints
 * - Provides optimized balance queries
 * - Handles balance history tracking
 */
export class BalanceRepository extends BaseRepository<CurrentBalance> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(dataSource, CurrentBalance, 'current_balance');
  }

  /**
   * Find current balance by employee, location, and policy type
   * @param employeeId - Employee identifier
   * @param locationId - Location identifier
   * @param policyType - Policy type
   * @returns Current balance or null if not found
   */
  async findByEmployeeLocationPolicy(
    employeeId: string,
    locationId: string,
    policyType: string
  ): Promise<CurrentBalance | null> {
    return this.findOne({
      employeeId,
      locationId,
      policyType,
    });
  }

  /**
   * Find all balances for an employee
   * @param employeeId - Employee identifier
   * @param locationId - Location identifier (optional)
   * @returns Array of current balances
   */
  async findByEmployee(
    employeeId: string,
    locationId?: string
  ): Promise<CurrentBalance[]> {
    const where: FindOptionsWhere<CurrentBalance> = { employeeId };
    if (locationId) {
      where.locationId = locationId;
    }

    return this.findMany({
      where,
      order: { policyType: 'ASC' },
    });
  }

  /**
   * Update balance with optimistic locking
   * @param employeeId - Employee identifier
   * @param locationId - Location identifier
   * @param policyType - Policy type
   * @param newBalance - New balance value
   * @param expectedVersion - Expected version for optimistic locking
   * @returns Updated balance or null if version mismatch
   */
  async updateWithVersion(
    employeeId: string,
    locationId: string,
    policyType: string,
    newBalance: number,
    expectedVersion: number
  ): Promise<CurrentBalance | null> {
    return this.withTransaction(async (manager) => {
      const repository = manager.getRepository(CurrentBalance);
      
      // Update with version check
      const result = await repository
        .createQueryBuilder()
        .update(CurrentBalance)
        .set({
          currentBalance: newBalance,
          syncVersion: () => 'sync_version + 1',
          updatedAt: () => 'CURRENT_TIMESTAMP',
        })
        .where('employeeId = :employeeId', { employeeId })
        .andWhere('locationId = :locationId', { locationId })
        .andWhere('policyType = :policyType', { policyType })
        .andWhere('syncVersion = :expectedVersion', { expectedVersion })
        .execute();

      if (result.affected === 0) {
        throw new Error('Balance not found or version mismatch');
      }

      // Return updated entity
      return repository.findOne({
        where: { employeeId, locationId, policyType },
      });
    });
  }

  /**
   * Deduct balance with validation
   * @param employeeId - Employee identifier
   * @param locationId - Location identifier
   * @param policyType - Policy type
   * @param daysToDeduct - Days to deduct
   * @param expectedVersion - Expected version for optimistic locking
   * @returns Updated balance
   */
  async deductBalance(
    employeeId: string,
    locationId: string,
    policyType: string,
    daysToDeduct: number,
    expectedVersion: number
  ): Promise<CurrentBalance> {
    return this.withTransaction(async (manager) => {
      const repository = manager.getRepository(CurrentBalance);
      
      // Lock the record for update
      const balance = await repository
        .createQueryBuilder('balance')
        .where('balance.employeeId = :employeeId', { employeeId })
        .andWhere('balance.locationId = :locationId', { locationId })
        .andWhere('balance.policyType = :policyType', { policyType })
        .andWhere('balance.syncVersion = :expectedVersion', { expectedVersion })
        .setLock('pessimistic_write')
        .getOne();

      if (!balance) {
        throw new Error('Balance not found or version mismatch');
      }

      // Validate sufficient balance
      if (balance.currentBalance < daysToDeduct) {
        throw new Error(
          `Insufficient balance. Available: ${balance.currentBalance}, Requested: ${daysToDeduct}`
        );
      }

      // Update balance
      const newBalance = balance.currentBalance - daysToDeduct;
      const newVersion = balance.syncVersion + 1;

      await repository.update(balance.id, {
        currentBalance: newBalance,
        syncVersion: newVersion,
      });

      // Return updated balance
      return { ...balance, currentBalance: newBalance, syncVersion: newVersion };
    });
  }

  /**
   * Add balance with validation
   * @param employeeId - Employee identifier
   * @param locationId - Location identifier
   * @param policyType - Policy type
   * @param daysToAdd - Days to add
   * @param expectedVersion - Expected version for optimistic locking
   * @returns Updated balance
   */
  async addBalance(
    employeeId: string,
    locationId: string,
    policyType: string,
    daysToAdd: number,
    expectedVersion: number
  ): Promise<CurrentBalance> {
    return this.withTransaction(async (manager) => {
      const repository = manager.getRepository(CurrentBalance);
      
      // Lock the record for update
      const balance = await repository
        .createQueryBuilder('balance')
        .where('balance.employeeId = :employeeId', { employeeId })
        .andWhere('balance.locationId = :locationId', { locationId })
        .andWhere('balance.policyType = :policyType', { policyType })
        .andWhere('balance.syncVersion = :expectedVersion', { expectedVersion })
        .setLock('pessimistic_write')
        .getOne();

      if (!balance) {
        throw new Error('Balance not found or version mismatch');
      }

      // Update balance
      const newBalance = balance.currentBalance + daysToAdd;
      const newVersion = balance.syncVersion + 1;

      await repository.update(balance.id, {
        currentBalance: newBalance,
        syncVersion: newVersion,
      });

      // Return updated balance
      return { ...balance, currentBalance: newBalance, syncVersion: newVersion };
    });
  }

  /**
   * Create balance record if it doesn't exist
   * @param employeeId - Employee identifier
   * @param locationId - Location identifier
   * @param policyType - Policy type
   * @param initialBalance - Initial balance
   * @returns Created or existing balance
   */
  async createIfNotExists(
    employeeId: string,
    locationId: string,
    policyType: string,
    initialBalance: number = 0
  ): Promise<CurrentBalance> {
    return this.withTransaction(async (manager) => {
      const repository = manager.getRepository(CurrentBalance);
      
      // Check if balance already exists
      let balance = await repository.findOne({
        where: { employeeId, locationId, policyType },
      });

      if (!balance) {
        // Create new balance record
        balance = repository.create({
          employeeId,
          locationId,
          policyType,
          currentBalance: initialBalance,
          syncVersion: 1,
        });
        balance = await repository.save(balance);
      }

      return balance;
    });
  }

  /**
   * Find stale balances based on TTL
   * @param staleThresholdMs - Staleness threshold in milliseconds
   * @returns Array of stale balances
   */
  async findStaleBalances(staleThresholdMs: number = 300000): Promise<CurrentBalance[]> {
    const staleDate = new Date(Date.now() - staleThresholdMs);
    
    return this.findMany({
      where: [
        { lastSyncAt: null }, // Never synced
        { lastSyncAt: { $lt: staleDate } as any }, // Synced before threshold
      ],
    });
  }

  /**
   * Update sync timestamp and version
   * @param employeeId - Employee identifier
   * @param locationId - Location identifier
   * @param policyType - Policy type
   * @param syncVersion - New sync version
   * @returns Updated balance
   */
  async updateSyncInfo(
    employeeId: string,
    locationId: string,
    policyType: string,
    syncVersion: number
  ): Promise<CurrentBalance | null> {
    return this.withTransaction(async (manager) => {
      const repository = manager.getRepository(CurrentBalance);
      
      await repository.update(
        { employeeId, locationId, policyType },
        {
          lastSyncAt: new Date(),
          syncVersion,
          updatedAt: new Date(),
        }
      );

      return repository.findOne({
        where: { employeeId, locationId, policyType },
      });
    });
  }

  /**
   * Get balance statistics for monitoring
   * @param locationId - Location identifier (optional)
   * @returns Balance statistics
   */
  async getBalanceStatistics(locationId?: string): Promise<{
    totalBalances: number;
    totalBalanceValue: number;
    averageBalance: number;
    staleBalances: number;
    zeroBalances: number;
  }> {
    const where: any = {};
    if (locationId) {
      where.locationId = locationId;
    }

    const [totalBalances, balanceSum, staleCount, zeroCount] = await Promise.all([
      this.count(where),
      this.repository.sum('currentBalance', where),
      this.count({
        ...where,
        lastSyncAt: null,
      }),
      this.count({
        ...where,
        currentBalance: 0,
      }),
    ]);

    const totalBalanceValue = balanceSum || 0;
    const averageBalance = totalBalances > 0 ? totalBalanceValue / totalBalances : 0;

    return {
      totalBalances,
      totalBalanceValue,
      averageBalance,
      staleBalances: staleCount,
      zeroBalances: zeroCount,
    };
  }

  /**
   * Bulk update balances for sync operations
   * @param updates - Array of balance updates
   * @returns Number of updated records
   */
  async bulkUpdateBalances(updates: Array<{
    employeeId: string;
    locationId: string;
    policyType: string;
    currentBalance: number;
    syncVersion: number;
  }>): Promise<number> {
    return this.withTransaction(async (manager) => {
      const repository = manager.getRepository(CurrentBalance);
      let totalUpdated = 0;

      for (const update of updates) {
        const result = await repository.update(
          {
            employeeId: update.employeeId,
            locationId: update.locationId,
            policyType: update.policyType,
          },
          {
            currentBalance: update.currentBalance,
            lastSyncAt: new Date(),
            syncVersion: update.syncVersion,
            updatedAt: new Date(),
          }
        );

        totalUpdated += result.affected || 0;
      }

      return totalUpdated;
    });
  }

  /**
   * Validate entity data before database operations
   * @param data - Entity data to validate
   */
  protected validateEntity(data: any): void {
    super.validateEntity(data);

    if (data.employeeId && typeof data.employeeId !== 'string') {
      throw new Error('Employee ID must be a string');
    }

    if (data.locationId && typeof data.locationId !== 'string') {
      throw new Error('Location ID must be a string');
    }

    if (data.policyType && typeof data.policyType !== 'string') {
      throw new Error('Policy type must be a string');
    }

    if (data.currentBalance !== undefined && (typeof data.currentBalance !== 'number' || data.currentBalance < 0)) {
      throw new Error('Current balance must be a non-negative number');
    }

    if (data.syncVersion !== undefined && (typeof data.syncVersion !== 'number' || data.syncVersion < 0)) {
      throw new Error('Sync version must be a non-negative number');
    }
  }
}
