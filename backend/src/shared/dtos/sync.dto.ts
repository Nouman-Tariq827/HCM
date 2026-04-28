import { IsString, IsNotEmpty, IsIn, IsOptional, IsArray, IsNumber, IsBoolean, Min, Max, Matches, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Trigger Full Sync DTO
 * Used to trigger full batch synchronization
 */
export class TriggerFullSyncDto {
  @ApiProperty({
    description: 'Sync priority level',
    example: 'high',
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  })
  @IsString()
  @IsIn(['low', 'medium', 'high', 'critical'])
  priority: string;

  @ApiPropertyOptional({
    description: 'Specific employee IDs to sync (empty for all employees)',
    example: ['EMP123', 'EMP456'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(/^[A-Z0-9]+$/, { each: true, message: 'Employee IDs must contain only uppercase letters and numbers' })
  employeeIds?: string[];

  @ApiPropertyOptional({
    description: 'Location IDs to filter by',
    example: ['NYC', 'LON'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(/^[A-Z0-9]+$/, { each: true, message: 'Location IDs must contain only uppercase letters and numbers' })
  locationIds?: string[];

  @ApiPropertyOptional({
    description: 'Policy types to sync',
    example: ['vacation', 'sick'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(['vacation', 'sick', 'personal', 'bereavement'], { each: true })
  policyTypes?: string[];

  @ApiPropertyOptional({
    description: 'Force sync even if cache is fresh',
    default: false
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  forceSync?: boolean;

  @ApiPropertyOptional({
    description: 'Batch size for processing',
    example: 500,
    minimum: 10,
    maximum: 5000
  })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(5000)
  @Type(() => Number)
  batchSize?: number;

  @ApiPropertyOptional({
    description: 'Number of concurrent workers',
    example: 10,
    minimum: 1,
    maximum: 50
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  concurrency?: number;
}

/**
 * Incremental Sync DTO
 * Used for incremental synchronization
 */
export class IncrementalSyncDto {
  @ApiProperty({
    description: 'Sync priority level',
    example: 'medium',
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  })
  @IsString()
  @IsIn(['low', 'medium', 'high', 'critical'])
  priority: string;

  @ApiProperty({
    description: 'Employee IDs to sync incrementally',
    example: ['EMP123', 'EMP456'],
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @Matches(/^[A-Z0-9]+$/, { each: true, message: 'Employee IDs must contain only uppercase letters and numbers' })
  employeeIds: string[];

  @ApiPropertyOptional({
    description: 'Location IDs to filter by',
    example: ['NYC', 'LON'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(/^[A-Z0-9]+$/, { each: true, message: 'Location IDs must contain only uppercase letters and numbers' })
  locationIds?: string[];

  @ApiPropertyOptional({
    description: 'Policy types to sync',
    example: ['vacation', 'sick'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(['vacation', 'sick', 'personal', 'bereavement'], { each: true })
  policyTypes?: string[];
}

/**
 * Sync Status Query DTO
 * Used for querying sync operation status
 */
export class SyncStatusQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by sync type',
    example: 'full_batch',
    enum: ['full_batch', 'incremental', 'real_time', 'manual']
  })
  @IsOptional()
  @IsString()
  @IsIn(['full_batch', 'incremental', 'real_time', 'manual'])
  syncType?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    example: 'in_progress',
    enum: ['pending', 'in_progress', 'completed', 'failed', 'cancelled']
  })
  @IsOptional()
  @IsString()
  @IsIn(['pending', 'in_progress', 'completed', 'failed', 'cancelled'])
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by priority',
    example: 'high',
    enum: ['low', 'medium', 'high', 'critical']
  })
  @IsOptional()
  @IsString()
  @IsIn(['low', 'medium', 'high', 'critical'])
  priority?: string;

  @ApiPropertyOptional({
    description: 'Filter by initiated by user',
    example: 'admin@company.com',
    maxLength: 100
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  initiatedBy?: string;

  @ApiPropertyOptional({
    description: 'Start date for filtering (ISO 8601 format)',
    example: '2026-04-01'
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Start date must be in YYYY-MM-DD format' })
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for filtering (ISO 8601 format)',
    example: '2026-04-30'
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'End date must be in YYYY-MM-DD format' })
  endDate?: string;

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
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}

/**
 * Sync Response DTO
 * Standard response format for sync operations
 */
export class SyncResponseDto {
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
    processingTime?: string;
  };
}

/**
 * Sync Operation DTO
 * Represents a sync operation
 */
export class SyncOperationDto {
  @ApiProperty({
    description: 'Sync operation identifier',
    example: 'sync_123456'
  })
  syncId: string;

  @ApiProperty({
    description: 'Type of sync operation',
    example: 'full_batch'
  })
  syncType: string;

  @ApiProperty({
    description: 'Current status',
    example: 'in_progress'
  })
  status: string;

  @ApiProperty({
    description: 'Operation start time',
    example: '2026-04-24T10:40:00Z'
  })
  startedAt: string;

  @ApiPropertyOptional({
    description: 'Estimated completion time',
    example: '2026-04-24T11:05:00Z'
  })
  estimatedCompletion?: string;

  @ApiPropertyOptional({
    description: 'Completion time',
    example: '2026-04-24T11:03:00Z'
  })
  completedAt?: string;

  @ApiProperty({
    description: 'Progress information',
    type: 'object'
  })
  progress: {
    employeesProcessed: number;
    employeesTotal: number;
    percentageComplete: number;
    processingRate?: number; // employees per minute
    estimatedRemaining?: number; // minutes
  };

  @ApiProperty({
    description: 'Conflict information',
    type: 'object'
  })
  conflicts: {
    detected: number;
    resolved: number;
    pending: number;
  };

  @ApiProperty({
    description: 'Operation priority',
    example: 'high'
  })
  priority: string;

  @ApiPropertyOptional({
    description: 'Error message if failed',
    example: 'HCM API timeout'
  })
  errorMessage?: string;

  @ApiProperty({
    description: 'Number of retry attempts',
    example: 2
  })
  retryAttempts: number;

  @ApiPropertyOptional({
    description: 'User who initiated the sync',
    example: 'admin@company.com'
  })
  initiatedBy?: string;
}

/**
 * Sync Trigger Response DTO
 * Response when triggering a sync operation
 */
export class SyncTriggerResponseDto {
  @ApiProperty({
    description: 'Sync operation identifier',
    example: 'sync_123456'
  })
  syncId: string;

  @ApiProperty({
    description: 'Initial status',
    example: 'pending'
  })
  status: string;

  @ApiProperty({
    description: 'Estimated duration in human readable format',
    example: '25 minutes'
  })
  estimatedDuration: string;

  @ApiProperty({
    description: 'Number of employees to process',
    example: 10450
  })
  employeesToProcess: number;

  @ApiProperty({
    description: 'Operation priority',
    example: 'high'
  })
  priority: string;
}

/**
 * Conflict Resolution DTO
 * Used for resolving sync conflicts
 */
export class ConflictResolutionDto {
  @ApiProperty({
    description: 'Sync operation identifier',
    example: 'sync_123456'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9_]+$/, { message: 'Sync ID must contain only lowercase letters, numbers, and underscores' })
  syncId: string;

  @ApiProperty({
    description: 'Conflict resolutions',
    example: [
      {
        employeeId: 'EMP123',
        locationId: 'NYC',
        policyType: 'vacation',
        resolution: 'use_hcm',
        reason: 'HCM is source of truth'
      }
    ],
    type: [Object]
  })
  @IsArray()
  conflicts: ConflictResolutionItemDto[];
}

/**
 * Conflict Resolution Item DTO
 * Individual conflict resolution
 */
export class ConflictResolutionItemDto {
  @ApiProperty({
    description: 'Employee identifier',
    example: 'EMP123'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]+$/, { message: 'Employee ID must contain only uppercase letters and numbers' })
  employeeId: string;

  @ApiProperty({
    description: 'Location identifier',
    example: 'NYC'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]+$/, { message: 'Location ID must contain only uppercase letters and numbers' })
  locationId: string;

  @ApiProperty({
    description: 'Policy type',
    example: 'vacation'
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['vacation', 'sick', 'personal', 'bereavement'])
  policyType: string;

  @ApiProperty({
    description: 'Resolution strategy',
    example: 'use_hcm',
    enum: ['use_hcm', 'use_local', 'manual_review']
  })
  @IsString()
  @IsIn(['use_hcm', 'use_local', 'manual_review'])
  resolution: string;

  @ApiProperty({
    description: 'Reason for resolution',
    example: 'HCM is source of truth',
    maxLength: 500
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

/**
 * Sync Metrics DTO
 * Sync operation metrics and statistics
 */
export class SyncMetricsDto {
  @ApiProperty({
    description: 'Total sync operations',
    example: 1250
  })
  totalSyncs: number;

  @ApiProperty({
    description: 'Successful syncs',
    example: 1180
  })
  successfulSyncs: number;

  @ApiProperty({
    description: 'Failed syncs',
    example: 45
  })
  failedSyncs: number;

  @ApiProperty({
    description: 'Success rate percentage',
    example: 94.4
  })
  successRate: number;

  @ApiProperty({
    description: 'Average sync duration in minutes',
    example: 12.5
  })
  averageDuration: number;

  @ApiProperty({
    description: 'Total employees synchronized',
    example: 125000
  })
  totalEmployeesSynced: number;

  @ApiProperty({
    description: 'Total conflicts detected',
    example: 156
  })
  totalConflictsDetected: number;

  @ApiProperty({
    description: 'Total conflicts resolved',
    example: 142
  })
  totalConflictsResolved: number;

  @ApiProperty({
    description: 'Conflict resolution rate',
    example: 91.0
  })
  conflictResolutionRate: number;

  @ApiPropertyOptional({
    description: 'Average processing rate (employees per minute)',
    example: 150.5
  })
  averageProcessingRate?: number;

  @ApiPropertyOptional({
    description: 'Average conflict rate (conflicts per 1000 employees)',
    example: 1.2
  })
  averageConflictRate?: number;

  @ApiPropertyOptional({
    description: 'Peak processing rate observed',
    example: 500
  })
  peakProcessingRate?: number;

  @ApiPropertyOptional({
    description: 'Daily sync metrics for trend analysis',
    type: 'array',
    items: { type: 'object' }
  })
  dailyMetrics?: any[];

  @ApiProperty({
    description: 'Last sync timestamp',
    example: '2026-04-24T10:30:00Z'
  })
  lastSyncAt: string;

  @ApiProperty({
    description: 'Sync metrics by type',
    type: 'object'
  })
  metricsByType: {
    [syncType: string]: {
      count: number;
      successRate: number;
      averageDuration: number;
      lastSyncAt: string;
    };
  };
}
