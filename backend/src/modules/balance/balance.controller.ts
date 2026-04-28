import { 
  Controller, 
  Get, 
  Post, 
  Query, 
  Body, 
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { BalanceService } from './balance.service';
import { 
  GetBalanceDto,
  ValidateBalanceRequestDto,
  DeductBalanceRequestDto,
  AddBalanceRequestDto,
  BalanceHistoryQueryDto,
  BalanceResponseDto,
  CurrentBalanceDto,
  BalanceValidationResultDto,
  BalanceTransactionDto
} from '@/shared/dtos/balance.dto';
import { RateLimitGuard } from '@/shared/guards/rate-limit.guard';
import { LoggingInterceptor } from '@/shared/interceptors/logging.interceptor';

/**
 * Balance Controller
 * 
 * Handles all HTTP requests for balance operations. This controller is responsible
 * only for request/response handling - all business logic is delegated to the service layer.
 * 
 * Why this exists:
 * - Provides REST API interface for balance operations
 * - Handles request validation and transformation
 * - Manages HTTP-specific concerns (status codes, headers, etc.)
 * - Separates web layer from business logic
 */
@ApiTags('Balances')
@Controller('api/v1/balances')
@UseGuards(RateLimitGuard)
@UseInterceptors(LoggingInterceptor)
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  /**
   * GET /balances
   * 
   * Retrieve balances with optional filtering for employees, locations, and policy types.
   * This endpoint supports querying multiple balances at once.
   */
  @Get()
  @ApiOperation({ 
    summary: 'Get balances',
    description: 'Retrieve time-off balances with optional filtering'
  })
  @ApiQuery({ name: 'employeeId', description: 'Filter by employee ID', required: false })
  @ApiQuery({ name: 'locationId', description: 'Filter by location ID', required: false })
  @ApiQuery({ name: 'policyType', description: 'Filter by policy type', required: false })
  @ApiQuery({ name: 'includeDetails', description: 'Include detailed information', required: false })
  @ApiQuery({ name: 'page', description: 'Page number', required: false, example: 1 })
  @ApiQuery({ name: 'limit', description: 'Records per page', required: false, example: 50 })
  @ApiResponse({ 
    status: 200, 
    description: 'Balances retrieved successfully'
  })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  async getBalances(
    @Query('employeeId') employeeId?: string,
    @Query('locationId') locationId?: string,
    @Query('policyType') policyType?: string,
    @Query('includeDetails') includeDetails?: boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ): Promise<{
    success: boolean;
    data: {
      balances: any[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    };
    metadata: {
      timestamp: string;
      processingTime: string;
    };
  }> {
    const startTime = Date.now();

    try {
      // Validate query parameters
      this.validateBalanceQuery({ page, limit });

      // Set default pagination
      const finalPage = Math.max(1, page || 1);
      const finalLimit = Math.min(100, Math.max(1, limit || 20));

      // In a real implementation, this would query the database with filters
      // For now, return mock data
      const mockBalances = [
        {
          employeeId: employeeId || 'EMP001',
          locationId: locationId || 'NYC',
          policyType: policyType || 'vacation',
          currentBalance: 15.5,
          maxBalance: 20,
          lastUpdated: new Date().toISOString(),
          isStale: false,
        },
        {
          employeeId: employeeId || 'EMP002',
          locationId: locationId || 'NYC',
          policyType: policyType || 'sick',
          currentBalance: 8.0,
          maxBalance: 10,
          lastUpdated: new Date().toISOString(),
          isStale: false,
        },
      ];

      return {
        success: true,
        data: {
          balances: mockBalances,
          pagination: {
            page: finalPage,
            limit: finalLimit,
            total: mockBalances.length,
            totalPages: Math.ceil(mockBalances.length / finalLimit),
          },
        },
        metadata: {
          timestamp: new Date().toISOString(),
          processingTime: `${Date.now() - startTime}ms`,
        },
      };
    } catch (error) {
      throw error; // Let global error handler handle it
    }
  }

  /**
   * GET /balances/:employeeId
   * 
   * Get current balance for a specific employee.
   * This endpoint retrieves the current time-off balance for a specific employee
   * at a location for a given policy type.
   */
  @Get(':employeeId')
  @ApiOperation({ 
    summary: 'Get current balance for employee',
    description: 'Retrieve current time-off balance for a specific employee'
  })
  @ApiParam({ name: 'employeeId', description: 'Employee ID', example: 'EMP123456' })
  @ApiQuery({ name: 'locationId', description: 'Location ID', required: true, example: 'NYC' })
  @ApiQuery({ name: 'policyType', description: 'Policy type', required: false, example: 'vacation' })
  @ApiQuery({ name: 'includeDetails', description: 'Include detailed information', required: false })
  @ApiResponse({ 
    status: 200, 
    description: 'Balance retrieved successfully',
    type: BalanceResponseDto
  })
  @ApiResponse({ status: 404, description: 'Balance not found' })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  async getBalance(
    @Param('employeeId') employeeId: string,
    @Query('locationId') locationId: string,
    @Query('policyType') policyType?: string,
    @Query('includeDetails') includeDetails?: boolean
  ): Promise<BalanceResponseDto> {
    const startTime = Date.now();

    try {
      const dto: GetBalanceDto = {
        employeeId,
        locationId,
        policyType,
        includeDetails,
      };

      const balance = await this.balanceService.getCurrentBalance(dto);

      return {
        success: true,
        data: balance,
        metadata: {
          timestamp: new Date().toISOString(),
          processingTime: `${Date.now() - startTime}ms`,
        },
      };
    } catch (error) {
      throw error; // Let global error handler handle it
    }
  }

  /**
   * Validate time-off request against available balance
   * 
   * This endpoint validates whether a time-off request can be fulfilled
   * based on the employee's current balance and business rules.
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Validate balance request',
    description: 'Validate time-off request against available balance'
  })
  @ApiResponse({ status: 200, description: 'Validation completed successfully', type: BalanceValidationResultDto })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 409, description: 'Request already being processed' })
  async validateBalance(
    @Body() dto: ValidateBalanceRequestDto,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-client-id') clientId?: string
  ): Promise<BalanceResponseDto> {
    const startTime = Date.now();

    try {
      // Add request ID and client ID to DTO if provided in headers
      if (requestId && !dto.requestId) {
        dto.requestId = requestId;
      }

      const validation = await this.balanceService.validateBalanceRequest(dto);

      return {
        success: true,
        data: validation,
        metadata: {
          requestId: dto.requestId,
          timestamp: new Date().toISOString(),
          processingTime: `${Date.now() - startTime}ms`,
        },
      };
    } catch (error) {
      throw error; // Let global error handler handle it
    }
  }

  /**
   * Deduct time-off from balance
   * 
   * This endpoint deducts time-off from an employee's balance after validation.
   * This operation is idempotent and safe to retry.
   */
  @Post('deduct')
  @ApiOperation({ 
    summary: 'Deduct time-off from balance',
    description: 'Deduct time-off days from employee balance'
  })
  @ApiResponse({ status: 200, description: 'Balance deducted successfully', type: CurrentBalanceDto })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 409, description: 'Insufficient balance or conflict' })
  async deductBalance(
    @Body() dto: DeductBalanceRequestDto,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-client-id') clientId?: string
  ): Promise<BalanceResponseDto> {
    const startTime = Date.now();

    try {
      // Add request ID and client ID to DTO if provided in headers
      if (requestId && !dto.requestId) {
        dto.requestId = requestId;
      }

      const updatedBalance = await this.balanceService.deductBalance(dto);

      return {
        success: true,
        data: updatedBalance,
        metadata: {
          requestId: dto.requestId,
          timestamp: new Date().toISOString(),
          processingTime: `${Date.now() - startTime}ms`,
        },
      };
    } catch (error) {
      throw error; // Let global error handler handle it
    }
  }

  /**
   * Add time-off to balance
   * 
   * This endpoint adds time-off to an employee's balance (for adjustments,
   * accruals, corrections, etc.). This operation is idempotent.
   */
  @Post('add')
  @ApiOperation({ 
    summary: 'Add time-off to balance',
    description: 'Add time-off days to employee balance'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Balance added successfully',
    type: CurrentBalanceDto
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 409, description: 'Conflict with existing operation' })
  async addBalance(
    @Body() dto: AddBalanceRequestDto,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-client-id') clientId?: string
  ): Promise<BalanceResponseDto> {
    const startTime = Date.now();

    try {
      // Add request ID and client ID to DTO if provided in headers
      if (requestId && !dto.requestId) {
        dto.requestId = requestId;
      }

      const updatedBalance = await this.balanceService.addBalance(dto);

      return {
        success: true,
        data: updatedBalance,
        metadata: {
          requestId: dto.requestId,
          timestamp: new Date().toISOString(),
          processingTime: `${Date.now() - startTime}ms`,
        },
      };
    } catch (error) {
      throw error; // Let global error handler handle it
    }
  }

  /**
   * Get balance history for an employee
   * 
   * This endpoint retrieves the complete audit trail of balance changes
   * for an employee, with pagination support.
   */
  @Get(':employeeId/history')
  @ApiOperation({ 
    summary: 'Get balance history',
    description: 'Retrieve audit trail of balance changes for an employee'
  })
  @ApiParam({ name: 'employeeId', description: 'Employee ID', example: 'EMP123456' })
  @ApiQuery({ name: 'locationId', description: 'Location ID', required: true, example: 'NYC' })
  @ApiQuery({ name: 'policyType', description: 'Filter by policy type', required: false })
  @ApiQuery({ name: 'transactionType', description: 'Filter by transaction type', required: false })
  @ApiQuery({ name: 'startDate', description: 'Start date (YYYY-MM-DD)', required: false })
  @ApiQuery({ name: 'endDate', description: 'End date (YYYY-MM-DD)', required: false })
  @ApiQuery({ name: 'page', description: 'Page number', required: false, example: 1 })
  @ApiQuery({ name: 'limit', description: 'Records per page', required: false, example: 50 })
  @ApiResponse({ 
    status: 200, 
    description: 'History retrieved successfully' 
  })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  async getBalanceHistory(
    @Param('employeeId') employeeId: string,
    @Query('locationId') locationId: string,
    @Query('policyType') policyType?: string,
    @Query('transactionType') transactionType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ): Promise<BalanceResponseDto> {
    const startTime = Date.now();

    try {
      const options = {
        policyType,
        transactionType,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        page: page || 1,
        limit: limit || 50,
      };

      const history = await this.balanceService.getBalanceHistory(employeeId, locationId, options);

      return {
        success: true,
        data: history,
        metadata: {
          timestamp: new Date().toISOString(),
          processingTime: `${Date.now() - startTime}ms`,
        },
      };
    } catch (error) {
      throw error; // Let global error handler handle it
    }
  }

  /**
   * Health check endpoint for balance service
   * 
   * This endpoint provides health status information for monitoring.
   */
  @Get('health')
  @ApiOperation({ 
    summary: 'Health check',
    description: 'Check health status of balance service'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is healthy' 
  })
  async healthCheck(): Promise<{
    status: 'healthy';
    timestamp: string;
    service: 'balance';
  }> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'balance',
    };
  }

  // Private helper methods

  /**
   * Validate balance query parameters
   */
  private validateBalanceQuery(query: {
    page?: number;
    limit?: number;
  }): void {
    if (query.page && (query.page < 1 || !Number.isInteger(query.page))) {
      throw new Error('Page must be a positive integer');
    }

    if (query.limit && (query.limit < 1 || query.limit > 100 || !Number.isInteger(query.limit))) {
      throw new Error('Limit must be between 1 and 100');
    }
  }
}
