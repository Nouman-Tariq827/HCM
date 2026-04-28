import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { HCMService } from './hcm.service';

/**
 * HCM Module
 * 
 * Module that encapsulates all HCM system integration functionality including
 * external API communication, circuit breaking, and retry logic.
 * 
 * Why this exists:
 * - Encapsulates HCM system dependencies
 * - Provides clean separation from core business logic
 * - Enables modular testing and maintenance
 * - Follows NestJS module architecture patterns
 */
@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: () => ({
        timeout: 5000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'time-off-microservice/1.0.0',
        },
      }),
    }),
  ],
  providers: [HCMService],
  exports: [HCMService],
})
export class HCMModule {}
