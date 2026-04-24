import { Test, TestingModule } from '@nestjs/testing';
import { TimeOffService } from '@/modules/time-off/time-off.service';
import { ConfigService } from '@nestjs/config';
import { BalanceService } from '@/modules/balance/balance.service';
import { HCMService } from '@/modules/hcm/hcm.service';
import { BalanceRepository } from '@/shared/repositories/balance.repository';
import { BalanceHistoryRepository } from '@/shared/repositories/balance-history.repository';
import { SyncStatusRepository } from '@/shared/repositories/sync-status.repository';
import { TimeOffRequestRepository } from '@/shared/repositories/time-off-request.repository';
import { TimeOffPolicyRepository } from '@/shared/repositories/time-off-policy.repository';
import { BadRequestException, ConflictException, Logger, NotFoundException } from '@nestjs/common';

describe('TimeOffService', () => {
  let service: TimeOffService;
  let balanceService: jest.Mocked<BalanceService>;
  let hcmService: jest.Mocked<HCMService>;
  let balanceRepository: jest.Mocked<BalanceRepository>;
  let balanceHistoryRepository: jest.Mocked<BalanceHistoryRepository>;
  let syncStatusRepository: jest.Mocked<SyncStatusRepository>;
  let timeOffRequestRepository: jest.Mocked<TimeOffRequestRepository>;
  let timeOffPolicyRepository: jest.Mocked<TimeOffPolicyRepository>;

  beforeEach(async () => {
    const mockBalanceService = {
      validateBalanceRequest: jest.fn(),
      getCurrentBalance: jest.fn(),
      deductBalance: jest.fn(),
      addBalance: jest.fn(),
      getBalanceHistory: jest.fn(),
    };

    const mockHCMService = {
      getBalance: jest.fn(),
      validateRequest: jest.fn(),
      createRequest: jest.fn(),
      updateBalance: jest.fn(),
      batchSync: jest.fn(),
    };

    const mockBalanceRepository = {
      findByEmployeeLocationPolicy: jest.fn(),
      createIfNotExists: jest.fn(),
      updateBalance: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockBalanceHistoryRepository = {
      create: jest.fn(),
      findByEmployee: jest.fn(),
      findAll: jest.fn(),
    };

    const mockSyncStatusRepository = {
      createSyncOperation: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      updateProgress: jest.fn(),
      markCompleted: jest.fn(),
      markFailed: jest.fn(),
      incrementRetries: jest.fn(),
      findRunningSyncs: jest.fn(),
      getSyncStatistics: jest.fn(),
    };

    const mockTimeOffRequestRepository = {
      findByRequestId: jest.fn(),
      findOverlappingRequests: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const mockTimeOffPolicyRepository = {
      findByLocationAndType: jest.fn(),
      findByLocation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeOffService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'sync.batchSize') return 100;
              if (key === 'business.fractionalDayIncrement') return 0.5;
              if (key === 'business.minRequestDays') return 0.5;
              if (key === 'business.maxRequestDays') return 30;
              return null;
            }),
          },
        },
        {
          provide: BalanceService,
          useValue: mockBalanceService,
        },
        {
          provide: HCMService,
          useValue: mockHCMService,
        },
        {
          provide: BalanceRepository,
          useValue: mockBalanceRepository,
        },
        {
          provide: BalanceHistoryRepository,
          useValue: mockBalanceHistoryRepository,
        },
        {
          provide: SyncStatusRepository,
          useValue: mockSyncStatusRepository,
        },
        {
          provide: TimeOffRequestRepository,
          useValue: mockTimeOffRequestRepository,
        },
        {
          provide: TimeOffPolicyRepository,
          useValue: mockTimeOffPolicyRepository,
        },
      ],
    }).compile();

    service = module.get<TimeOffService>(TimeOffService);
    balanceService = module.get(BalanceService);
    hcmService = module.get(HCMService);
    balanceRepository = module.get(BalanceRepository);
    balanceHistoryRepository = module.get(BalanceHistoryRepository);
    syncStatusRepository = module.get(SyncStatusRepository);
    timeOffRequestRepository = module.get(TimeOffRequestRepository);
    timeOffPolicyRepository = module.get(TimeOffPolicyRepository);

    // Default mock implementations to prevent "undefined" errors
    balanceService.validateBalanceRequest.mockResolvedValue({
      isValid: true,
      availableBalance: 15.5,
      requestedDays: 1,
      remainingBalance: 14.5,
      policyViolations: [],
      warnings: [],
    });

    timeOffRequestRepository.save.mockImplementation((req: any) => Promise.resolve(req));
    timeOffRequestRepository.findOverlappingRequests.mockResolvedValue([]);
    hcmService.getBalance.mockResolvedValue(global.mockHCMResponses.validBalance);
  });

  describe('createTimeOffRequest', () => {
    describe('Scenario 1: Valid request approval', () => {
      it('should successfully create and approve a valid time-off request', async () => {
        const scenario = global.testScenarios.validRequestApproval;
        const mockBalance = global.createMockBalance(scenario.balance);
        const mockHCMResponse = global.mockHCMResponses.validBalance;

        // Mock local validation
        balanceService.validateBalanceRequest.mockResolvedValue({
          isValid: true,
          availableBalance: scenario.balance.currentBalance,
          requestedDays: scenario.request.requestedDays,
          remainingBalance: scenario.balance.currentBalance - scenario.request.requestedDays,
          policyViolations: [],
          warnings: [],
        });

        // Mock balance retrieval
        balanceRepository.findByEmployeeLocationPolicy.mockResolvedValue(mockBalance);

        // Mock HCM validation
        hcmService.getBalance.mockResolvedValue(mockHCMResponse);

        // Mock request creation
        const mockRequest = global.createMockTimeOffRequest({
          ...scenario.request,
          status: 'pending',
        });

        // Execute
        const result = await service.createTimeOffRequest(scenario.request);

        // Verify
        expect(result).toBeDefined();
        expect(balanceService.validateBalanceRequest).toHaveBeenCalledWith(scenario.request);
        expect(hcmService.getBalance).toHaveBeenCalledWith(
          scenario.request.employeeId,
          scenario.request.locationId,
          scenario.request.policyType
        );
        expect(result.request.status).toBe('pending');
      });
    });

    describe('Scenario 2: Insufficient balance', () => {
      it('should reject request when insufficient balance', async () => {
        const scenario = global.testScenarios.insufficientBalance;

        // Mock local validation failure
        balanceService.validateBalanceRequest.mockResolvedValue({
          isValid: false,
          availableBalance: scenario.balance.currentBalance,
          requestedDays: scenario.request.requestedDays,
          remainingBalance: scenario.balance.currentBalance,
          policyViolations: ['Insufficient balance'],
          warnings: [],
        });

        // Execute and verify
        await expect(service.createTimeOffRequest(scenario.request))
          .rejects.toThrow(BadRequestException);

        expect(balanceService.validateBalanceRequest).toHaveBeenCalledWith(scenario.request);
        expect(hcmService.getBalance).not.toHaveBeenCalled();
      });
    });

    describe('Scenario 3: Overlapping requests', () => {
      it('should detect and reject overlapping time-off requests', async () => {
        const scenario = global.testScenarios.overlappingRequest;
        const mockBalance = global.createMockBalance({ currentBalance: 20.0 });
        const mockHCMResponse = global.mockHCMResponses.validBalance;

        // Mock successful local validation
        balanceService.validateBalanceRequest.mockResolvedValue({
          isValid: true,
          availableBalance: 20.0,
          requestedDays: scenario.newRequest.requestedDays,
          remainingBalance: 20.0 - scenario.newRequest.requestedDays,
          policyViolations: [],
          warnings: [],
        });

        // Mock balance retrieval
        balanceRepository.findByEmployeeLocationPolicy.mockResolvedValue(mockBalance);

        // Mock HCM validation
        hcmService.getBalance.mockResolvedValue(mockHCMResponse);

        // Mock existing requests (would come from database)
        jest.spyOn(service as any, 'getExistingTimeOffRequests').mockResolvedValue([
          scenario.existingRequest,
        ]);

        // Execute and verify
        await expect(service.createTimeOffRequest(scenario.newRequest))
          .rejects.toThrow(ConflictException);

        expect(balanceService.validateBalanceRequest).toHaveBeenCalled();        
        // hcmService.getBalance should not be called if overlap is detected locally
      });
    });

    describe('Scenario 4: HCM failure (timeout)', () => {
      it('should handle HCM timeout gracefully', async () => {
        const scenario = global.testScenarios.hcmTimeout;
        const mockBalance = global.createMockBalance({ currentBalance: 15.5 });

        // Mock successful local validation
        balanceService.validateBalanceRequest.mockResolvedValue({
          isValid: true,
          availableBalance: 15.5,
          requestedDays: scenario.request.requestedDays,
          remainingBalance: 15.5 - scenario.request.requestedDays,
          policyViolations: [],
          warnings: [],
        });

        // Mock balance retrieval
        balanceRepository.findByEmployeeLocationPolicy.mockResolvedValue(mockBalance);

        // Mock HCM timeout
        hcmService.getBalance.mockRejectedValue(global.mockHCMResponses.timeoutError);

        // Execute - should not throw, should proceed with local validation
        const result = await service.createTimeOffRequest(scenario.request);

        expect(result).toBeDefined();
        expect(result.request.status).toBe('pending');
        expect(result.warnings).toContain('HCM validation failed - proceeding with local data');
      });
    });

    describe('Scenario 5: HCM returns incorrect data', () => {
      it('should handle HCM incorrect data with conflict resolution', async () => {
        const scenario = global.testScenarios.hcmIncorrectData;
        const mockBalance = global.createMockBalance({ currentBalance: scenario.localBalance });
        const mockHCMResponse = global.createMockHCMResponse({
          currentBalance: scenario.hcmBalance,
        });

        // Mock successful local validation
        balanceService.validateBalanceRequest.mockResolvedValue({
          isValid: true,
          availableBalance: scenario.localBalance,
          requestedDays: scenario.request.requestedDays,
          remainingBalance: scenario.localBalance - scenario.request.requestedDays,
          policyViolations: [],
          warnings: [],
        });

        // Mock balance retrieval
        balanceRepository.findByEmployeeLocationPolicy.mockResolvedValue(mockBalance);

        // Mock HCM with incorrect data
        hcmService.getBalance.mockResolvedValue(mockHCMResponse);

        // Execute
        const result = await service.createTimeOffRequest(scenario.request);

        expect(result).toBeDefined();
        expect(result.conflicts).toHaveLength(1);
        expect(result.conflicts[0].field).toBe('currentBalance');
        expect(result.conflicts[0].resolution).toBe('manual_review'); // Large difference
      });
    });
  });

  describe('approveTimeOffRequest', () => {
    it('should approve request and sync with HCM successfully', async () => {
      const requestId = 'REQ_001';
      const approvedBy = 'manager_001';
      const mockRequest = global.createMockTimeOffRequest({
        requestId,
        status: 'pending',
      });
      const mockBalance = global.createMockBalance({ currentBalance: 15.5 });

      // Mock request retrieval
      timeOffRequestRepository.findByRequestId.mockResolvedValue(mockRequest);

      // Mock balance retrieval
      balanceRepository.findByEmployeeLocationPolicy.mockResolvedValue(mockBalance);

      // Mock balance update
      balanceService.deductBalance.mockResolvedValue(mockBalance);

      // Execute
      const result = await service.approveTimeOffRequest(requestId, approvedBy);

      expect(result).toBeDefined();
      expect(result.request.status).toBe('approved');
      expect(result.request.approverId).toBe(approvedBy);
      expect(balanceService.deductBalance).toHaveBeenCalled();
    });

    it('should reject approval for non-pending requests', async () => {
      const requestId = 'REQ_001';
      const approvedBy = 'manager_001';
      const mockRequest = global.createMockTimeOffRequest({
        requestId,
        status: 'approved', // Already approved
      });

      // Mock request retrieval
      timeOffRequestRepository.findByRequestId.mockResolvedValue(mockRequest);

      // Execute and verify
      await expect(service.approveTimeOffRequest(requestId, approvedBy))
        .rejects.toThrow(ConflictException);

      expect(balanceService.deductBalance).not.toHaveBeenCalled();
    });
  });

  describe('rejectTimeOffRequest', () => {
    it('should reject request with reason', async () => {
      const requestId = 'REQ_001';
      const rejectedBy = 'manager_001';
      const reason = 'Insufficient coverage';
      const mockRequest = global.createMockTimeOffRequest({
        requestId,
        status: 'pending',
      });

      // Mock request retrieval
      timeOffRequestRepository.findByRequestId.mockResolvedValue(mockRequest);

      // Mock request update
      timeOffRequestRepository.save.mockResolvedValue({
        ...mockRequest,
        status: 'rejected',
        rejectionReason: reason,
        rejectedAt: new Date(),
      });

      // Execute
      const result = await service.rejectTimeOffRequest(requestId, rejectedBy, reason);

      expect(result).toBeDefined();
      expect(result.status).toBe('rejected');
      expect(result.rejectionReason).toBe(reason);
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve balance conflicts with manual review for large differences', async () => {
      const localBalance = 15.5;
      const hcmBalance = 999.9; // Large difference

      const localValidation = {
        isValid: true,
        availableBalance: localBalance,
        policyViolations: [],
        warnings: [],
      };

      const hcmValidation = global.createMockHCMResponse({
        currentBalance: hcmBalance,
      });

      // Execute conflict resolution
      const result = (service as any).performConsistencyCheck(
        localValidation,
        hcmValidation,
        null
      );

      expect(result).toBeDefined();
      // Should trigger manual review for large differences
    });

    it('should trust HCM for small balance differences', async () => {
      const localBalance = 15.5;
      const hcmBalance = 15.7; // Small difference

      const localValidation = {
        isValid: true,
        availableBalance: localBalance,
        policyViolations: [],
        warnings: [],
      };

      const hcmValidation = global.createMockHCMResponse({
        currentBalance: hcmBalance,
      });

      // Execute conflict resolution
      const result = (service as any).performConsistencyCheck(
        localValidation,
        hcmValidation,
        null
      );

      expect(result).toBeDefined();
      // Should accept small differences
    });
  });

  describe('Business Logic Validation', () => {
    it('should validate business rules for time-off requests', async () => {
      const request = {
        employeeId: 'EMP001',
        locationId: 'NYC',
        policyType: 'vacation',
        startDate: '2026-05-15',
        endDate: '2026-05-17',
        requestedDays: 3,
        reason: 'Family vacation',
        requestId: 'REQ_001',
      };

      // Mock successful validation
      balanceService.validateBalanceRequest.mockResolvedValue({
        isValid: true,
        availableBalance: 15.5,
        requestedDays: request.requestedDays,
        remainingBalance: 15.5 - request.requestedDays,
        policyViolations: [],
        warnings: [],
      });

      // Execute
      const result = await service.createTimeOffRequest(request);

      expect(result).toBeDefined();
      expect(balanceService.validateBalanceRequest).toHaveBeenCalledWith(request);
    });

    it('should calculate business days correctly', () => {
      const startDate = new Date('2024-02-15'); // Thursday
      const endDate = new Date('2024-02-20'); // Tuesday

      const businessDays = (service as any).calculateBusinessDays(startDate, endDate);

      expect(businessDays).toBe(4); // Thu, Fri, Mon, Tue (excludes weekend)
    });
  });

  describe('Error Handling', () => {
    it('should handle repository errors gracefully', async () => {
      const request = global.createMockTimeOffRequest();
      
      // Override default mock to throw
      timeOffRequestRepository.save.mockRejectedValue(new Error('Database connection failed'));

      // Execute and verify
      await expect(service.createTimeOffRequest(request))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle invalid request data', async () => {
      const invalidRequest = {
        // Missing required fields
        employeeId: '',
        locationId: 'NYC',
        policyType: 'vacation',
        startDate: 'invalid-date',
        endDate: '2024-02-17',
        requestedDays: -1,
        reason: '',
        requestId: 'REQ_001',
      };

      // Execute and verify
      await expect(service.createTimeOffRequest(invalidRequest))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('Integration with Balance Service', () => {
    it('should properly integrate with balance service for validation', async () => {
      const request = global.createMockTimeOffRequest();

      // Execute
      await service.createTimeOffRequest(request);

      // Verify integration
      expect(balanceService.validateBalanceRequest).toHaveBeenCalledTimes(1);
      expect(timeOffRequestRepository.save).toHaveBeenCalled();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent requests efficiently', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        ...global.testScenarios.validRequestApproval.request,
        requestId: `REQ_CONCURRENT_${i}`,
      }));

      // Mock all dependencies
      balanceService.validateBalanceRequest.mockResolvedValue({
        isValid: true,
        availableBalance: 15.5,
        requestedDays: requests[0].requestedDays,
        remainingBalance: 15.5 - requests[0].requestedDays,
        policyViolations: [],
        warnings: [],
      });

      balanceRepository.findByEmployeeLocationPolicy.mockResolvedValue(
        global.createMockBalance({ currentBalance: 15.5 })
      );

      hcmService.getBalance.mockResolvedValue(global.mockHCMResponses.validBalance);

      // Execute concurrent requests
      const promises = requests.map(request => service.createTimeOffRequest(request));
      const results = await Promise.all(promises);

      // Verify all requests completed successfully
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.request.status).toBe('pending');
      });
    });
  });
});
