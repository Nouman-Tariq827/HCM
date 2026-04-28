import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { CurrentBalance } from '@/shared/entities/current-balance.entity';
import { BalanceHistory } from '@/shared/entities/balance-history.entity';
import { IdempotencyKey } from '@/shared/entities/idempotency-key.entity';
import { BalanceRepository } from '@/shared/repositories/balance.repository';
import { BalanceHistoryRepository } from '@/shared/repositories/balance-history.repository';
import { IdempotencyKeyRepository } from '@/shared/repositories/idempotency-key.repository';

/**
 * Balance Module
 * 
 * Module that encapsulates all balance-related functionality including
 * balance management, validation, deduction, and history tracking.
 * 
 * Why this exists:
 * - Encapsulates balance-related dependencies
 * - Provides clean separation of concerns
 * - Enables modular testing and maintenance
 * - Follows NestJS module architecture patterns
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CurrentBalance,
      BalanceHistory,
      IdempotencyKey,
    ]),
  ],
  controllers: [BalanceController],
  providers: [
    BalanceService,
    BalanceRepository,
    BalanceHistoryRepository,
    IdempotencyKeyRepository,
  ],
  exports: [
    BalanceService,
    BalanceRepository,
    BalanceHistoryRepository,
  ],
})
export class BalanceModule {}
