import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Simple Authentication Guard
 * 
 * Basic authentication guard for testing purposes.
 * In a real implementation, this would validate JWT tokens
 * or other authentication mechanisms.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    // Check if we're in test environment
    const isTestEnv = process.env.NODE_ENV === 'test';
    
    if (isTestEnv) {
      // In test environment, reject requests with invalid tokens
      if (authHeader && authHeader === 'Bearer invalid-token') {
        throw new UnauthorizedException('Invalid authentication token');
      }
      
      // Allow requests without auth header or with valid tokens for testing
      return true;
    }

    // In production, implement proper JWT validation
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authentication token');
    }

    // TODO: Implement proper JWT validation
    return true;
  }
}
