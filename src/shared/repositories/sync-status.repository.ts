import { DataSource, FindOptionsWhere, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { BaseRepository } from './base.repository';
import { SyncStatus } from '../entities/sync-status.entity';

/**
 * Sync Status Repository
 * 
 * Handles all sync status database operations.
 * This repository is critical for monitoring and managing HCM synchronization tasks.
 * 
 * Why this exists:
 * - Centralizes all sync status database operations
 * - Provides monitoring and metrics for sync operations
 * - Supports synchronization workflow management
 */
export class SyncStatusRepository extends BaseRepository<SyncStatus> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(dataSource, SyncStatus, 'sync_status');
  }

  /**
   * Create a new sync operation record
   * @param data - Sync operation data
   * @returns Created sync status
   */
  async createSyncOperation(data: {
    syncType: string;
    status: string;
    priority?: string;
    employeesTotal?: number;
    batchSize?: number;
    estimatedDuration?: number;
    initiatedBy?: string;
    metadata?: any;
  }): Promise<SyncStatus> {
    const syncStatus = this.repository.create({
      ...data,
      startedAt: new Date(),
      employeesProcessed: 0,
      conflictsDetected: 0,
      conflictsResolved: 0,
      retryAttempts: 0,
    });
    return this.repository.save(syncStatus);
  }

  /**
   * Find sync operations with pagination and filtering
   * @param options - Query options
   * @returns Paginated sync operations
   */
  async findWithPagination(options: {
    page: number;
    limit: number;
    where?: FindOptionsWhere<SyncStatus>;
    order?: any;
  }): Promise<{
    data: SyncStatus[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const [data, total] = await this.repository.findAndCount({
      where: options.where,
      order: options.order || { startedAt: 'DESC' },
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

  /**
   * Cancel multiple sync operations
   * @param ids - Sync operation IDs
   * @returns Number of cancelled operations
   */
  async cancelSyncOperations(ids: number[]): Promise<number> {
    const result = await this.repository.update(
      { id: In(ids), status: In(['pending', 'in_progress']) },
      { status: 'cancelled', completedAt: new Date() }
    );
    return result.affected || 0;
  }

  /**
   * Update progress of a sync operation
   * @param id - Sync operation ID
   * @param processed - Employees processed
   * @param conflicts - New conflicts detected
   * @param resolved - New conflicts resolved
   */
  async updateProgress(
    id: number,
    processed: number,
    conflicts: number = 0,
    resolved: number = 0
  ): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update(SyncStatus)
      .set({
        employeesProcessed: processed,
        conflictsDetected: () => `conflicts_detected + ${conflicts}`,
        conflictsResolved: () => `conflicts_resolved + ${resolved}`,
      })
      .where('id = :id', { id })
      .execute();
  }

  /**
   * Mark a sync operation as completed
   * @param id - Sync operation ID
   */
  async markCompleted(id: number): Promise<void> {
    await this.repository.update(id, {
      status: 'completed',
      completedAt: new Date(),
    });
  }

  /**
   * Mark a sync operation as failed
   * @param id - Sync operation ID
   * @param error - Error object or message
   */
  async markFailed(id: number, error: any): Promise<void> {
    await this.repository.update(id, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      completedAt: new Date(),
    });
  }

  /**
   * Increment retry attempts for a sync operation
   * @param id - Sync operation ID
   */
  async incrementRetries(id: number): Promise<void> {
    await this.repository.increment({ id }, 'retryAttempts', 1);
  }

  /**
   * Find currently running sync operations
   * @returns Array of running sync statuses
   */
  async findRunningSyncs(): Promise<SyncStatus[]> {
    return this.repository.find({
      where: { status: 'in_progress' },
      order: { startedAt: 'ASC' },
    });
  }

  /**
   * Get sync statistics for a period
   * @param options - Statistics options
   * @returns Sync statistics
   */
  async getSyncStatistics(options: {
    startDate: Date;
    syncType?: string;
  }): Promise<any> {
    const where: FindOptionsWhere<SyncStatus> = {
      startedAt: MoreThanOrEqual(options.startDate),
    };
    if (options.syncType) {
      where.syncType = options.syncType;
    }

    const [totalSyncs, successfulSyncs, failedSyncs, results] = await Promise.all([
      this.repository.count({ where }),
      this.repository.count({ where: { ...where, status: 'completed' } }),
      this.repository.count({ where: { ...where, status: 'failed' } }),
      this.repository.find({ where }),
    ]);

    const totalEmployeesSynced = results.reduce((sum, s) => sum + s.employeesProcessed, 0);
    const totalConflictsDetected = results.reduce((sum, s) => sum + s.conflictsDetected, 0);
    const totalConflictsResolved = results.reduce((sum, s) => sum + s.conflictsResolved, 0);
    
    // Simple average duration for completed syncs
    const completedSyncs = results.filter(s => s.status === 'completed' && s.completedAt);
    const totalDuration = completedSyncs.reduce((sum, s) => {
      return sum + (s.completedAt.getTime() - s.startedAt.getTime());
    }, 0);
    const averageDuration = completedSyncs.length > 0 ? totalDuration / completedSyncs.length / 1000 : 0;

    return {
      totalSyncs,
      successfulSyncs,
      failedSyncs,
      totalEmployeesSynced,
      totalConflictsDetected,
      totalConflictsResolved,
      averageDuration,
      successRate: totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0,
    };
  }

  /**
   * Get performance metrics for sync operations
   * @param days - Number of days to look back
   * @returns Performance metrics
   */
  async getPerformanceMetrics(days: number): Promise<any> {
    // Placeholder implementation
    return {
      averageProcessingRate: 0,
      averageConflictRate: 0,
      peakProcessingRate: 0,
      dailyMetrics: [],
    };
  }
}
