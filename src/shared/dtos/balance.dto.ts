import { IsString, IsNotEmpty, IsIn, IsNumber, IsPositive, Max, Min, IsOptional, IsDateString, Matches, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Base Balance DTO
 * Contains common fields for balance operations
 */
export class BaseBalanceDto {
  @ApiProperty({
    description: 'Employee identifier from HCM system',
    example: 'EMP123456',
    pattern: '^[A-Z0-9]+$'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]+$/, { message: 'Employee ID must contain only uppercase letters and numbers' })
  employeeId: string;

  @ApiProperty({
    description: 'Location identifier where employee belongs',
    example: 'NYC',
    pattern: '^[A-Z0-9]+$'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]+$/, { message: 'Location ID must contain only uppercase letters and numbers' })
  locationId: string;

  @ApiProperty({
    description: 'Type of time-off policy',
    example: 'vacation',
    enum: ['vacation', 'sick', 'personal', 'bereavement']
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['vacation', 'sick', 'personal', 'bereavement'])
  policyType: string;
}

/**
 * Get Balance Query DTO
 * Used for querying current balance
 */
export class GetBalanceDto extends BaseBalanceDto {
  @ApiPropertyOptional({
    description: 'Include detailed balance information',
    default: false
  })
  @IsOptional()
  @Type(() => Boolean)
  includeDetails?: boolean;
}

/**
 * Validate Balance Request DTO
 * Used for validating time-off requests before deduction
 */
export class ValidateBalanceRequestDto extends BaseBalanceDto {
  @ApiProperty({
    description: 'Number of days requested for time-off',
    example: 5.0,
    minimum: 0.5,
    maximum: 365
  })
  @IsNumber()
  @IsPositive()
  @Min(0.5)
  @Max(365)
  @Type(() => Number)
  requestedDays: number;

  @ApiProperty({
    description: 'Start date of time-off (ISO 8601 format)',
    example: '2026-05-15'
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'End date of time-off (ISO 8601 format)',
    example: '2026-05-19'
  })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    description: 'Unique request identifier for idempotency',
    example: 'req_abc123',
    maxLength: 100
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9_]+$/, { message: 'Request ID must contain only lowercase letters, numbers, and underscores' })
  requestId?: string;

  @ApiPropertyOptional({
    description: 'Reason for time-off request',
    example: 'Family vacation',
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/**
 * Deduct Balance Request DTO
 * Used for deducting time-off from balance
 */
export class DeductBalanceRequestDto extends BaseBalanceDto {
  @ApiProperty({
    description: 'Number of days to deduct from balance',
    example: 5.0,
    minimum: 0.5,
    maximum: 365
  })
  @IsNumber()
  @IsPositive()
  @Min(0.5)
  @Max(365)
  @Type(() => Number)
  daysToDeduct: number;

  @ApiProperty({
    description: 'Reason for time-off deduction',
    example: 'Annual vacation',
    maxLength: 500
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional({
    description: 'External reference identifier (e.g., time-off request ID)',
    example: 'VAC_REQ_789',
    maxLength: 100
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[A-Z0-9_-]+$/, { message: 'Reference ID must contain only uppercase letters, numbers, hyphens, and underscores' })
  referenceId?: string;

  @ApiProperty({
    description: 'Unique request identifier for idempotency',
    example: 'req_def456',
    maxLength: 100
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-z0-9_]+$/, { message: 'Request ID must contain only lowercase letters, numbers, and underscores' })
  requestId: string;
}

/**
 * Add Balance Request DTO
 * Used for adding time-off to balance (adjustments, accruals)
 */
export class AddBalanceRequestDto extends BaseBalanceDto {
  @ApiProperty({
    description: 'Number of days to add to balance',
    example: 2.5,
    minimum: 0.5,
    maximum: 365
  })
  @IsNumber()
  @IsPositive()
  @Min(0.5)
  @Max(365)
  @Type(() => Number)
  daysToAdd: number;

  @ApiProperty({
    description: 'Reason for balance addition',
    example: 'Manager adjustment for overtime',
    maxLength: 500
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;

  @ApiProperty({
    description: 'Type of balance addition',
    example: 'adjustment',
    enum: ['adjustment', 'accrual', 'correction', 'bonus']
  })
  @IsString()
  @IsIn(['adjustment', 'accrual', 'correction', 'bonus'])
  additionType: string;

  @ApiPropertyOptional({
    description: 'External reference identifier',
    example: 'ADJ_123',
    maxLength: 100
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[A-Z0-9_-]+$/, { message: 'Reference ID must contain only uppercase letters, numbers, hyphens, and underscores' })
  referenceId?: string;

  @ApiProperty({
    description: 'Unique request identifier for idempotency',
    example: 'req_ghi789',
    maxLength: 100
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-z0-9_]+$/, { message: 'Request ID must contain only lowercase letters, numbers, and underscores' })
  requestId: string;
}

/**
 * Balance History Query DTO
 * Used for querying balance history
 */
export class BalanceHistoryQueryDto extends BaseBalanceDto {
  @ApiPropertyOptional({
    description: 'Start date for history query (ISO 8601 format)',
    example: '2026-01-01'
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for history query (ISO 8601 format)',
    example: '2026-12-31'
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by transaction type',
    example: 'deduction',
    enum: ['deduction', 'refund', 'adjustment', 'accrual']
  })
  @IsOptional()
  @IsString()
  @IsIn(['deduction', 'refund', 'adjustment', 'accrual'])
  transactionType?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    default: 1
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of records per page',
    example: 50,
    minimum: 1,
    maximum: 200,
    default: 50
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  limit?: number;
}

/**
 * Balance Response DTO
 * Standard response format for balance operations
 */
export class BalanceResponseDto {
  @ApiProperty({
    description: 'Operation success status',
    example: true
  })
  success: boolean;

  @ApiProperty({
    description: 'Response data',
    type: 'object'
  })
  data: any;

  @ApiProperty({
    description: 'Response metadata',
    type: 'object'
  })
  metadata: {
    requestId?: string;
    timestamp: string;
    hcmValidated?: boolean;
    hcmResponseTime?: string;
    processingTime?: string;
  };
}

/**
 * Current Balance DTO
 * Represents current balance information
 */
export class CurrentBalanceDto {
  @ApiProperty({
    description: 'Employee identifier',
    example: 'EMP123456'
  })
  employeeId: string;

  @ApiProperty({
    description: 'Location identifier',
    example: 'NYC'
  })
  locationId: string;

  @ApiProperty({
    description: 'Policy type',
    example: 'vacation'
  })
  policyType: string;

  @ApiProperty({
    description: 'Current available balance in days',
    example: 15.5
  })
  currentBalance: number;

  @ApiProperty({
    description: 'Last HCM synchronization timestamp',
    example: '2026-04-24T01:00:00Z'
  })
  lastSyncAt: string;

  @ApiProperty({
    description: 'Sync version for conflict detection',
    example: 42
  })
  syncVersion: number;

  @ApiProperty({
    description: 'Whether balance data is considered stale',
    example: false
  })
  isStale: boolean;
}

/**
 * Balance Validation Result DTO
 * Result of balance validation operation
 */
export class BalanceValidationResultDto {
  @ApiProperty({
    description: 'Whether validation passed',
    example: true
  })
  isValid: boolean;

  @ApiProperty({
    description: 'Available balance amount',
    example: 15.5
  })
  availableBalance: number;

  @ApiProperty({
    description: 'Requested days',
    example: 5.0
  })
  requestedDays: number;

  @ApiProperty({
    description: 'Remaining balance after deduction',
    example: 10.5
  })
  remainingBalance: number;

  @ApiProperty({
    description: 'List of policy violations',
    example: [],
    type: [String]
  })
  policyViolations: string[];

  @ApiProperty({
    description: 'List of warnings',
    example: ['Request requires manager approval'],
    type: [String]
  })
  warnings: string[];
}

/**
 * Balance Transaction DTO
 * Represents a balance transaction in history
 */
export class BalanceTransactionDto {
  @ApiProperty({
    description: 'Transaction identifier',
    example: 'txn_789012'
  })
  transactionId: string;

  @ApiProperty({
    description: 'Policy type',
    example: 'vacation'
  })
  policyType: string;

  @ApiProperty({
    description: 'Balance before transaction',
    example: 15.5
  })
  balanceBefore: number;

  @ApiProperty({
    description: 'Balance after transaction',
    example: 10.5
  })
  balanceAfter: number;

  @ApiProperty({
    description: 'Amount changed (positive or negative)',
    example: -5.0
  })
  changeAmount: number;

  @ApiProperty({
    description: 'Transaction type',
    example: 'deduction'
  })
  transactionType: string;

  @ApiProperty({
    description: 'External reference identifier',
    example: 'VAC_REQ_789'
  })
  referenceId?: string;

  @ApiProperty({
    description: 'Transaction reason',
    example: 'Annual vacation'
  })
  reason: string;

  @ApiProperty({
    description: 'Source system that initiated transaction',
    example: 'readyon'
  })
  sourceSystem: string;

  @ApiProperty({
    description: 'Transaction timestamp',
    example: '2026-04-24T10:35:00Z'
  })
  createdAt: string;
}
