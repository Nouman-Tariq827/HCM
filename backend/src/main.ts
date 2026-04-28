import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { GlobalErrorFilter } from '@/shared/middleware/global-error.middleware';

/**
 * Bootstrap function
 * 
 * Initializes and starts the NestJS application with all necessary middleware,
 * configuration, and documentation setup.
 * 
 * Why this exists:
 * - Centralizes application bootstrap logic
 * - Configures security middleware
 * - Sets up API documentation
 * - Enables global validation and error handling
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }));

  // Compression middleware
  app.use(compression());

  // CORS configuration
  app.enableCors({
    origin: configService.get<string>('cors.origin') || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-Client-ID',
      'X-User-ID',
      'X-Trace-ID',
    ],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Strip properties that don't have decorators
    forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are provided
    transform: true, // Transform payloads to DTO instances
    transformOptions: {
      enableImplicitConversion: true, // Allow implicit type conversion
    },
    validationError: {
      target: false, // Don't include target in validation error response
      value: false, // Don't include value in validation error response
    },
  }));

  // Global error handling is now managed by GlobalErrorFilter in AppModule
  // app.use(new GlobalErrorFilter(configService).use);

  // API prefix
  app.setGlobalPrefix('api');

  // Swagger documentation setup
  if (configService.get<string>('nodeEnv') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Time-Off Microservice API')
      .setDescription('Production-ready Time-Off Management Microservice')
      .setVersion('1.0.0')
      .addTag('Balances', 'Balance management operations')
      .addTag('Time Off', 'Time-off request and policy operations')
      .addTag('Synchronization', 'HCM system synchronization operations')
      .addTag('Health', 'Health check and monitoring endpoints')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token',
        },
        'JWT'
      )
      .addApiKey(
        {
          type: 'apiKey',
          name: 'X-API-Key',
          in: 'header',
          description: 'Enter API key for external services',
        },
        'API_KEY'
      )
      .addServer('http://localhost:3000', 'Development server')
      .addServer('https://api.timeoff.company.com', 'Production server')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'Time-Off Microservice API Documentation',
      customCss: '.swagger-ui .topbar { display: none }',
      customJs: [
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.js',
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.js',
      ],
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
      },
    });
  }

  // Start the application
  const port = configService.get<number>('port') || 3000;
  const host = configService.get<string>('host') || '0.0.0.0';

  await app.listen(port, host);

  console.log(`
🚀 Time-Off Microservice is running!
📍 Server: http://${host}:${port}
📚 API Documentation: http://${host}:${port}/api/docs
🏥 Health Check: http://${host}:${port}/api/health
🌍 Environment: ${configService.get<string>('nodeEnv')}
⏰ Started at: ${new Date().toISOString()}
  `);

  // Graceful shutdown handling
  setupGracefulShutdown(app);
}

/**
 * Setup graceful shutdown handlers
 * @param app - NestJS application instance
 */
function setupGracefulShutdown(app: any): void {
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    
    try {
      await app.close();
      console.log('✅ Application closed successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Handle termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });
}

// Start the application
bootstrap().catch((error) => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});
