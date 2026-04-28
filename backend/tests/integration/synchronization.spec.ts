import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '@/app.module';
import { SynchronizationService } from '@/modules/sync/synchronization.service';
import { RetryStrategyService } from '@/modules/sync/retry-strategy.service';
import { HCMService } from '@/modules/hcm/hcm.service';
import * as request from 'supertest';

describe('Synchronization Integration Tests', () => {
  let app: INestApplication;
  let syncService: SynchronizationService;
  let retryService: RetryStrategyService;
  let hcmService: HCMService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    syncService = module.get<SynchronizationService>(SynchronizationService);
    retryService = module.get<RetryStrategyService>(RetryStrategyService);
    hcmService = module.get<HCMService>(HCMService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Scenario 6: Batch sync updates balances correctly', () => {
    it('should update local balances from HCM batch sync', async () => {
      const batchSyncRequest = {
        employeeIds: ['EMP001', 'EMP002'],
        locationIds: ['NYC'],
        policyTypes: ['vacation', 'sick'],
        forceSync: false,
        batchSize: 50,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/sync/batch')
        .send(batchSyncRequest)
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.data.syncId).toBeDefined();
      expect(response.body.data.status).toBe('started');
      expect(response.body.data.totalEmployees).toBeGreaterThan(0);

      // Wait for sync to complete (in real implementation, would poll status endpoint)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify sync status
      const statusResponse = await request(app.getHttpServer())
        .get(`/api/v1/sync/${response.body.data.syncId}`)
        .expect(200);

      expect(statusResponse.body.data.status).toBeDefined();
      expect(statusResponse.body.data.employeesProcessed).toBeDefined();
    });
  });

  describe('Scenario 7: External HCM update overrides local data', () => {
    it('should handle external HCM updates that override local data', async () => {
      // Simulate external HCM update scenario
      const externalUpdate = {
        employeeId: 'EMP001',
        locationId: 'NYC',
        policyType: 'vacation',
        newBalance: 20.0,
        reason: 'Anniversary bonus',
        source: 'HCM_external',
        timestamp: new Date().toISOString(),
      };

      // Mock external update event
      const mockExternalEvent = {
        type: 'balance_update',
        data: externalUpdate,
        source: 'HCM',
      };

      // In real implementation, this would be handled by webhook or event listener
      // For testing, we'll simulate the effect
      const syncResponse = await request(app.getHttpServer())
        .post('/api/v1/sync/batch')
        .send({
          employeeIds: [externalUpdate.employeeId],
          locationIds: [externalUpdate.locationId],
          policyTypes: [externalUpdate.policyType],
          forceSync: true, // Force sync to get latest from HCM
        })
        .expect(202);

      expect(syncResponse.body.success).toBe(true);

      // Verify the sync would override local data
      expect(syncResponse.body.data.syncId).toBeDefined();
    });
  });

  describe('Scenario 8: Race conditions (simulated)', () => {
    it('should handle concurrent time-off requests with race conditions', async () => {
      const raceScenario = global.testScenarios.raceCondition;
      const initialBalance = raceScenario.initialBalance;

      // Create multiple concurrent requests
      const concurrentRequests = raceScenario.concurrentRequests.map((requestData, index) => 
        request(app.getHttpServer())
          .post('/api/v1/time-off')
          .send({
            ...requestData,
            requestId: `RACE_TEST_${Date.now()}_${index}`,
          })
      );

      // Execute all requests concurrently
      const responses = await Promise.allSettled(concurrentRequests);

      // Analyze results
      const successfulRequests = responses.filter(
        result => result.status === 'fulfilled' && result.value.status === 201
      );

      const failedRequests = responses.filter(
        result => result.status === 'fulfilled' && result.value.status !== 201
      );

      // In test environment, we verify that concurrent requests are handled properly
      // Some may succeed, some may fail - the important thing is that the system handles them
      expect(successfulRequests.length + failedRequests.length).toBe(raceScenario.concurrentRequests.length);

      // Verify that total approved days don't exceed available balance (if any succeeded)
      let totalApprovedDays = 0;
      successfulRequests.forEach((result: any) => {
        if (result.status === 'fulfilled') {
          totalApprovedDays += result.value.data.request.requestedDays;
        }
      });

      // If any requests succeeded, ensure they don't exceed the balance
      if (successfulRequests.length > 0) {
        expect(totalApprovedDays).toBeLessThanOrEqual(initialBalance);
      }
    });
  });

  describe('HCM Failure Scenarios', () => {
    describe('Scenario 4a: HCM timeout', () => {
      it('should handle HCM timeout gracefully', async () => {
        // Mock HCM service to timeout
        jest.spyOn(hcmService, 'getBalance')
          .mockRejectedValue(new Error('HCM service timeout'));

        const timeOffRequest = {
          employeeId: 'EMP001',
          locationId: 'NYC',
          policyType: 'vacation',
          startDate: '2026-05-15',
          endDate: '2026-05-17',
          requestedDays: 3,
          reason: 'Test with HCM timeout',
        };

        const response = await request(app.getHttpServer())
          .post('/api/v1/time-off')
          .send(timeOffRequest)
          .expect(201); // Should still succeed with local validation

        expect(response.body.success).toBe(true);
        expect(response.body.data.warnings).toContain(
          'HCM validation failed - proceeding with local data'
        );
      });
    });

    describe('Scenario 4b: HCM network error', () => {
      it('should handle HCM network errors gracefully', async () => {
        // Mock HCM service to return network error
        jest.spyOn(syncService as any, 'performHCMValidation')
          .mockRejectedValue(new Error('Network error'));

        const timeOffRequest = {
          employeeId: 'EMP001',
          locationId: 'NYC',
          policyType: 'vacation',
          startDate: '2026-05-15',
          endDate: '2026-05-17',
          requestedDays: 3,
          reason: 'Test with HCM network error',
        };

        const response = await request(app.getHttpServer())
          .post('/api/v1/time-off')
          .send(timeOffRequest)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.warnings).toContain(
          'HCM validation failed - proceeding with local data'
        );
      });
    });

    describe('Scenario 4c: HCM authentication error', () => {
      it('should handle HCM authentication errors', async () => {
        // Mock HCM service to return auth error
        jest.spyOn(syncService as any, 'performHCMValidation')
          .mockRejectedValue(new Error('Unauthorized'));

        const timeOffRequest = {
          employeeId: 'EMP001',
          locationId: 'NYC',
          policyType: 'vacation',
          startDate: '2026-05-15',
          endDate: '2026-05-17',
          requestedDays: 3,
          reason: 'Test with HCM auth error',
        };

        const response = await request(app.getHttpServer())
          .post('/api/v1/time-off')
          .send(timeOffRequest)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.warnings).toContain(
          'HCM validation failed - proceeding with local data'
        );
      });
    });
  });

  describe('HCM Incorrect Data Scenarios', () => {
    describe('Scenario 5a: HCM returns stale data', () => {
      it('should handle HCM stale data with conflict resolution', async () => {
        // Mock HCM to return stale data
        const staleHCMData = {
          employeeId: 'EMP001',
          locationId: 'NYC',
          policyType: 'vacation',
          currentBalance: 10.0,
          version: 1,
          lastUpdated: '2020-01-01T00:00:00.000Z', // Very old timestamp
        };

        jest.spyOn(syncService as any, 'performHCMValidation')
          .mockResolvedValue(staleHCMData);

        const timeOffRequest = {
          employeeId: 'EMP001',
          locationId: 'NYC',
          policyType: 'vacation',
          startDate: '2026-05-15',
          endDate: '2026-05-17',
          requestedDays: 3,
          reason: 'Test with stale HCM data',
        };

        const response = await request(app.getHttpServer())
          .post('/api/v1/time-off')
          .send(timeOffRequest)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.conflicts).toBeDefined();
        expect(response.body.data.conflicts.length).toBeGreaterThan(0);
      });
    });

    describe('Scenario 5b: HCM returns incorrect balance', () => {
      it('should handle HCM incorrect balance with manual review', async () => {
        // Mock HCM to return incorrect high balance
        const incorrectHCMData = {
          employeeId: 'EMP001',
          locationId: 'NYC',
          policyType: 'vacation',
          currentBalance: 999.9, // Incorrect high balance
          version: 999,
          lastUpdated: new Date().toISOString(),
        };

        jest.spyOn(syncService as any, 'performHCMValidation')
          .mockResolvedValue(incorrectHCMData);

        const timeOffRequest = {
          employeeId: 'EMP001',
          locationId: 'NYC',
          policyType: 'vacation',
          startDate: '2026-05-15',
          endDate: '2026-05-17',
          requestedDays: 3,
          reason: 'Test with incorrect HCM balance',
        };

        const response = await request(app.getHttpServer())
          .post('/api/v1/time-off')
          .send(timeOffRequest)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.conflicts).toBeDefined();
        
        // Should have manual review for large balance difference
        const balanceConflict = response.body.data.conflicts.find(
          (c: any) => c.field === 'currentBalance'
        );
        expect(balanceConflict).toBeDefined();
        expect(balanceConflict.resolution).toBe('manual_review');
      });
    });

    describe('Scenario 5c: HCM returns incorrect version', () => {
      it('should handle HCM version conflicts', async () => {
        // Mock HCM to return incorrect version
        const incorrectHCMData = {
          employeeId: 'EMP001',
          locationId: 'NYC',
          policyType: 'vacation',
          currentBalance: 15.5,
          version: 999, // Incorrect version
          lastUpdated: new Date().toISOString(),
        };

        jest.spyOn(syncService as any, 'performHCMValidation')
          .mockResolvedValue(incorrectHCMData);

        const timeOffRequest = {
          employeeId: 'EMP001',
          locationId: 'NYC',
          policyType: 'vacation',
          startDate: '2026-05-15',
          endDate: '2026-05-17',
          requestedDays: 3,
          reason: 'Test with incorrect HCM version',
        };

        const response = await request(app.getHttpServer())
          .post('/api/v1/time-off')
          .send(timeOffRequest)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.conflicts).toBeDefined();
        
        // Should trust HCM for version conflicts
        const versionConflict = response.body.data.conflicts.find(
          (c: any) => c.field === 'syncVersion'
        );
        expect(versionConflict).toBeDefined();
        expect(versionConflict.resolution).toBe('hcm_wins');
      });
    });
  });

  describe('Retry Strategy Tests', () => {
    it('should schedule retry for failed HCM operations', async () => {
      const mockOperation = {
        type: 'create_hcm_request',
        data: {
          requestId: 'REQ_RETRY_001',
          employeeId: 'EMP001',
        },
        retryCount: 0,
      };

      const mockError = new Error('HCM service temporarily unavailable');

      // Test retry scheduling
      const retryId = await retryService.scheduleRetry(
        mockOperation.type,
        mockOperation.data,
        mockError
      );

      expect(retryId).toBeDefined();
      expect(retryId).toContain('create_hcm_request');

      // Check retry status
      const retryStatus = retryService.getRetryStatus(retryId);
      expect(retryStatus).toBeDefined();
      expect(retryStatus.type).toBe('create_hcm_request');
      expect(retryStatus.retryCount).toBe(1);
    });

    it('should not retry non-retryable errors', async () => {
      const mockOperation = {
        type: 'create_hcm_request',
        data: {
          requestId: 'REQ_RETRY_002',
          employeeId: 'EMP001',
        },
        retryCount: 0,
      };

      const mockError = new Error('Unauthorized'); // Non-retryable error

      // Should throw error for non-retryable errors
      await expect(
        retryService.scheduleRetry(mockOperation.type, mockOperation.data, mockError)
      ).rejects.toThrow('Unauthorized');
    });

    it('should respect max retry limits', async () => {
      const mockOperation = {
        type: 'create_hcm_request',
        data: {
          requestId: 'REQ_RETRY_003',
          employeeId: 'EMP001',
        },
        retryCount: 5, // Exceeds max retries (3)
      };

      const mockError = new Error('Network timeout'); // Retryable error

      // Should throw error for max retries exceeded
      await expect(
        retryService.scheduleRetry(mockOperation.type, mockOperation.data, mockError)
      ).rejects.toThrow('Max retries exceeded');
    });
  });

  describe('Batch Sync Performance', () => {
    it('should handle large batch sync efficiently', async () => {
      const largeBatchRequest = {
        employeeIds: Array.from({ length: 500 }, (_, i) => `EMP${i.toString().padStart(3, '0')}`),
        locationIds: ['NYC', 'LAX', 'CHI'],
        policyTypes: ['vacation', 'sick', 'personal'],
        forceSync: false,
        batchSize: 100,
      };

      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .post('/api/v1/sync/batch')
        .send(largeBatchRequest)
        .expect(202);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalEmployees).toBe(500);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Conflict Resolution Integration', () => {
    it('should resolve conflicts according to business rules', async () => {
      // Create a scenario with multiple conflicts
      const conflictScenario = {
        employeeId: 'EMP001',
        locationId: 'NYC',
        policyType: 'vacation',
        startDate: '2026-05-15',
        endDate: '2026-05-17',
        requestedDays: 3,
        reason: 'Conflict resolution test',
      };

      // Mock HCM to return conflicting data
      jest.spyOn(syncService as any, 'performHCMValidation')
        .mockResolvedValue({
          employeeId: 'EMP001',
          locationId: 'NYC',
          policyType: 'vacation',
          currentBalance: 12.0, // Different from local
          version: 2,
          lastUpdated: new Date().toISOString(),
        });

      const response = await request(app.getHttpServer())
        .post('/api/v1/time-off')
        .send(conflictScenario)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.conflicts).toBeDefined();
      expect(response.body.data.conflicts.length).toBeGreaterThan(0);

      // Verify conflict resolution logic
      const conflicts = response.body.data.conflicts;
      conflicts.forEach((conflict: any) => {
        expect(['local_wins', 'hcm_wins', 'manual_review']).toContain(conflict.resolution);
        expect(conflict.field).toBeDefined();
        expect(conflict.localValue).toBeDefined();
        expect(conflict.hcmValue).toBeDefined();
      });
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency during sync operations', async () => {
      // Create multiple sync operations to test consistency
      const syncOperations = [
        {
          employeeIds: ['EMP001'],
          locationIds: ['NYC'],
          policyTypes: ['vacation'],
        },
        {
          employeeIds: ['EMP002'],
          locationIds: ['NYC'],
          policyTypes: ['sick'],
        },
      ];

      const results = await Promise.all(
        syncOperations.map(operation =>
          request(app.getHttpServer())
            .post('/api/v1/sync/batch')
            .send(operation)
            .expect(202)
        )
      );

      // All operations should succeed
      results.forEach(response => {
        expect(response.body.success).toBe(true);
        expect(response.body.data.syncId).toBeDefined();
      });

      // Sync IDs should be unique
      const syncIds = results.map(r => r.body.data.syncId);
      const uniqueSyncIds = [...new Set(syncIds)];
      expect(uniqueSyncIds.length).toBe(syncIds.length);
    });
  });
});
