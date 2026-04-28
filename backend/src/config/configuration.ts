import { registerAs } from '@nestjs/config';

/**
 * Application configuration factory
 * Centralizes all environment variables with proper typing and validation
 */
export default registerAs('app', () => ({
  // Application basics
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  appName: process.env.APP_NAME || 'time-off-microservice',
  appVersion: process.env.APP_VERSION || '1.0.0',

  // Database configuration
  database: {
    type: 'sqlite',
    database: process.env.DB_DATABASE || './data/time-off.db',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
    entities: [process.env.DB_ENTITIES || 'src/**/*.entity.ts'],
    migrations: [process.env.DB_MIGRATIONS || 'src/migrations/*.ts'],
    subscribers: [process.env.DB_SUBSCRIBERS || 'src/subscribers/*.ts'],
  },

  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
  },

  // HCM system configuration
  hcm: {
    baseUrl: process.env.HCM_BASE_URL,
    apiKey: process.env.HCM_API_KEY,
    timeout: parseInt(process.env.HCM_TIMEOUT, 10) || 5000,
    retryAttempts: parseInt(process.env.HCM_RETRY_ATTEMPTS, 10) || 3,
    rateLimit: parseInt(process.env.HCM_RATE_LIMIT, 10) || 100,
  },

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // Security configuration
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
    datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
  },

  // Monitoring configuration
  monitoring: {
    metricsEnabled: process.env.METRICS_ENABLED === 'true',
    metricsPort: parseInt(process.env.METRICS_PORT, 10) || 9090,
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL, 10) || 30000,
  },

  // Business logic configuration
  business: {
    defaultMinNoticeDays: parseInt(process.env.DEFAULT_MIN_NOTICE_DAYS, 10) || 3,
    maxRequestDaysPerTransaction: parseInt(process.env.MAX_REQUEST_DAYS_PER_TRANSACTION, 10) || 365,
    fractionalDayIncrement: parseFloat(process.env.FRACTIONAL_DAY_INCREMENT) || 0.5,
    syncBatchSize: parseInt(process.env.SYNC_BATCH_SIZE, 10) || 500,
    syncConcurrency: parseInt(process.env.SYNC_CONCURRENCY, 10) || 10,
    cacheTtlBalance: parseInt(process.env.CACHE_TTL_BALANCE, 10) || 300,
    cacheTtlPolicies: parseInt(process.env.CACHE_TTL_POLICIES, 10) || 3600,
  },

  // External services
  external: {
    webhookSecret: process.env.WEBHOOK_SECRET,
    notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL,
  },
}));
