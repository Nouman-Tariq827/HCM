import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BalanceRepository } from '@/shared/repositories/balance.repository';
import { BalanceHistoryRepository } from '@/shared/repositories/balance-history.repository';
import { IdempotencyKeyRepository } from '@/shared/repositories/idempotency-key.repository';
import { CurrentBalance } from '@/shared/entities/current-balance.entity';
import { BalanceHistory } from '@/shared/entities/balance-history.entity';
import { 
  ValidateBalanceRequestDto, 
  DeductBalanceRequestDto, 
  AddBalanceRequestDto,
  GetBalanceDto,
  BalanceValidationResultDto,
  CurrentBalanceDto,
  BalanceTransactionDto
} from '@/shared/dtos/balance.dto';

/**
 * Balance Service
 * 
 * Core business logic for balance operations including validation, deduction,
 * and history tracking. This service enforces all business rules and ensures
 * data consistency across all operations.
 * 
 * Why this exists:
 * - Centralizes all balance business logic
 * - Enforces policy compliance
 * - Handles conflict resolution
 * - Provides audit trail for all operations
 * - Manages idempotency for safe retries
 */
@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(
    private readonly balanceRepository: BalanceRepository,
    private readonly historyRepository: BalanceHistoryRepository,
    private readonly idempotencyRepository: IdempotencyKeyRepository,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get current balance for an employee
   * @param dto - Balance query parameters
   * @returns Current balance information
   */
  async getCurrentBalance(dto: GetBalanceDto): Promise<CurrentBalanceDto> {
    this.logger.log(`Getting balance for employee ${dto.employeeId} at location ${dto.locationId}`);

    let balance: CurrentBalance;

    if (dto.policyType) {
      // Get specific policy balance
      balance = await this.balanceRepository.findByEmployeeLocationPolicy(
        dto.employeeId,
        dto.locationId,
        dto.policyType
      );

      if (!balance) {
        throw new NotFoundException(`Balance not found for employee ${dto.employeeId}, location ${dto.locationId}, policy ${dto.policyType}`);
      }
    } else {
      // Get all balances for employee
      const balances = await this.balanceRepository.findByEmployee(dto.employeeId, dto.locationId);
      
      if (balances.length === 0) {
        throw new NotFoundException(`No balances found for employee ${dto.employeeId} at location ${dto.locationId}`);
      }

      // Return the first balance for backward compatibility
      balance = balances[0];
    }

    const cacheTtl = this.configService.get<number>('business.cacheTtlBalance');
    const isStale = balance.isStale(cacheTtl);

    return this.mapToCurrentBalanceDto(balance, isStale);
  }

  /**
   * Validate time-off request against available balance
   * @param dto - Validation request parameters
   * @returns Validation result
   */
  async validateBalanceRequest(dto: ValidateBalanceRequestDto): Promise<BalanceValidationResultDto> {
    const startTime = Date.now();
    this.logger.log(`Validating balance request for employee ${dto.employeeId}, ${dto.requestedDays} days`);

    // Check idempotency if request ID provided
    if (dto.requestId) {
      const cachedResult = await this.getCachedValidationResult(dto.requestId, 'balance_validate');
      if (cachedResult) {
        this.logger.log(`Returning cached validation result for request ${dto.requestId}`);
        return cachedResult;
      }
    }

    try {
      // Get current balance
      const balance = await this.getOrCreateBalance(dto.employeeId, dto.locationId, dto.policyType);

      // Validate business rules
      const validationResult = await this.performBalanceValidation(balance, dto);

      // Cache result if request ID provided
      if (dto.requestId) {
        await this.cacheValidationResult(dto.requestId, validationResult);
      }

      const processingTime = Date.now() - startTime;
      this.logger.log(`Balance validation completed in ${processingTime}ms`);

      return validationResult;
    } catch (error) {
      this.logger.error(`Balance validation failed: ${error.message}`, { error, dto });
      throw error;
    }
  }

  /**
   * Deduct time-off from balance
   * @param dto - Deduction request parameters
   * @returns Updated balance information
   */
  async deductBalance(dto: DeductBalanceRequestDto): Promise<CurrentBalanceDto> {
    const startTime = Date.now();
    this.logger.log(`Deducting ${dto.daysToDeduct} days from employee ${dto.employeeId}`);

    // Check idempotency
    const existingOperation = await this.checkIdempotency(
      dto.requestId,
      'balance_deduct',
      dto.employeeId,
      dto.policyType
    );

    if (existingOperation) {
      this.logger.log(`Returning cached result for idempotent request ${dto.requestId}`);
      return existingOperation;
    }

    try {
      // Create idempotency key
      await this.idempotencyRepository.createIdempotencyKey({
        requestId: dto.requestId,
        clientId: 'readyon', // Should come from auth context
        operationType: 'balance_deduct',
        employeeId: dto.employeeId,
        policyType: dto.policyType,
        requestHash: IdempotencyKeyRepository.generateRequestHash(dto),
      });

      // Get current balance
      const balance = await this.getOrCreateBalance(dto.employeeId, dto.locationId, dto.policyType);

      // Validate deduction
      if (!balance.hasSufficientBalance(dto.daysToDeduct)) {
        await this.idempotencyRepository.markFailed(dto.requestId, 'readyon', 
          `Insufficient balance. Available: ${balance.currentBalance}, Requested: ${dto.daysToDeduct}`,
          Date.now() - startTime
        );
        throw new ConflictException(`Insufficient balance. Available: ${balance.currentBalance}, Requested: ${dto.daysToDeduct}`);
      }

      // Perform deduction with optimistic locking
      const updatedBalance = await this.performDeduction(balance, dto);

      // Record history
      await this.recordBalanceHistory({
        employeeId: dto.employeeId,
        locationId: dto.locationId,
        policyType: dto.policyType,
        balanceBefore: balance.currentBalance,
        balanceAfter: updatedBalance.currentBalance,
        changeAmount: -dto.daysToDeduct,
        transactionType: 'deduction',
        referenceId: dto.referenceId,
        reason: dto.reason,
        sourceSystem: 'readyon',
      });

      // Mark idempotency key as completed
      const processingTime = Date.now() - startTime;
      await this.idempotencyRepository.markCompleted(dto.requestId, 'readyon', 
        this.mapToCurrentBalanceDto(updatedBalance), processingTime
      );

      this.logger.log(`Balance deduction completed in ${processingTime}ms`);

      return this.mapToCurrentBalanceDto(updatedBalance);
    } catch (error) {
      // Mark idempotency key as failed if it exists
      try {
        await this.idempotencyRepository.markFailed(dto.requestId, 'readyon', error, Date.now() - startTime);
      } catch (idempotencyError) {
        this.logger.error('Failed to mark idempotency key as failed', { error: idempotencyError });
      }

      this.logger.error(`Balance deduction failed: ${error.message}`, { error, dto });
      throw error;
    }
  }

  /**
   * Add time-off to balance
   * @param dto - Addition request parameters
   * @returns Updated balance information
   */
  async addBalance(dto: AddBalanceRequestDto): Promise<CurrentBalanceDto> {
    const startTime = Date.now();
    this.logger.log(`Adding ${dto.daysToAdd} days to employee ${dto.employeeId}`);

    // Check idempotency
    const existingOperation = await this.checkIdempotency(
      dto.requestId,
      'balance_add',
      dto.employeeId,
      dto.policyType
    );

    if (existingOperation) {
      this.logger.log(`Returning cached result for idempotent request ${dto.requestId}`);
      return existingOperation;
    }

    try {
      // Create idempotency key
      await this.idempotencyRepository.createIdempotencyKey({
        requestId: dto.requestId,
        clientId: 'readyon',
        operationType: 'balance_add',
        employeeId: dto.employeeId,
        policyType: dto.policyType,
        requestHash: IdempotencyKeyRepository.generateRequestHash(dto),
      });

      // Get current balance
      const balance = await this.getOrCreateBalance(dto.employeeId, dto.locationId, dto.policyType);

      // Perform addition with optimistic locking
      const updatedBalance = await this.performAddition(balance, dto);

      // Record history
      await this.recordBalanceHistory({
        employeeId: dto.employeeId,
        locationId: dto.locationId,
        policyType: dto.policyType,
        balanceBefore: balance.currentBalance,
        balanceAfter: updatedBalance.currentBalance,
        changeAmount: dto.daysToAdd,
        transactionType: dto.additionType,
        referenceId: dto.referenceId,
        reason: dto.reason,
        sourceSystem: 'readyon',
      });

      // Mark idempotency key as completed
      const processingTime = Date.now() - startTime;
      await this.idempotencyRepository.markCompleted(dto.requestId, 'readyon', 
        this.mapToCurrentBalanceDto(updatedBalance), processingTime
      );

      this.logger.log(`Balance addition completed in ${processingTime}ms`);

      return this.mapToCurrentBalanceDto(updatedBalance);
    } catch (error) {
      // Mark idempotency key as failed if it exists
      try {
        await this.idempotencyRepository.markFailed(dto.requestId, 'readyon', error, Date.now() - startTime);
      } catch (idempotencyError) {
        this.logger.error('Failed to mark idempotency key as failed', { error: idempotencyError });
      }

      this.logger.error(`Balance addition failed: ${error.message}`, { error, dto });
      throw error;
    }
  }

  /**
   * Get balance history for an employee
   * @param employeeId - Employee identifier
   * @param locationId - Location identifier
   * @param options - Query options
   * @returns Paginated balance history
   */
  async getBalanceHistory(
    employeeId: string,
    locationId: string,
    options: {
      policyType?: string;
      transactionType?: string;
      startDate?: Date;
      endDate?: Date;
      page: number;
      limit: number;
    }
  ) {
    this.logger.log(`Getting balance history for employee ${employeeId} at location ${locationId}`);

    const result = await this.historyRepository.findByEmployeeWithPagination(
      employeeId,
      locationId,
      options
    );

    return {
      ...result,
      data: result.data.map(this.mapToBalanceTransactionDto),
    };
  }

  /**
   * Get or create balance record
   * @param employeeId - Employee identifier
   * @param locationId - Location identifier
   * @param policyType - Policy type
   * @returns Balance record
   */
  private async getOrCreateBalance(
    employeeId: string,
    locationId: string,
    policyType: string
  ): Promise<CurrentBalance> {
    let balance = await this.balanceRepository.findByEmployeeLocationPolicy(
      employeeId,
      locationId,
      policyType
    );

    if (!balance) {
      this.logger.log(`Creating new balance record for employee ${employeeId}, policy ${policyType}`);
      try {
        balance = await this.balanceRepository.createIfNotExists(employeeId, locationId, policyType, 0);
      } catch (error) {
        // Fallback for test environment - try direct creation
        this.logger.warn(`Transaction failed, trying direct creation: ${error.message}`);
        const newBalance = new CurrentBalance();
        newBalance.employeeId = employeeId;
        newBalance.locationId = locationId;
        newBalance.policyType = policyType;
        newBalance.currentBalance = 0;
        newBalance.syncVersion = 1;
        balance = await this.balanceRepository.save(newBalance);
      }
    }

    return balance;
  }

  /**
   * Perform balance validation
   * @param balance - Current balance
   * @param dto - Validation request
   * @returns Validation result
   */
  private async performBalanceValidation(
    balance: CurrentBalance,
    dto: ValidateBalanceRequestDto
  ): Promise<BalanceValidationResultDto> {
    const result: BalanceValidationResultDto = {
      isValid: true,
      availableBalance: balance.currentBalance,
      requestedDays: dto.requestedDays,
      remainingBalance: balance.currentBalance - dto.requestedDays,
      policyViolations: [],
      warnings: [],
    };

    // Check sufficient balance
    if (!balance.hasSufficientBalance(dto.requestedDays)) {
      result.isValid = false;
      result.policyViolations.push(`Insufficient balance. Available: ${balance.currentBalance}, Requested: ${dto.requestedDays}`);
    }

    // Validate fractional days (business rule)
    const fractionalIncrement = this.configService.get<number>('business.fractionalDayIncrement');
    if (dto.requestedDays % fractionalIncrement !== 0) {
      result.isValid = false;
      result.policyViolations.push(`Requested days must be in ${fractionalIncrement} day increments`);
    }

    // Check maximum days per transaction
    const maxDaysPerTransaction = this.configService.get<number>('business.maxRequestDaysPerTransaction');
    if (dto.requestedDays > maxDaysPerTransaction) {
      result.isValid = false;
      result.policyViolations.push(`Maximum ${maxDaysPerTransaction} days per transaction`);
    }

    // Add warnings for edge cases
    if (result.remainingBalance < 1) {
      result.warnings.push('Low balance remaining after this request');
    }

    return result;
  }

  /**
   * Perform balance deduction with optimistic locking
   * @param balance - Current balance
   * @param dto - Deduction request
   * @returns Updated balance
   */
  private async performDeduction(
    balance: CurrentBalance,
    dto: DeductBalanceRequestDto
  ): Promise<CurrentBalance> {
    try {
      return await this.balanceRepository.deductBalance(
        balance.employeeId,
        balance.locationId,
        balance.policyType,
        dto.daysToDeduct,
        balance.syncVersion
      );
    } catch (error) {
      if (error.message.includes('version mismatch')) {
        throw new ConflictException('Balance was modified by another operation. Please retry.');
      }
      throw error;
    }
  }

  /**
   * Perform balance addition with optimistic locking
   * @param balance - Current balance
   * @param dto - Addition request
   * @returns Updated balance
   */
  private async performAddition(
    balance: CurrentBalance,
    dto: AddBalanceRequestDto
  ): Promise<CurrentBalance> {
    try {
      return await this.balanceRepository.addBalance(
        balance.employeeId,
        balance.locationId,
        balance.policyType,
        dto.daysToAdd,
        balance.syncVersion
      );
    } catch (error) {
      if (error.message.includes('version mismatch')) {
        throw new ConflictException('Balance was modified by another operation. Please retry.');
      }
      throw error;
    }
  }

  /**
   * Record balance history
   * @param historyData - History record data
   */
  private async recordBalanceHistory(historyData: {
    employeeId: string;
    locationId: string;
    policyType: string;
    balanceBefore: number;
    balanceAfter: number;
    changeAmount: number;
    transactionType: string;
    referenceId?: string;
    reason: string;
    sourceSystem: string;
  }): Promise<void> {
    try {
      await this.historyRepository.createHistoryRecord(historyData);
    } catch (error) {
      this.logger.error('Failed to record balance history', { error, historyData });
      // Don't throw error - history recording failure shouldn't break the main operation
    }
  }

  /**
   * Check idempotency for a request
   * @param requestId - Request identifier
   * @param operationType - Operation type
   * @param employeeId - Employee identifier
   * @param policyType - Policy type
   * @returns Cached result if exists
   */
  private async checkIdempotency(
    requestId: string,
    operationType: string,
    employeeId: string,
    policyType: string
  ): Promise<CurrentBalanceDto | null> {
    const key = await this.idempotencyRepository.findByRequestAndClient(requestId, 'readyon');
    
    if (key) {
      if (key.isProcessing()) {
        throw new ConflictException('Request is already being processed');
      }
      
      if (key.isCompleted()) {
        return key.getResponseData();
      }
      
      if (key.isFailed()) {
        throw new BadRequestException(`Request previously failed: ${key.errorMessage}`);
      }
    }

    return null;
  }

  /**
   * Get cached validation result
   * @param requestId - Request identifier
   * @param operationType - Operation type
   * @returns Cached validation result
   */
  private async getCachedValidationResult(
    requestId: string,
    operationType: string
  ): Promise<BalanceValidationResultDto | null> {
    const key = await this.idempotencyRepository.findByRequestAndClient(requestId, 'readyon');
    
    if (key && key.isCompleted()) {
      return key.getResponseData();
    }

    return null;
  }

  /**
   * Cache validation result
   * @param requestId - Request identifier
   * @param result - Validation result
   */
  private async cacheValidationResult(
    requestId: string,
    result: BalanceValidationResultDto
  ): Promise<void> {
    try {
      await this.idempotencyRepository.createIdempotencyKey({
        requestId,
        clientId: 'readyon',
        operationType: 'balance_validate',
        requestHash: IdempotencyKeyRepository.generateRequestHash(result),
        ttlHours: 1, // Short TTL for validation results
      });

      await this.idempotencyRepository.markCompleted(requestId, 'readyon', result, 0);
    } catch (error) {
      this.logger.error('Failed to cache validation result', { error, requestId });
      // Don't throw error - caching failure shouldn't break the operation
    }
  }

  /**
   * Map CurrentBalance entity to DTO
   * @param balance - Balance entity
   * @param isStale - Whether balance is stale
   * @returns Balance DTO
   */
  private mapToCurrentBalanceDto(balance: CurrentBalance, isStale: boolean = false): CurrentBalanceDto {
    return {
      employeeId: balance.employeeId,
      locationId: balance.locationId,
      policyType: balance.policyType,
      currentBalance: balance.currentBalance,
      lastSyncAt: balance.lastSyncAt?.toISOString() || null,
      syncVersion: balance.syncVersion,
      isStale,
    };
  }

  /**
   * Map BalanceHistory entity to DTO
   * @param history - History entity
   * @returns Balance transaction DTO
   */
  private mapToBalanceTransactionDto(history: BalanceHistory): BalanceTransactionDto {
    return {
      transactionId: `txn_${history.id}`,
      policyType: history.policyType,
      balanceBefore: history.balanceBefore,
      balanceAfter: history.balanceAfter,
      changeAmount: history.changeAmount,
      transactionType: history.transactionType,
      referenceId: history.referenceId,
      reason: history.reason,
      sourceSystem: history.sourceSystem,
      createdAt: history.createdAt.toISOString(),
    };
  }
}
