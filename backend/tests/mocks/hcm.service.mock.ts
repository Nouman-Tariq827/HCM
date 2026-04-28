import { HCMService } from '@/modules/hcm/hcm.service';

/**
 * Mock HCM Service
 * 
 * Provides comprehensive mocking for HCM service interactions including:
 * - Success scenarios
 * - Failure scenarios (timeout, network, auth errors)
 * - Incorrect data scenarios
 * - Performance scenarios
 * - Race condition scenarios
 */
export class MockHCMService {
  private responses: Map<string, any> = new Map();
  private delays: Map<string, number> = new Map();
  private errors: Map<string, Error> = new Map();
  private callCount: Map<string, number> = new Map();

  constructor() {
    this.setupDefaultResponses();
  }

  /**
   * Setup default mock responses for common scenarios
   */
  private setupDefaultResponses(): void {
    // Valid balance response
    this.responses.set('valid_balance', {
      employeeId: 'EMP001',
      locationId: 'NYC',
      policyType: 'vacation',
      currentBalance: 15.5,
      version: 1,
      lastUpdated: new Date().toISOString(),
    });

    // Insufficient balance response
    this.responses.set('insufficient_balance', {
      employeeId: 'EMP001',
      locationId: 'NYC',
      policyType: 'vacation',
      currentBalance: 1.0,
      version: 1,
      lastUpdated: new Date().toISOString(),
    });

    // Incorrect balance response
    this.responses.set('incorrect_balance', {
      employeeId: 'EMP001',
      locationId: 'NYC',
      policyType: 'vacation',
      currentBalance: 999.9,
      version: 999,
      lastUpdated: '2020-01-01T00:00:00.000Z',
    });

    // Stale data response
    this.responses.set('stale_data', {
      employeeId: 'EMP001',
      locationId: 'NYC',
      policyType: 'vacation',
      currentBalance: 15.5,
      version: 1,
      lastUpdated: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
    });

    // Batch sync response
    this.responses.set('batch_sync', [
      {
        employeeId: 'EMP001',
        locationId: 'NYC',
        policyType: 'vacation',
        currentBalance: 18.0,
        version: 2,
        lastUpdated: new Date().toISOString(),
      },
      {
        employeeId: 'EMP002',
        locationId: 'NYC',
        policyType: 'sick',
        currentBalance: 7.5,
        version: 2,
        lastUpdated: new Date().toISOString(),
      },
    ]);

    // Setup delays for performance testing
    this.delays.set('slow_response', 2000); // 2 seconds
    this.delays.set('timeout', 10000); // 10 seconds

    // Setup errors for failure testing
    this.errors.set('timeout', new Error('HCM service timeout'));
    this.errors.set('network', new Error('Network error'));
    this.errors.set('auth', new Error('Unauthorized'));
    this.errors.set('server_error', new Error('Internal server error'));
    this.errors.set('rate_limit', new Error('Rate limit exceeded'));
  }

  /**
   * Mock getBalance method
   */
  async getBalance(employeeId: string, locationId: string, policyType: string): Promise<any> {
    const key = this.generateKey('getBalance', employeeId, locationId, policyType);
    this.incrementCallCount(key);

    // Check for configured errors
    const error = this.getErrorForScenario(key);
    if (error) {
      await this.applyDelay(key);
      throw error;
    }

    // Check for configured delays
    await this.applyDelay(key);

    // Return appropriate response
    const response = this.getResponseForScenario(key);
    return response || this.responses.get('valid_balance');
  }

  /**
   * Mock validateRequest method
   */
  async validateRequest(
    employeeId: string,
    locationId: string,
    policyType: string,
    requestedDays: number,
    operation: string
  ): Promise<any> {
    const key = this.generateKey('validateRequest', employeeId, locationId, policyType, requestedDays.toString());
    this.incrementCallCount(key);

    // Check for configured errors
    const error = this.getErrorForScenario(key);
    if (error) {
      await this.applyDelay(key);
      throw error;
    }

    // Check for configured delays
    await this.applyDelay(key);

    // Return validation result
    const balance = await this.getBalance(employeeId, locationId, policyType);
    return {
      valid: balance.currentBalance >= requestedDays,
      currentBalance: balance.currentBalance,
      message: balance.currentBalance >= requestedDays ? 'Request valid' : 'Insufficient balance',
    };
  }

  /**
   * Mock createRequest method
   */
  async createRequest(requestData: any): Promise<string> {
    const key = this.generateKey('createRequest', requestData.employeeId);
    this.incrementCallCount(key);

    // Check for configured errors
    const error = this.getErrorForScenario(key);
    if (error) {
      await this.applyDelay(key);
      throw error;
    }

    // Check for configured delays
    await this.applyDelay(key);

    // Return mock request ID
    return `hcm_${requestData.requestId}_${Date.now()}`;
  }

  /**
   * Mock updateBalance method
   */
  async updateBalance(employeeId: string, locationId: string, policyType: string, newBalance: number): Promise<void> {
    const key = this.generateKey('updateBalance', employeeId, locationId, policyType, newBalance.toString());
    this.incrementCallCount(key);

    // Check for configured errors
    const error = this.getErrorForScenario(key);
    if (error) {
      await this.applyDelay(key);
      throw error;
    }

    // Check for configured delays
    await this.applyDelay(key);

    // Update the stored balance
    const balanceKey = this.generateKey('getBalance', employeeId, locationId, policyType);
    const existingBalance = this.responses.get('valid_balance');
    if (existingBalance) {
      this.responses.set('valid_balance', {
        ...existingBalance,
        currentBalance: newBalance,
        lastUpdated: new Date().toISOString(),
        version: existingBalance.version + 1,
      });
    }
  }

  /**
   * Mock batchSync method
   */
  async batchSync(options: any): Promise<any[]> {
    const key = this.generateKey('batchSync', JSON.stringify(options));
    this.incrementCallCount(key);

    // Check for configured errors
    const error = this.getErrorForScenario(key);
    if (error) {
      await this.applyDelay(key);
      throw error;
    }

    // Check for configured delays
    await this.applyDelay(key);

    // Return batch sync response
    return this.responses.get('batch_sync') || [];
  }

  /**
   * Configure scenario-specific behavior
   */
  configureScenario(scenario: string, config: {
    response?: any;
    delay?: number;
    error?: Error;
    callLimit?: number;
  }): void {
    if (config.response) {
      this.responses.set(scenario, config.response);
    }
    if (config.delay) {
      this.delays.set(scenario, config.delay);
    }
    if (config.error) {
      this.errors.set(scenario, config.error);
    }
  }

  /**
   * Simulate race condition
   */
  async simulateRaceCondition(operation: string, data: any, delay: number = 100): Promise<any> {
    const key = this.generateKey('race_condition', operation, JSON.stringify(data));
    this.incrementCallCount(key);

    // Add random delay to simulate race condition
    const randomDelay = delay + Math.random() * 100;
    await this.sleep(randomDelay);

    // Return response based on call order
    const callCount = this.callCount.get(key) || 0;
    if (callCount === 1) {
      // First call succeeds
      return this.responses.get('valid_balance');
    } else {
      // Subsequent calls fail due to race condition
      throw new Error('Race condition detected - resource locked');
    }
  }

  /**
   * Reset all mock configurations
   */
  reset(): void {
    this.responses.clear();
    this.delays.clear();
    this.errors.clear();
    this.callCount.clear();
    this.setupDefaultResponses();
  }

  /**
   * Get call statistics
   */
  getCallStats(): Record<string, number> {
    return Object.fromEntries(this.callCount);
  }

  /**
   * Verify call count for specific scenario
   */
  expectCallCount(scenario: string, expectedCount: number): void {
    const count = this.callCount.get(scenario) || 0;
    if (count !== expectedCount) {
      throw new Error(`Expected ${expectedCount} calls to ${scenario}, but got ${count}`);
    }
  }

  /**
   * Helper methods
   */
  private generateKey(...parts: string[]): string {
    return parts.join(':');
  }

  private incrementCallCount(key: string): void {
    const current = this.callCount.get(key) || 0;
    this.callCount.set(key, current + 1);
  }

  private getResponseForScenario(key: string): any {
    // Check for exact match
    if (this.responses.has(key)) {
      return this.responses.get(key);
    }

    // Check for partial matches
    for (const [scenarioKey, response] of this.responses) {
      if (key.includes(scenarioKey)) {
        return response;
      }
    }

    return null;
  }

  private getErrorForScenario(key: string): Error | null {
    // Check for exact match
    if (this.errors.has(key)) {
      return this.errors.get(key);
    }

    // Check for partial matches
    for (const [scenarioKey, error] of this.errors) {
      if (key.includes(scenarioKey)) {
        return error;
      }
    }

    return null;
  }

  private getDelayForScenario(key: string): number {
    // Check for exact match
    if (this.delays.has(key)) {
      return this.delays.get(key);
    }

    // Check for partial matches
    for (const [scenarioKey, delay] of this.delays) {
      if (key.includes(scenarioKey)) {
        return delay;
      }
    }

    return 0;
  }

  private async applyDelay(key: string): Promise<void> {
    const delay = this.getDelayForScenario(key);
    if (delay > 0) {
      await this.sleep(delay);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Mock HCM Service Factory
 * 
 * Creates pre-configured mock instances for different test scenarios
 */
export class MockHCMServiceFactory {
  /**
   * Create mock for successful operations
   */
  static createSuccessMock(): MockHCMService {
    const mock = new MockHCMService();
    return mock;
  }

  /**
   * Create mock for timeout scenarios
   */
  static createTimeoutMock(): MockHCMService {
    const mock = new MockHCMService();
    mock.configureScenario('timeout', {
      error: new Error('HCM service timeout'),
      delay: 10000,
    });
    return mock;
  }

  /**
   * Create mock for network error scenarios
   */
  static createNetworkErrorMock(): MockHCMService {
    const mock = new MockHCMService();
    mock.configureScenario('network', {
      error: new Error('Network error'),
    });
    return mock;
  }

  /**
   * Create mock for incorrect data scenarios
   */
  static createIncorrectDataMock(): MockHCMService {
    const mock = new MockHCMService();
    mock.configureScenario('incorrect_balance', {
      response: {
        employeeId: 'EMP001',
        locationId: 'NYC',
        policyType: 'vacation',
        currentBalance: 999.9,
        version: 999,
        lastUpdated: '2020-01-01T00:00:00.000Z',
      },
    });
    return mock;
  }

  /**
   * Create mock for race condition scenarios
   */
  static createRaceConditionMock(): MockHCMService {
    const mock = new MockHCMService();
    // Override getBalance to simulate race conditions
    const originalGetBalance = mock.getBalance.bind(mock);
    mock.getBalance = async (employeeId: string, locationId: string, policyType: string) => {
      return mock.simulateRaceCondition('getBalance', { employeeId, locationId, policyType });
    };
    return mock;
  }

  /**
   * Create mock for performance testing
   */
  static createPerformanceMock(delay: number = 1000): MockHCMService {
    const mock = new MockHCMService();
    mock.configureScenario('slow_response', {
      delay,
    });
    return mock;
  }

  /**
   * Create mock for batch sync testing
   */
  static createBatchSyncMock(): MockHCMService {
    const mock = new MockHCMService();
    mock.configureScenario('batch_sync', {
      response: [
        {
          employeeId: 'EMP001',
          locationId: 'NYC',
          policyType: 'vacation',
          currentBalance: 18.0,
          version: 2,
          lastUpdated: new Date().toISOString(),
        },
        {
          employeeId: 'EMP002',
          locationId: 'NYC',
          policyType: 'sick',
          currentBalance: 7.5,
          version: 2,
          lastUpdated: new Date().toISOString(),
        },
        {
          employeeId: 'EMP003',
          locationId: 'LAX',
          policyType: 'vacation',
          currentBalance: 12.0,
          version: 1,
          lastUpdated: new Date().toISOString(),
        },
      ],
    });
    return mock;
  }
}

/**
 * Jest mock for HCM Service
 */
export const createHCMServiceMock = () => ({
  getBalance: jest.fn(),
  validateRequest: jest.fn(),
  createRequest: jest.fn(),
  updateBalance: jest.fn(),
  batchSync: jest.fn(),
});

/**
 * Setup HCM service mock with default behaviors
 */
export const setupHCMServiceMock = (mock: any) => {
  // Default successful responses
  mock.getBalance.mockResolvedValue({
    employeeId: 'EMP001',
    locationId: 'NYC',
    policyType: 'vacation',
    currentBalance: 15.5,
    version: 1,
    lastUpdated: new Date().toISOString(),
  });

  mock.validateRequest.mockResolvedValue({
    valid: true,
    currentBalance: 15.5,
    message: 'Request valid',
  });

  mock.createRequest.mockResolvedValue(`hcm_REQ_${Date.now()}`);
  mock.updateBalance.mockResolvedValue(undefined);
  mock.batchSync.mockResolvedValue([
    {
      employeeId: 'EMP001',
      locationId: 'NYC',
      policyType: 'vacation',
      currentBalance: 18.0,
      version: 2,
      lastUpdated: new Date().toISOString(),
    },
  ]);

  return mock;
};
