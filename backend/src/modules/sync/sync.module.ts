import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SynchronizationService } from './synchronization.service';
import { RetryStrategyService } from './retry-strategy.service';
import { SyncStatus } from '@/shared/entities/sync-status.entity';
import { CurrentBalance } from '@/shared/entities/current-balance.entity';
import { SyncStatusRepository } from '@/shared/repositories/sync-status.repository';
import { BalanceRepository } from '@/shared/repositories/balance.repository';
import { BalanceHistoryRepository } from '@/shared/repositories/balance-history.repository';
import { HCMModule } from '@/modules/hcm/hcm.module';

/**
 * Sync Module
 * 
 * Module that encapsulates all synchronization functionality including
 * batch operations, conflict resolution, and HCM system integration.
 * 
 * Why this exists:
 * - Encapsulates synchronization dependencies
 * - Provides clean separation from core business logic
 * - Enables modular testing and maintenance
 * - Follows NestJS module architecture patterns
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SyncStatus,
      CurrentBalance,
    ]),
    HCMModule,
  ],
  controllers: [SyncController],
  providers: [
    SyncService,
    SynchronizationService,
    RetryStrategyService,
    SyncStatusRepository,
    BalanceRepository,
    BalanceHistoryRepository,
  ],
  exports: [
    SyncService,
    SynchronizationService,
    RetryStrategyService,
    SyncStatusRepository,
    BalanceRepository,
  ],
})
export class SyncModule {}
