import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Employee } from '@/shared/entities/employee.entity';
import { TimeOffPolicy } from '@/shared/entities/time-off-policy.entity';
import { BalanceHistory } from '@/shared/entities/balance-history.entity';
import { CurrentBalance } from '@/shared/entities/current-balance.entity';
import { SyncStatus } from '@/shared/entities/sync-status.entity';
import { IdempotencyKey } from '@/shared/entities/idempotency-key.entity';
import { TimeOffRequest } from '@/shared/entities/time-off-request.entity';

/**
 * Database configuration factory
 * 
 * This function creates the TypeORM configuration based on environment variables.
 * It centralizes database settings and entity registration for better maintainability.
 * 
 * @param configService - NestJS ConfigService for accessing environment variables
 * @returns TypeORM module options configured for SQLite
 */
export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => {
  const appDbConfig = configService.get('app.database');
  if (appDbConfig) return getDatabaseConfigWithValues(appDbConfig);

  const dbConfig = configService.get('database');
  if (dbConfig) return getDatabaseConfigWithValues(dbConfig);
  
  throw new Error('Database configuration not found');
};

const getDatabaseConfigWithValues = (dbConfig: any): TypeOrmModuleOptions => {
  return {
    type: dbConfig.type,
    database: dbConfig.database,
    synchronize: dbConfig.synchronize || process.env.NODE_ENV === 'test',
    logging: dbConfig.logging,
    
    // Entity registration - all database entities must be registered here
    entities: [
      Employee,
      TimeOffPolicy,
      BalanceHistory,
      CurrentBalance,
      SyncStatus,
      IdempotencyKey,
      TimeOffRequest,
    ],
    
    // Migration configuration
    migrations: dbConfig.migrations,
    migrationsRun: true,
    
    // Subscriber configuration for entity lifecycle events
    subscribers: dbConfig.subscribers,
    
    // Retry configuration
    retryAttempts: 3,
    retryDelay: 3000, // 3 seconds between retries
  };
};
