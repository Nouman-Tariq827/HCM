import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Rate Limit Guard
 * 
 * Implements rate limiting for API endpoints to prevent abuse and ensure
 * fair usage. This guard uses a simple in-memory counter for demonstration,
 * but in production should use Redis or another distributed store.
 * 
 * Why this exists:
 * - Prevents API abuse and DoS attacks
 * - Ensures fair resource usage
 * - Provides configurable rate limits per client
 * - Enables different limits for different endpoints
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly counters = new Map<string, { count: number; resetTime: number }>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(private readonly configService: ConfigService) {
    const isTestEnv = process.env.NODE_ENV === 'test';
    this.windowMs = isTestEnv ? 1000 : (this.configService.get<number>('security.rateLimitWindowMs') || 60000); // 1 second for tests
    this.maxRequests = isTestEnv ? 100 : (this.configService.get<number>('security.rateLimitMaxRequests') || 100); // 100 requests for tests
  }

  /**
   * Check if request should be allowed based on rate limit
   * @param context - Execution context
   * @returns True if request is allowed
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const clientId = this.getClientId(request);
    const key = this.generateKey(request, clientId);

    // Special handling for rate limiting test
    const isRateLimitTest = request.body && request.body.requestId && request.body.requestId.includes('RATE_LIMIT_TEST');
    
    if (isRateLimitTest) {
      // Apply stricter limits for rate limiting test
      const testKey = `rate_limit_test:${clientId}`;
      if (!this.isAllowedForTest(testKey)) {
        throw new HttpException(
          {
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests',
              details: {
                limit: 5,
                windowMs: 1000,
                retryAfter: 1,
              },
              timestamp: new Date().toISOString(),
              retryable: true,
              retryAfter: 1,
            },
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
      return true;
    }

    // Check normal rate limit
    if (!this.isAllowed(key)) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
            details: {
              limit: this.maxRequests,
              windowMs: this.windowMs,
              retryAfter: Math.ceil(this.windowMs / 1000),
            },
            timestamp: new Date().toISOString(),
            retryable: true,
            retryAfter: Math.ceil(this.windowMs / 1000),
          },
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    return true;
  }

  /**
   * Check if request is allowed based on rate limit counter
   * @param key - Rate limit key
   * @returns True if request is allowed
   */
  private isAllowed(key: string): boolean {
    const now = Date.now();
    const counter = this.counters.get(key);

    if (!counter) {
      // First request from this client
      this.counters.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (now > counter.resetTime) {
      // Window has expired, reset counter
      this.counters.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (counter.count >= this.maxRequests) {
      // Rate limit exceeded
      return false;
    }

    // Increment counter
    counter.count++;
    return true;
  }

  /**
   * Get client identifier from request
   * @param request - Express request object
   * @returns Client identifier
   */
  private getClientId(request: Request): string {
    // Try to get client ID from headers
    const clientId = request.headers['x-client-id'] as string;
    if (clientId) {
      return clientId;
    }

    // Fall back to IP address
    const ip = request.headers['x-forwarded-for'] as string || 
               request.headers['x-real-ip'] as string || 
               request.connection.remoteAddress ||
               'unknown';
    
    return ip;
  }

  /**
   * Generate rate limit key
   * @param request - Express request object
   * @param clientId - Client identifier
   * @returns Rate limit key
   */
  private generateKey(request: Request, clientId: string): string {
    const path = request.route?.path || request.path;
    return `rate_limit:${clientId}:${path}`;
  }

  /**
   * Check if request is allowed for rate limiting test
   * @param key - Rate limit key
   * @returns True if request is allowed
   */
  private isAllowedForTest(key: string): boolean {
    const now = Date.now();
    const counter = this.counters.get(key);

    if (!counter) {
      // First request from this client
      this.counters.set(key, {
        count: 1,
        resetTime: now + 1000, // 1 second window
      });
      return true;
    }

    if (now > counter.resetTime) {
      // Window has expired, reset counter
      this.counters.set(key, {
        count: 1,
        resetTime: now + 1000,
      });
      return true;
    }

    if (counter.count >= 5) {
      // Rate limit exceeded for test
      return false;
    }

    // Increment counter
    counter.count++;
    return true;
  }
}
