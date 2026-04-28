/**
 * Circuit Breaker Utility
 * 
 * Implements the circuit breaker pattern for external service calls.
 * This prevents cascading failures and provides resilience against
 * service outages.
 * 
 * Why this exists:
 * - Prevents cascading failures from external services
 * - Provides automatic recovery when services recover
 * - Reduces load on failing services
 * - Enables graceful degradation
 */

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreakerOpenError extends Error {
  constructor(message: string = 'Circuit breaker is OPEN') {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private nextAttempt = 0;

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly timeout: number = 60000, // 1 minute
    private readonly monitorWindow: number = 10000, // 10 seconds
  ) {}

  /**
   * Execute operation with circuit breaker protection
   * @param operation - Operation to execute
   * @returns Operation result
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() >= this.nextAttempt) {
        this.state = CircuitBreakerState.HALF_OPEN;
      } else {
        throw new CircuitBreakerOpenError();
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.failureCount = 0;
    this.state = CircuitBreakerState.CLOSED;
  }

  /**
   * Handle operation failure
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
      this.nextAttempt = Date.now() + this.timeout;
    }
  }

  /**
   * Get current circuit breaker state
   * @returns Current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Get failure count
   * @returns Current failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.nextAttempt = 0;
  }

  /**
   * Check if circuit breaker is open
   * @returns True if open
   */
  isOpen(): boolean {
    return this.state === CircuitBreakerState.OPEN;
  }

  /**
   * Check if circuit breaker is half open
   * @returns True if half open
   */
  isHalfOpen(): boolean {
    return this.state === CircuitBreakerState.HALF_OPEN;
  }

  /**
   * Check if circuit breaker is closed
   * @returns True if closed
   */
  isClosed(): boolean {
    return this.state === CircuitBreakerState.CLOSED;
  }
}
