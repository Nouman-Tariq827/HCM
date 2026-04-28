import { Module, NestModule, MiddlewareConsumer, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER, APP_PIPE } from '@nestjs/core';

// Configuration
import configuration from './config/configuration';
import { getDatabaseConfig } from './config/database.config';

// Shared components
import { BalanceRepository } from '@/shared/repositories/balance.repository';
import { BalanceHistoryRepository } from '@/shared/repositories/balance-history.repository';
import { SyncStatusRepository } from '@/shared/repositories/sync-status.repository';
import { IdempotencyKeyRepository } from '@/shared/repositories/idempotency-key.repository';

// Guards and Interceptors
import { RateLimitGuard } from '@/shared/guards/rate-limit.guard';
import { LoggingInterceptor } from '@/shared/interceptors/logging.interceptor';
import { GlobalErrorFilter } from '@/shared/middleware/global-error.middleware';
import { IdempotencyMiddleware } from '@/shared/middleware/idempotency.middleware';

// Modules
import { BalanceModule } from '@/modules/balance/balance.module';
import { TimeOffModule } from '@/modules/time-off/time-off.module';
import { HCMModule } from '@/modules/hcm/hcm.module';
import { SyncModule } from '@/modules/sync/sync.module';

/**
 * Application Module
 * 
 * Root module that configures the entire NestJS application including
 * database connections, shared services, and feature modules.
 * 
 * Why this exists:
 * - Centralizes application configuration
 * - Sets up database and external service connections
 * - Configures global guards, interceptors, and middleware
 * - Imports and configures feature modules
 */
@Module({
  imports: [
    // Configuration module
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),

    // Database module
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => getDatabaseConfig(configService),
      inject: [ConfigService],
    }),

    // HTTP module for external API calls
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        timeout: configService.get<number>('hcm.timeout') || 5000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'time-off-microservice/1.0.0',
        },
      }),
      inject: [ConfigService],
    }),

    // Feature modules
    BalanceModule,
    TimeOffModule,
    HCMModule,
    SyncModule,
  ],

  providers: [
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },

    // Global logging interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },

    // Global validation pipe
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    },

    // Global error handling middleware
    {
      provide: APP_FILTER,
      useClass: GlobalErrorFilter,
    },

    // Idempotency middleware (applied globally but can be overridden per route)
    IdempotencyMiddleware,

    // Shared repositories (available for injection across modules)
    BalanceRepository,
    BalanceHistoryRepository,
    SyncStatusRepository,
    IdempotencyKeyRepository,
  ],
})
export class AppModule implements NestModule {
  /**
   * Configure application middleware
   */
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(IdempotencyMiddleware)
      .forRoutes(
        'api/v1/time-off',
        'api/v1/balances/validate',
        'api/v1/balances/deduct',
        'api/v1/balances/add'
      );
  }

  /**
   * Application module constructor
   * 
   * This constructor can be used for application-level initialization
   * such as setting up cron jobs, background tasks, or other startup logic.
   */
  constructor(private readonly configService: ConfigService) {
    // Log application startup information
    console.log(`
📦 AppModule initialized
🌍 Environment: ${this.configService.get<string>('nodeEnv')}
🗄️  Database: ${this.configService.get<string>('database.type')}
🔗 HCM System: ${this.configService.get<string>('hcm.baseUrl')}
📊 Metrics: ${this.configService.get<boolean>('monitoring.metricsEnabled') ? 'Enabled' : 'Disabled'}
    `);
  }
}
