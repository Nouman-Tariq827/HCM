import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse, AxiosError } from 'axios';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { CircuitBreaker } from '@/shared/utils/circuit-breaker';

/**
 * HCM Balance Response DTO
 * Represents balance information from HCM system
 */
interface HCMBalanceResponse {
  employeeId: string;
  locationId: string;
  policyType: string;
  currentBalance: number;
  lastUpdated: string;
  version: number;
}

/**
 * HCM Validation Request DTO
 * Request payload for HCM balance validation
 */
interface HCMValidationRequest {
  employeeId: string;
  locationId: string;
  policyType: string;
  requestedDays: number;
  operation: 'validate' | 'deduct' | 'add';
}

/**
 * HCM Validation Response DTO
 * Response from HCM validation
 */
interface HCMValidationResponse {
  valid: boolean;
  currentBalance: number;
  message?: string;
  errorCode?: string;
  retryAfter?: number;
}

/**
 * HCM Batch Sync Request DTO
 * Request for batch balance synchronization
 */
interface HCMBatchSyncRequest {
  employeeIds?: string[];
  locationIds?: string[];
  policyTypes?: string[];
  batchSize?: number;
  includeInactive?: boolean;
}

/**
 * HCM Batch Sync Response DTO
 * Response from HCM batch sync
 */
interface HCMBatchSyncResponse {
  requestId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalEmployees: number;
  processedEmployees: number;
  balances: HCMBalanceResponse[];
  errors?: Array<{
    employeeId: string;
    error: string;
  }>;
  nextToken?: string;
}

/**
 * HCM Service
 * 
 * External adapter for HCM system integration. This service handles all communication
 * with the HCM system including balance validation, updates, and synchronization.
 * 
 * Why this exists:
 * - Abstracts HCM system complexity
 * - Handles HCM API failures gracefully
 * - Implements retry and circuit breaker patterns
 * - Provides consistent interface for HCM operations
 * - Manages rate limiting and throttling
 */
@Injectable()
export class HCMService {
  private readonly logger = new Logger(HCMService.name);
  private readonly circuitBreaker: CircuitBreaker;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;
  private readonly retryAttempts: number;
  private readonly rateLimit: number;
  private requestCount = 0;
  private lastResetTime = Date.now();

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('hcm.baseUrl');
    this.apiKey = this.configService.get<string>('hcm.apiKey');
    this.timeout = this.configService.get<number>('hcm.timeout');
    this.retryAttempts = this.configService.get<number>('hcm.retryAttempts');
    this.rateLimit = this.configService.get<number>('hcm.rateLimit');

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker(
      5, // failure threshold
      60000, // timeout (1 minute)
      10000 // monitor window (10 seconds)
    );
  }

  /**
   * Validate balance with HCM system
   * @param employeeId - Employee identifier
   * @param locationId - Location identifier
   * @param policyType - Policy type
   * @param requestedDays - Days requested
   * @returns Validation result
   */
  async validateBalance(
    employeeId: string,
    locationId: string,
    policyType: string,
    requestedDays: number
  ): Promise<HCMValidationResponse> {
    const startTime = Date.now();
    this.logger.log(`Validating balance with HCM for employee ${employeeId}, ${requestedDays} days`);

    try {
      // Check rate limit
      await this.checkRateLimit();

      // Prepare request
      const request: HCMValidationRequest = {
        employeeId,
        locationId,
        policyType,
        requestedDays,
        operation: 'validate',
      };

      // Execute with circuit breaker and retry
      const response = await this.executeWithRetry<HCMValidationResponse>(
        () => this.makeHCMRequest<HCMValidationResponse>('POST', '/api/v1/balances/validate', request)
      );

      const processingTime = Date.now() - startTime;
      this.logger.log(`HCM balance validation completed in ${processingTime}ms`);

      return response;
    } catch (error) {
      this.logger.error(`HCM balance validation failed: ${error.message}`, { error, employeeId });
      throw this.handleHCMError(error);
    }
  }

  /**
   * Deduct balance in HCM system
   * @param employeeId - Employee identifier
   * @param locationId - Location identifier
   * @param policyType - Policy type
   * @param daysToDeduct - Days to deduct
   * @returns Updated balance
   */
  async deductBalance(
    employeeId: string,
    locationId: string,
    policyType: string,
    daysToDeduct: number
  ): Promise<HCMBalanceResponse> {
    const startTime = Date.now();
    this.logger.log(`Deducting balance in HCM for employee ${employeeId}, ${daysToDeduct} days`);

    try {
      // Check rate limit
      await this.checkRateLimit();

      // Prepare request
      const request: HCMValidationRequest = {
        employeeId,
        locationId,
        policyType,
        requestedDays: daysToDeduct,
        operation: 'deduct',
      };

      // Execute with circuit breaker and retry
      const response = await this.executeWithRetry<HCMBalanceResponse>(
        () => this.makeHCMRequest<HCMBalanceResponse>('POST', '/api/v1/balances/deduct', request)
      );

      const processingTime = Date.now() - startTime;
      this.logger.log(`HCM balance deduction completed in ${processingTime}ms`);

      return response;
    } catch (error) {
      this.logger.error(`HCM balance deduction failed: ${error.message}`, { error, employeeId });
      throw this.handleHCMError(error);
    }
  }

  /**
   * Add balance in HCM system
   * @param employeeId - Employee identifier
   * @param locationId - Location identifier
   * @param policyType - Policy type
   * @param daysToAdd - Days to add
   * @returns Updated balance
   */
  async addBalance(
    employeeId: string,
    locationId: string,
    policyType: string,
    daysToAdd: number
  ): Promise<HCMBalanceResponse> {
    const startTime = Date.now();
    this.logger.log(`Adding balance in HCM for employee ${employeeId}, ${daysToAdd} days`);

    try {
      // Check rate limit
      await this.checkRateLimit();

      // Prepare request
      const request: HCMValidationRequest = {
        employeeId,
        locationId,
        policyType,
        requestedDays: daysToAdd,
        operation: 'add',
      };

      // Execute with circuit breaker and retry
      const response = await this.executeWithRetry<HCMBalanceResponse>(
        () => this.makeHCMRequest<HCMBalanceResponse>('POST', '/api/v1/balances/add', request)
      );

      const processingTime = Date.now() - startTime;
      this.logger.log(`HCM balance addition completed in ${processingTime}ms`);

      return response;
    } catch (error) {
      this.logger.error(`HCM balance addition failed: ${error.message}`, { error, employeeId });
      throw this.handleHCMError(error);
    }
  }

  /**
   * Get current balance from HCM system
   * @param employeeId - Employee identifier
   * @param locationId - Location identifier
   * @param policyType - Policy type
   * @returns Current balance
   */
  async getBalance(
    employeeId: string,
    locationId: string,
    policyType: string
  ): Promise<HCMBalanceResponse> {
    const startTime = Date.now();
    this.logger.log(`Getting balance from HCM for employee ${employeeId}`);

    try {
      // Check rate limit
      await this.checkRateLimit();

      // Execute with circuit breaker and retry
      const response = await this.executeWithRetry<HCMBalanceResponse>(
        () => this.makeHCMRequest<HCMBalanceResponse>(
          'GET',
          `/api/v1/balances/${employeeId}/${locationId}/${policyType}`
        )
      );

      const processingTime = Date.now() - startTime;
      this.logger.log(`HCM balance retrieval completed in ${processingTime}ms`);

      return response;
    } catch (error) {
      this.logger.error(`HCM balance retrieval failed: ${error.message}`, { error, employeeId });
      throw this.handleHCMError(error);
    }
  }

  /**
   * Start batch synchronization with HCM
   * @param request - Batch sync request
   * @returns Batch sync response
   */
  async startBatchSync(request: HCMBatchSyncRequest): Promise<HCMBatchSyncResponse> {
    const startTime = Date.now();
    this.logger.log(`Starting HCM batch sync for ${request.employeeIds?.length || 'all'} employees`);

    try {
      // Check rate limit
      await this.checkRateLimit();

      // Execute with circuit breaker and retry
      const response = await this.executeWithRetry<HCMBatchSyncResponse>(
        () => this.makeHCMRequest<HCMBatchSyncResponse>('POST', '/api/v1/balances/sync', request)
      );

      const processingTime = Date.now() - startTime;
      this.logger.log(`HCM batch sync started in ${processingTime}ms`);

      return response;
    } catch (error) {
      this.logger.error(`HCM batch sync start failed: ${error.message}`, { error });
      throw this.handleHCMError(error);
    }
  }

  /**
   * Get batch sync status
   * @param requestId - Batch sync request ID
   * @returns Batch sync status
   */
  async getBatchSyncStatus(requestId: string): Promise<HCMBatchSyncResponse> {
    const startTime = Date.now();
    this.logger.log(`Getting HCM batch sync status for request ${requestId}`);

    try {
      // Check rate limit
      await this.checkRateLimit();

      // Execute with circuit breaker and retry
      const response = await this.executeWithRetry<HCMBatchSyncResponse>(
        () => this.makeHCMRequest<HCMBatchSyncResponse>('GET', `/api/v1/balances/sync/${requestId}`)
      );

      const processingTime = Date.now() - startTime;
      this.logger.log(`HCM batch sync status retrieved in ${processingTime}ms`);

      return response;
    } catch (error) {
      this.logger.error(`HCM batch sync status retrieval failed: ${error.message}`, { error, requestId });
      throw this.handleHCMError(error);
    }
  }

  /**
   * Check HCM system health
   * @returns Health status
   */
  async checkHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime: number;
    circuitBreakerStatus: string;
    rateLimitStatus: string;
  }> {
    const startTime = Date.now();

    try {
      // Make a simple health check request
      await this.makeHCMRequest('GET', '/api/v1/health');

      const responseTime = Date.now() - startTime;
      const rateLimitUtilization = this.getRateLimitUtilization();

      return {
        status: rateLimitUtilization > 0.8 ? 'degraded' : 'healthy',
        responseTime,
        circuitBreakerStatus: this.circuitBreaker.getState(),
        rateLimitStatus: `${Math.round(rateLimitUtilization * 100)}% utilized`,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'unhealthy',
        responseTime,
        circuitBreakerStatus: this.circuitBreaker.getState(),
        rateLimitStatus: this.getRateLimitUtilization() > 0.8 ? 'high utilization' : 'normal',
      };
    }
  }

  /**
   * Make HTTP request to HCM system
   * @param method - HTTP method
   * @param path - API path
   * @param data - Request body (optional)
   * @returns Response data
   */
  private async makeHCMRequest<T>(method: string, path: string, data?: any): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'time-off-microservice/1.0.0',
    };

    const config = {
      method,
      url,
      headers,
      data,
      timeout: this.timeout,
    };

    this.logger.debug(`Making HCM request: ${method} ${url}`);

    const response = await firstValueFrom(
      this.httpService.request<AxiosResponse<T>>(config).pipe(
        timeout(this.timeout),
        catchError((error) => {
          throw this.handleAxiosError(error);
        })
      )
    );

    return response.data as T;
  }

  /**
   * Execute operation with retry logic
   * @param operation - Operation to execute
   * @returns Operation result
   */
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await this.circuitBreaker.execute(operation);
      } catch (error) {
        lastError = error;

        if (attempt < this.retryAttempts && this.isRetryableError(error)) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff
          this.logger.warn(`HCM request failed, retrying in ${delay}ms (attempt ${attempt}/${this.retryAttempts})`, {
            error: error.message,
          });
          await this.sleep(delay);
        } else {
          break;
        }
      }
    }

    throw lastError;
  }

  /**
   * Check rate limit and wait if necessary
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const windowMs = 60000; // 1 minute window

    // Reset counter if window expired
    if (now - this.lastResetTime > windowMs) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }

    // Check if rate limit exceeded
    if (this.requestCount >= this.rateLimit) {
      const waitTime = windowMs - (now - this.lastResetTime);
      if (waitTime > 0) {
        this.logger.warn(`HCM rate limit exceeded, waiting ${waitTime}ms`);
        await this.sleep(waitTime);
        this.requestCount = 0;
        this.lastResetTime = Date.now();
      }
    }

    this.requestCount++;
  }

  /**
   * Get rate limit utilization
   * @returns Utilization ratio (0-1)
   */
  private getRateLimitUtilization(): number {
    const now = Date.now();
    const windowMs = 60000; // 1 minute window

    if (now - this.lastResetTime > windowMs) {
      return 0;
    }

    return this.requestCount / this.rateLimit;
  }

  /**
   * Check if error is retryable
   * @param error - Error to check
   * @returns True if retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'ENOTFOUND',
      'HCM_TIMEOUT',
      'HCM_RATE_LIMITED',
    ];

    return retryableErrors.some(retryableError => 
      error.message.includes(retryableError) || 
      error.constructor.name === retryableError
    );
  }

  /**
   * Handle Axios errors
   * @param error - Axios error
   * @returns Formatted error
   */
  private handleAxiosError(error: AxiosError): Error {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data as any;

      if (status === 429) {
        return new Error('HCM_RATE_LIMITED');
      }

      if (status >= 500) {
        return new Error(`HCM_SERVER_ERROR: ${status}`);
      }

      if (status === 401) {
        return new Error('HCM_UNAUTHORIZED');
      }

      if (status === 403) {
        return new Error('HCM_FORBIDDEN');
      }

      if (status === 404) {
        return new Error('HCM_NOT_FOUND');
      }

      return new Error(`HCM_ERROR: ${status} - ${data?.message || 'Unknown error'}`);
    } else if (error.request) {
      // Request was made but no response received
      if (error.code === 'ECONNABORTED') {
        return new Error('HCM_TIMEOUT');
      }

      return new Error(`HCM_CONNECTION_ERROR: ${error.code}`);
    } else {
      // Error in request configuration
      return new Error(`HCM_REQUEST_ERROR: ${error.message}`);
    }
  }

  /**
   * Handle HCM-specific errors
   * @param error - Original error
   * @returns Formatted error
   */
  private handleHCMError(error: Error): Error {
    if (error.message.includes('HCM_RATE_LIMITED')) {
      return new Error('HCM system is rate limiting requests. Please try again later.');
    }

    if (error.message.includes('HCM_TIMEOUT')) {
      return new Error('HCM system is not responding. Please try again later.');
    }

    if (error.message.includes('HCM_UNAUTHORIZED')) {
      return new Error('HCM authentication failed. Please check API credentials.');
    }

    if (error.message.includes('HCM_FORBIDDEN')) {
      return new Error('HCM access forbidden. Insufficient permissions.');
    }

    if (error.message.includes('HCM_NOT_FOUND')) {
      return new Error('Requested resource not found in HCM system.');
    }

    if (error.message.includes('CircuitBreakerOpenError')) {
      return new Error('HCM system is temporarily unavailable due to repeated failures.');
    }

    return error;
  }

  /**
   * Sleep for specified milliseconds
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
