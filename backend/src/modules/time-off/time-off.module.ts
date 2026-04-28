import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffController } from './time-off.controller';
import { TimeOffService } from './time-off.service';
import { BalanceModule } from '@/modules/balance/balance.module';
import { HCMModule } from '@/modules/hcm/hcm.module';
import { AuthGuard } from '@/shared/guards/auth.guard';
import { CurrentBalance } from '@/shared/entities/current-balance.entity';
import { BalanceHistory } from '@/shared/entities/balance-history.entity';
import { TimeOffRequest } from '@/shared/entities/time-off-request.entity';
import { TimeOffPolicy } from '@/shared/entities/time-off-policy.entity';
import { BalanceRepository } from '@/shared/repositories/balance.repository';
import { BalanceHistoryRepository } from '@/shared/repositories/balance-history.repository';
import { TimeOffRequestRepository } from '@/shared/repositories/time-off-request.repository';
import { TimeOffPolicyRepository } from '@/shared/repositories/time-off-policy.repository';

/**
 * Time Off Module
 * 
 * Module that encapsulates all time-off related functionality including
 * request processing, policy validation, and workflow management.
 * 
 * Why this exists:
 * - Encapsulates time-off workflow dependencies
 * - Provides clean separation from balance operations
 * - Enables modular testing and maintenance
 * - Follows NestJS module architecture patterns
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CurrentBalance,
      BalanceHistory,
      TimeOffRequest,
      TimeOffPolicy,
    ]),
    BalanceModule,
    HCMModule,
  ],
  controllers: [TimeOffController],
  providers: [
    TimeOffService,
    AuthGuard,
    BalanceRepository,
    BalanceHistoryRepository,
    TimeOffRequestRepository,
    TimeOffPolicyRepository,
  ],
  exports: [
    TimeOffService,
  ],
})
export class TimeOffModule {}
