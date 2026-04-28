import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setTimeout } from 'timers/promises';

/**
 * Mock HCM Balance Response
 * Simulates HCM system balance data
 */
interface MockBalanceResponse {
  employeeId: string;
  locationId: string;
  policyType: string;
  currentBalance: number;
  lastUpdated: string;
  version: number;
  isStale?: boolean;
}

/**
 * Mock Validation Response
 * Simulates HCM validation result
 */
interface MockValidationResponse {
  valid: boolean;
  currentBalance: number;
  message?: string;
  errorCode?: string;
  retryAfter?: number;
}

/**
 * Mock Batch Sync Response
 * Simulates HCM batch sync result
 */
interface MockBatchSyncResponse {
  requestId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalEmployees: number;
  processedEmployees: number;
  balances: MockBalanceResponse[];
  errors?: Array<{
    employeeId: string;
    error: string;
  }>;
  nextToken?: string;
}

/**
 * Mock HCM Configuration
 * Controls failure scenarios and behavior
 */
interface MockHCMConfig {
  // Failure rates (0.0 to 1.0)
  networkFailureRate: number;
  serverErrorRate: number;
  timeoutRate: number;
  staleDataRate: number;
  inconsistentDataRate: number;
  
  // Timing
  minResponseTime: number; // milliseconds
  maxResponseTime: number; // milliseconds
  timeoutTime: number; // milliseconds
  
  // Data inconsistency
  maxBalanceVariance: number; // Maximum variance in balance data
  staleDataThreshold: number; // Hours before data becomes stale
  
  // Batch sync behavior
  batchSize: number;
  processingDelay: number; // milliseconds per employee
  failurePoint: number; // Fail after N employees (0 = no failure)
  
  // External updates
  anniversaryBonusEnabled: boolean;
  anniversaryBonusAmount: number;
  anniversaryBonusFrequency: number; // days
}

/**
 * Mock HCM Service
 * 
 * Simulates a real-world HCM system with configurable unreliability.
 * This service is critical for testing the robustness of the time-off microservice
 * under various failure scenarios and edge cases.
 * 
 * Why this exists:
 * - Simulates real-world HCM system unreliability
 * - Enables testing of error handling and retry logic
 * - Validates circuit breaker and fallback mechanisms
 * - Tests data consistency and conflict resolution
 * - Provides configurable failure scenarios
 */
@Injectable()
export class MockHCMService {
  private readonly logger = new Logger(MockHCMService.name);
  private readonly config: MockHCMConfig;
  private readonly employeeData = new Map<string, Map<string, MockBalanceResponse>>();
  private readonly batchOperations = new Map<string, MockBatchSyncResponse>();
  private readonly externalUpdates = new Map<string, any>();

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfiguration();
    this.initializeEmployeeData();
    this.startExternalUpdates();
  }

  /**
   * Get balance for an employee (with simulated failures)
   * @param employeeId - Employee identifier
   * @param locationId - Location identifier
   * @param policyType - Policy type
   * @returns Balance response
   */
  async getBalance(
    employeeId: string,
    locationId: string,
    policyType: string
  ): Promise<MockBalanceResponse> {
    const startTime = Date.now();
    this.logger.log(`Mock HCM: Getting balance for ${employeeId} at ${locationId}`);

    try {
      // Simulate network delay
      await this.simulateDelay();

      // Check for network failures
      if (this.shouldFail('networkFailureRate')) {
        throw new Error('Network connection timeout');
      }

      // Check for server errors
      if (this.shouldFail('serverErrorRate')) {
        throw new Error('Internal server error');
      }

      // Check for timeouts
      if (this.shouldFail('timeoutRate')) {
        await this.simulateTimeout();
        throw new Error('Request timeout');
      }

      // Get employee balance data
      const locationData = this.employeeData.get(employeeId);
      if (!locationData || !locationData.has(policyType)) {
        throw new Error(`Employee ${employeeId} not found or no ${policyType} balance`);
      }

      let balance = locationData.get(policyType)!;

      // Simulate stale data
      if (this.shouldFail('staleDataRate')) {
        balance = this.makeDataStale(balance);
      }

      // Simulate inconsistent data
      if (this.shouldFail('inconsistentDataRate')) {
        balance = this.makeDataInconsistent(balance);
      }

      // Apply external updates
      balance = this.applyExternalUpdates(employeeId, locationId, policyType, balance);

      const processingTime = Date.now() - startTime;
      this.logger.log(`Mock HCM: Balance retrieved in ${processingTime}ms (stale: ${balance.isStale})`);

      return balance;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`Mock HCM: Balance retrieval failed in ${processingTime}ms: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate time-off request (with simulated failures)
   * @param employeeId - Employee identifier
   * @param locationId - Location identifier
   * @param policyType - Policy type
   * @param requestedDays - Days requested
   * @param operation - Operation type
   * @returns Validation response
   */
  async validateRequest(
    employeeId: string,
    locationId: string,
    policyType: string,
    requestedDays: number,
    operation: 'validate' | 'deduct' | 'add'
  ): Promise<MockValidationResponse> {
    const startTime = Date.now();
    this.logger.log(`Mock HCM: Validating request for ${employeeId}, ${requestedDays} days`);

    try {
      // Simulate network delay
      await this.simulateDelay();

      // Check for network failures
      if (this.shouldFail('networkFailureRate')) {
        throw new Error('Network connection timeout');
      }

      // Check for server errors
      if (this.shouldFail('serverErrorRate')) {
        throw new Error('Internal server error');
      }

      // Get current balance
      const balance = await this.getBalance(employeeId, locationId, policyType);

      // Simulate validation logic
      const isValid = balance.currentBalance >= requestedDays;
      
      let message: string | undefined;
      let errorCode: string | undefined;
      let retryAfter: number | undefined;

      if (!isValid) {
        message = `Insufficient balance. Available: ${balance.currentBalance}, Requested: ${requestedDays}`;
        errorCode = 'INSUFFICIENT_BALANCE';
        retryAfter = 300; // 5 minutes
      }

      // Simulate occasional validation failures
      if (this.shouldFail('serverErrorRate')) {
        message = 'Validation service temporarily unavailable';
        errorCode = 'VALIDATION_ERROR';
        retryAfter = 60;
        return {
          valid: false,
          currentBalance: balance.currentBalance,
          message,
          errorCode,
          retryAfter,
        };
      }

      const processingTime = Date.now() - startTime;
      this.logger.log(`Mock HCM: Validation completed in ${processingTime}ms - ${isValid ? 'Valid' : 'Invalid'}`);

      return {
        valid: isValid,
        currentBalance: balance.currentBalance,
        message,
        errorCode,
        retryAfter,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`Mock HCM: Validation failed in ${processingTime}ms: ${error.message}`);
      throw error;
    }
  }

  /**
   * Start batch synchronization (with simulated failures)
   * @param request - Batch sync request
   * @returns Batch sync response
   */
  async startBatchSync(request: {
    employeeIds?: string[];
    locationIds?: string[];
    policyTypes?: string[];
    batchSize?: number;
    includeInactive?: boolean;
  }): Promise<MockBatchSyncResponse> {
    const startTime = Date.now();
    const requestId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.log(`Mock HCM: Starting batch sync ${requestId}`);

    try {
      // Simulate network delay
      await this.simulateDelay();

      // Check for network failures
      if (this.shouldFail('networkFailureRate')) {
        throw new Error('Network connection timeout');
      }

      // Get employees to process
      const employeesToProcess = this.getEmployeesForSync(request);
      const batchSize = request.batchSize || this.config.batchSize;

      // Create initial batch response
      const batchResponse: MockBatchSyncResponse = {
        requestId,
        status: 'processing',
        totalEmployees: employeesToProcess.length,
        processedEmployees: 0,
        balances: [],
        errors: [],
      };

      this.batchOperations.set(requestId, batchResponse);

      // Start async processing
      this.processBatchAsync(requestId, employeesToProcess, batchSize);

      const processingTime = Date.now() - startTime;
      this.logger.log(`Mock HCM: Batch sync ${requestId} started in ${processingTime}ms for ${employeesToProcess.length} employees`);

      return batchResponse;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`Mock HCM: Batch sync start failed in ${processingTime}ms: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get batch sync status
   * @param requestId - Batch sync request ID
   * @returns Batch sync status
   */
  async getBatchSyncStatus(requestId: string): Promise<MockBatchSyncResponse> {
    const batchResponse = this.batchOperations.get(requestId);
    if (!batchResponse) {
      throw new Error(`Batch sync ${requestId} not found`);
    }

    return batchResponse;
  }

  /**
   * Get health status of mock HCM service
   * @returns Health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime: number;
    failureRate: number;
    config: Partial<MockHCMConfig>;
  }> {
    const startTime = Date.now();
    
    try {
      // Simulate health check
      await this.simulateDelay(100, 500);
      
      const responseTime = Date.now() - startTime;
      const failureRate = this.config.networkFailureRate + this.config.serverErrorRate;
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (failureRate > 0.5) {
        status = 'unhealthy';
      } else if (failureRate > 0.2) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      return {
        status,
        responseTime,
        failureRate,
        config: {
          networkFailureRate: this.config.networkFailureRate,
          serverErrorRate: this.config.serverErrorRate,
          timeoutRate: this.config.timeoutRate,
          staleDataRate: this.config.staleDataRate,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        failureRate: 1.0,
        config: {},
      };
    }
  }

  /**
   * Update mock configuration for testing
   * @param newConfig - New configuration
   */
  updateConfiguration(newConfig: Partial<MockHCMConfig>): void {
    Object.assign(this.config, newConfig);
    this.logger.log('Mock HCM: Configuration updated', newConfig);
  }

  /**
   * Reset mock service state
   */
  reset(): void {
    this.batchOperations.clear();
    this.externalUpdates.clear();
    this.initializeEmployeeData();
    this.logger.log('Mock HCM: Service state reset');
  }

  // Private methods

  /**
   * Load configuration from environment or defaults
   * @returns Mock HCM configuration
   */
  private loadConfiguration(): MockHCMConfig {
    return {
      networkFailureRate: parseFloat(process.env.MOCK_HCM_NETWORK_FAILURE_RATE || '0.1'),
      serverErrorRate: parseFloat(process.env.MOCK_HCM_SERVER_ERROR_RATE || '0.05'),
      timeoutRate: parseFloat(process.env.MOCK_HCM_TIMEOUT_RATE || '0.02'),
      staleDataRate: parseFloat(process.env.MOCK_HCM_STALE_DATA_RATE || '0.15'),
      inconsistentDataRate: parseFloat(process.env.MOCK_HCM_INCONSISTENT_DATA_RATE || '0.08'),
      
      minResponseTime: parseInt(process.env.MOCK_HCM_MIN_RESPONSE_TIME || '200'),
      maxResponseTime: parseInt(process.env.MOCK_HCM_MAX_RESPONSE_TIME || '2000'),
      timeoutTime: parseInt(process.env.MOCK_HCM_TIMEOUT_TIME || '5000'),
      
      maxBalanceVariance: parseFloat(process.env.MOCK_HCM_MAX_BALANCE_VARIANCE || '2.0'),
      staleDataThreshold: parseInt(process.env.MOCK_HCM_STALE_DATA_THRESHOLD || '24'),
      
      batchSize: parseInt(process.env.MOCK_HCM_BATCH_SIZE || '100'),
      processingDelay: parseInt(process.env.MOCK_HCM_PROCESSING_DELAY || '50'),
      failurePoint: parseInt(process.env.MOCK_HCM_FAILURE_POINT || '0'),
      
      anniversaryBonusEnabled: process.env.MOCK_HCM_ANNIVERSARY_BONUS_ENABLED === 'true',
      anniversaryBonusAmount: parseFloat(process.env.MOCK_HCM_ANNIVERSARY_BONUS_AMOUNT || '1.0'),
      anniversaryBonusFrequency: parseInt(process.env.MOCK_HCM_ANNIVERSARY_BONUS_FREQUENCY || '365'),
    };
  }

  /**
   * Initialize employee data with sample values
   */
  private initializeEmployeeData(): void {
    const employees = ['EMP001', 'EMP002', 'EMP003', 'EMP004', 'EMP005'];
    const locations = ['NYC', 'LON', 'SFO', 'CHI'];
    const policies = ['vacation', 'sick', 'personal'];

    for (const employeeId of employees) {
      const locationData = new Map<string, MockBalanceResponse>();
      
      for (const locationId of locations) {
        for (const policyType of policies) {
          const balance: MockBalanceResponse = {
            employeeId,
            locationId,
            policyType,
            currentBalance: Math.floor(Math.random() * 20) + 5, // 5-25 days
            lastUpdated: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
            version: Math.floor(Math.random() * 10) + 1,
            isStale: false,
          };
          
          locationData.set(policyType, balance);
        }
      }
      
      this.employeeData.set(employeeId, locationData);
    }

    this.logger.log(`Mock HCM: Initialized data for ${employees.length} employees`);
  }

  /**
   * Start external updates simulation
   */
  private startExternalUpdates(): void {
    if (!this.config.anniversaryBonusEnabled) {
      return;
    }

    setInterval(() => {
      this.simulateAnniversaryBonus();
    }, this.config.anniversaryBonusFrequency * 24 * 60 * 60 * 1000); // Convert days to milliseconds

    this.logger.log('Mock HCM: External updates started');
  }

  /**
   * Simulate anniversary bonus updates
   */
  private simulateAnniversaryBonus(): void {
    const employees = Array.from(this.employeeData.keys());
    const randomEmployee = employees[Math.floor(Math.random() * employees.length)];
    
    const locationData = this.employeeData.get(randomEmployee);
    if (!locationData) return;

    const policyTypes = Array.from(locationData.keys());
    const randomPolicy = policyTypes[Math.floor(Math.random() * policyTypes.length)];
    
    const balance = locationData.get(randomPolicy);
    if (!balance) return;

    // Add anniversary bonus
    balance.currentBalance += this.config.anniversaryBonusAmount;
    balance.lastUpdated = new Date().toISOString();
    balance.version++;

    // Store external update record
    const updateKey = `${randomEmployee}_${randomPolicy}`;
    this.externalUpdates.set(updateKey, {
      type: 'anniversary_bonus',
      amount: this.config.anniversaryBonusAmount,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Mock HCM: Anniversary bonus applied to ${randomEmployee} (${randomPolicy}): +${this.config.anniversaryBonusAmount} days`);
  }

  /**
   * Simulate network delay
   * @param minDelay - Minimum delay in milliseconds
   * @param maxDelay - Maximum delay in milliseconds
   */
  private async simulateDelay(minDelay?: number, maxDelay?: number): Promise<void> {
    const delay = Math.random() * (maxDelay - minDelay) + minDelay;
    await setTimeout(delay);
  }

  /**
   * Simulate timeout
   */
  private async simulateTimeout(): Promise<void> {
    await setTimeout(this.config.timeoutTime + 1000); // Exceeds timeout
  }

  /**
   * Check if operation should fail based on configured rate
   * @param failureRate - Failure rate (0.0 to 1.0)
   * @returns True if should fail
   */
  private shouldFail(failureRate: keyof MockHCMConfig): boolean {
    const rate = this.config[failureRate] as number;
    return Math.random() < rate;
  }

  /**
   * Make data stale
   * @param balance - Original balance data
   * @returns Stale balance data
   */
  private makeDataStale(balance: MockBalanceResponse): MockBalanceResponse {
    const staleDate = new Date();
    staleDate.setHours(staleDate.getHours() - this.config.staleDataThreshold);
    
    return {
      ...balance,
      lastUpdated: staleDate.toISOString(),
      isStale: true,
    };
  }

  /**
   * Make data inconsistent
   * @param balance - Original balance data
   * @returns Inconsistent balance data
   */
  private makeDataInconsistent(balance: MockBalanceResponse): MockBalanceResponse {
    const variance = (Math.random() - 0.5) * 2 * this.config.maxBalanceVariance;
    
    return {
      ...balance,
      currentBalance: Math.max(0, balance.currentBalance + variance),
      version: balance.version + Math.floor(Math.random() * 3) + 1, // Version mismatch
    };
  }

  /**
   * Apply external updates to balance
   * @param employeeId - Employee identifier
   * @param locationId - Location identifier
   * @param policyType - Policy type
   * @param balance - Current balance
   * @returns Updated balance
   */
  private applyExternalUpdates(
    employeeId: string,
    locationId: string,
    policyType: string,
    balance: MockBalanceResponse
  ): MockBalanceResponse {
    const updateKey = `${employeeId}_${policyType}`;
    const update = this.externalUpdates.get(updateKey);
    
    if (update) {
      balance.currentBalance += update.amount;
      balance.lastUpdated = update.timestamp;
      balance.version++;
      
      // Clear applied update
      this.externalUpdates.delete(updateKey);
    }
    
    return balance;
  }

  /**
   * Get employees for synchronization
   * @param request - Batch sync request
   * @returns Array of employee identifiers
   */
  private getEmployeesForSync(request: {
    employeeIds?: string[];
    locationIds?: string[];
    policyTypes?: string[];
  }): string[] {
    let employees = Array.from(this.employeeData.keys());

    // Filter by employee IDs
    if (request.employeeIds && request.employeeIds.length > 0) {
      employees = employees.filter(emp => request.employeeIds!.includes(emp));
    }

    // Filter by location IDs
    if (request.locationIds && request.locationIds.length > 0) {
      employees = employees.filter(emp => {
        const locationData = this.employeeData.get(emp);
        return locationData && Array.from(locationData.values()).some(balance => 
          request.locationIds!.includes(balance.locationId)
        );
      });
    }

    return employees;
  }

  /**
   * Process batch operation asynchronously
   * @param requestId - Batch request ID
   * @param employees - Employees to process
   * @param batchSize - Batch size
   */
  private async processBatchAsync(
    requestId: string,
    employees: string[],
    batchSize: number
  ): Promise<void> {
    const batchResponse = this.batchOperations.get(requestId)!;
    
    try {
      for (let i = 0; i < employees.length; i += batchSize) {
        const batch = employees.slice(i, i + batchSize);
        
        // Process each employee in batch
        for (const employeeId of batch) {
          // Check for failure point
          if (this.config.failurePoint > 0 && i >= this.config.failurePoint) {
            batchResponse.errors.push({
              employeeId,
              error: 'Simulated batch processing failure',
            });
            batchResponse.status = 'failed';
            return;
          }

          // Simulate processing delay
          await this.simulateDelay(this.config.processingDelay, this.config.processingDelay * 2);
          
          // Get balance for employee
          const locationData = this.employeeData.get(employeeId);
          if (locationData) {
            for (const balance of locationData.values()) {
              batchResponse.balances.push(balance);
            }
          }
          
          batchResponse.processedEmployees++;
        }

        // Small delay between batches
        await this.simulateDelay(100, 500);
      }

      batchResponse.status = 'completed';
      this.logger.log(`Mock HCM: Batch sync ${requestId} completed - ${batchResponse.processedEmployees}/${batchResponse.totalEmployees} employees`);
    } catch (error) {
      batchResponse.status = 'failed';
      batchResponse.errors.push({
        employeeId: 'batch',
        error: error.message,
      });
      this.logger.error(`Mock HCM: Batch sync ${requestId} failed: ${error.message}`);
    }
  }
}
