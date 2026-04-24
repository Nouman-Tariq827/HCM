/**
 * Mock HCM Service Configuration
 * 
 * Predefined configurations for testing different failure scenarios.
 * These configurations help validate the robustness of the time-off microservice
 * under various real-world conditions.
 * 
 * Why this exists:
 * - Provides ready-to-use test scenarios
 * - Enables automated testing of failure handling
 * - Facilitates manual testing of edge cases
 * - Documents available configuration options
 */

export interface MockHCMScenario {
  name: string;
  description: string;
  config: {
    networkFailureRate?: number;
    serverErrorRate?: number;
    timeoutRate?: number;
    staleDataRate?: number;
    inconsistentDataRate?: number;
    minResponseTime?: number;
    maxResponseTime?: number;
    timeoutTime?: number;
    maxBalanceVariance?: number;
    staleDataThreshold?: number;
    batchSize?: number;
    processingDelay?: number;
    failurePoint?: number;
    anniversaryBonusEnabled?: boolean;
    anniversaryBonusAmount?: number;
    anniversaryBonusFrequency?: number;
  };
}

/**
 * Predefined mock HCM scenarios for testing
 */
export const MOCK_HCM_SCENARIOS: Record<string, MockHCMScenario> = {
  /**
   * Normal operation - minimal failures for baseline testing
   */
  normal: {
    name: 'Normal Operation',
    description: 'Reliable HCM system with minimal failures',
    config: {
      networkFailureRate: 0.01, // 1% network failures
      serverErrorRate: 0.005, // 0.5% server errors
      timeoutRate: 0.001, // 0.1% timeouts
      staleDataRate: 0.05, // 5% stale data
      inconsistentDataRate: 0.01, // 1% inconsistent data
      minResponseTime: 100,
      maxResponseTime: 500,
      timeoutTime: 5000,
      maxBalanceVariance: 0.5,
      staleDataThreshold: 48, // 48 hours
      batchSize: 100,
      processingDelay: 50,
      failurePoint: 0, // No failures
      anniversaryBonusEnabled: true,
      anniversaryBonusAmount: 1.0,
      anniversaryBonusFrequency: 365,
    },
  },

  /**
   * Unreliable network - high failure rate for testing retry logic
   */
  unreliable_network: {
    name: 'Unreliable Network',
    description: 'High network failure rate to test retry mechanisms',
    config: {
      networkFailureRate: 0.3, // 30% network failures
      serverErrorRate: 0.05,
      timeoutRate: 0.1, // 10% timeouts
      staleDataRate: 0.1,
      inconsistentDataRate: 0.05,
      minResponseTime: 200,
      maxResponseTime: 3000,
      timeoutTime: 3000,
      maxBalanceVariance: 1.0,
      staleDataThreshold: 24,
      batchSize: 50,
      processingDelay: 100,
      failurePoint: 0,
      anniversaryBonusEnabled: false,
    },
  },

  /**
   * Server instability - testing circuit breaker and fallback logic
   */
  server_instability: {
    name: 'Server Instability',
    description: 'High server error rate to test circuit breaker',
    config: {
      networkFailureRate: 0.05,
      serverErrorRate: 0.4, // 40% server errors
      timeoutRate: 0.05,
      staleDataRate: 0.15,
      inconsistentDataRate: 0.1,
      minResponseTime: 1000,
      maxResponseTime: 5000,
      timeoutTime: 4000,
      maxBalanceVariance: 2.0,
      staleDataThreshold: 12,
      batchSize: 25,
      processingDelay: 200,
      failurePoint: 0,
      anniversaryBonusEnabled: false,
    },
  },

  /**
   * Slow responses - testing timeout handling
   */
  slow_responses: {
    name: 'Slow Responses',
    description: 'Slow HCM responses to test timeout handling',
    config: {
      networkFailureRate: 0.02,
      serverErrorRate: 0.02,
      timeoutRate: 0.3, // 30% timeouts
      staleDataRate: 0.2,
      inconsistentDataRate: 0.05,
      minResponseTime: 2000,
      maxResponseTime: 10000,
      timeoutTime: 3000, // Lower than max response time
      maxBalanceVariance: 1.5,
      staleDataThreshold: 36,
      batchSize: 75,
      processingDelay: 500,
      failurePoint: 0,
      anniversaryBonusEnabled: false,
    },
  },

  /**
   * Stale data - testing data freshness validation
   */
  stale_data: {
    name: 'Stale Data',
    description: 'High rate of stale data to test freshness validation',
    config: {
      networkFailureRate: 0.05,
      serverErrorRate: 0.05,
      timeoutRate: 0.02,
      staleDataRate: 0.6, // 60% stale data
      inconsistentDataRate: 0.1,
      minResponseTime: 200,
      maxResponseTime: 1000,
      timeoutTime: 5000,
      maxBalanceVariance: 0.5,
      staleDataThreshold: 6, // 6 hours
      batchSize: 100,
      processingDelay: 50,
      failurePoint: 0,
      anniversaryBonusEnabled: false,
    },
  },

  /**
   * Inconsistent data - testing conflict resolution
   */
  inconsistent_data: {
    name: 'Inconsistent Data',
    description: 'High rate of inconsistent data to test conflict resolution',
    config: {
      networkFailureRate: 0.05,
      serverErrorRate: 0.05,
      timeoutRate: 0.02,
      staleDataRate: 0.1,
      inconsistentDataRate: 0.4, // 40% inconsistent data
      minResponseTime: 200,
      maxResponseTime: 1000,
      timeoutTime: 5000,
      maxBalanceVariance: 5.0, // High variance
      staleDataThreshold: 24,
      batchSize: 100,
      processingDelay: 50,
      failurePoint: 0,
      anniversaryBonusEnabled: false,
    },
  },

  /**
   * Batch sync failures - testing batch operation resilience
   */
  batch_sync_failures: {
    name: 'Batch Sync Failures',
    description: 'Batch sync failures to test error handling',
    config: {
      networkFailureRate: 0.1,
      serverErrorRate: 0.1,
      timeoutRate: 0.05,
      staleDataRate: 0.15,
      inconsistentDataRate: 0.05,
      minResponseTime: 300,
      maxResponseTime: 2000,
      timeoutTime: 5000,
      maxBalanceVariance: 1.0,
      staleDataThreshold: 24,
      batchSize: 20, // Small batch size
      processingDelay: 100,
      failurePoint: 50, // Fail after 50 employees
      anniversaryBonusEnabled: false,
    },
  },

  /**
   * External updates - testing external system integration
   */
  external_updates: {
    name: 'External Updates',
    description: 'Frequent external updates to test conflict detection',
    config: {
      networkFailureRate: 0.05,
      serverErrorRate: 0.05,
      timeoutRate: 0.02,
      staleDataRate: 0.1,
      inconsistentDataRate: 0.05,
      minResponseTime: 200,
      maxResponseTime: 1000,
      timeoutTime: 5000,
      maxBalanceVariance: 0.5,
      staleDataThreshold: 24,
      batchSize: 100,
      processingDelay: 50,
      failurePoint: 0,
      anniversaryBonusEnabled: true,
      anniversaryBonusAmount: 2.0, // Higher bonus
      anniversaryBonusFrequency: 60, // Every 60 days
    },
  },

  /**
   * Worst case - maximum failures for stress testing
   */
  worst_case: {
    name: 'Worst Case Scenario',
    description: 'Maximum failure rates for stress testing',
    config: {
      networkFailureRate: 0.5, // 50% network failures
      serverErrorRate: 0.3, // 30% server errors
      timeoutRate: 0.4, // 40% timeouts
      staleDataRate: 0.7, // 70% stale data
      inconsistentDataRate: 0.3, // 30% inconsistent data
      minResponseTime: 1000,
      maxResponseTime: 10000,
      timeoutTime: 3000,
      maxBalanceVariance: 10.0, // Very high variance
      staleDataThreshold: 1, // 1 hour
      batchSize: 10, // Very small batches
      processingDelay: 1000, // Slow processing
      failurePoint: 25, // Fail early
      anniversaryBonusEnabled: true,
      anniversaryBonusAmount: 5.0,
      anniversaryBonusFrequency: 30, // Every month
    },
  },

  /**
   * Recovery scenario - testing recovery from failures
   */
  recovery: {
    name: 'Recovery Scenario',
    description: 'Starts with failures, then recovers',
    config: {
      networkFailureRate: 0.2, // 20% network failures
      serverErrorRate: 0.15, // 15% server errors
      timeoutRate: 0.1, // 10% timeouts
      staleDataRate: 0.3, // 30% stale data
      inconsistentDataRate: 0.15, // 15% inconsistent data
      minResponseTime: 500,
      maxResponseTime: 3000,
      timeoutTime: 4000,
      maxBalanceVariance: 2.0,
      staleDataThreshold: 12,
      batchSize: 50,
      processingDelay: 200,
      failurePoint: 0,
      anniversaryBonusEnabled: true,
      anniversaryBonusAmount: 1.5,
      anniversaryBonusFrequency: 180, // Every 6 months
    },
  },
};

/**
 * Get scenario configuration by name
 * @param scenarioName - Name of the scenario
 * @returns Scenario configuration
 */
export function getMockHCMScenario(scenarioName: string): MockHCMScenario {
  const scenario = MOCK_HCM_SCENARIOS[scenarioName];
  if (!scenario) {
    throw new Error(`Mock HCM scenario '${scenarioName}' not found. Available scenarios: ${Object.keys(MOCK_HCM_SCENARIOS).join(', ')}`);
  }
  return scenario;
}

/**
 * Get all available scenario names
 * @returns Array of scenario names
 */
export function getAvailableScenarios(): string[] {
  return Object.keys(MOCK_HCM_SCENARIOS);
}

/**
 * Validate scenario configuration
 * @param config - Configuration to validate
 * @returns Validation result
 */
export function validateScenarioConfig(config: MockHCMScenario['config']): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check rate values (0.0 to 1.0)
  const rateFields = ['networkFailureRate', 'serverErrorRate', 'timeoutRate', 'staleDataRate', 'inconsistentDataRate'];
  for (const field of rateFields) {
    const value = config[field as keyof typeof config];
    if (typeof value === 'number' && (value < 0 || value > 1)) {
      errors.push(`${field} must be between 0.0 and 1.0`);
    }
  }

  // Check time values (positive)
  const timeFields = ['minResponseTime', 'maxResponseTime', 'timeoutTime', 'staleDataThreshold', 'batchSize', 'processingDelay'];
  for (const field of timeFields) {
    const value = config[field as keyof typeof config];
    if (typeof value === 'number' && value < 0) {
      errors.push(`${field} must be positive`);
    }
  }

  // Check logical constraints
  if (config.minResponseTime && config.maxResponseTime && config.minResponseTime > config.maxResponseTime) {
    errors.push('minResponseTime must be less than or equal to maxResponseTime');
  }

  if (config.timeoutTime && config.minResponseTime && config.timeoutTime <= config.minResponseTime) {
    errors.push('timeoutTime must be greater than minResponseTime');
  }

  if (config.batchSize && config.batchSize < 1) {
    errors.push('batchSize must be at least 1');
  }

  if (config.failurePoint && config.failurePoint < 0) {
    errors.push('failurePoint must be non-negative');
  }

  if (config.anniversaryBonusAmount && config.anniversaryBonusAmount < 0) {
    errors.push('anniversaryBonusAmount must be non-negative');
  }

  if (config.anniversaryBonusFrequency && config.anniversaryBonusFrequency < 1) {
    errors.push('anniversaryBonusFrequency must be at least 1 day');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Create custom scenario configuration
 * @param name - Scenario name
 * @param description - Scenario description
 * @param config - Configuration object
 * @returns Custom scenario
 */
export function createCustomScenario(
  name: string,
  description: string,
  config: MockHCMScenario['config']
): MockHCMScenario {
  const validation = validateScenarioConfig(config);
  if (!validation.isValid) {
    throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
  }

  return {
    name,
    description,
    config,
  };
}
