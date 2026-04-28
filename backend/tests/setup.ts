import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { Logger } from '@nestjs/common';

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  process.env.PORT = '3001';
  process.env.DB_TYPE = 'sqlite';
  process.env.DB_DATABASE = ':memory:';
  process.env.DB_SYNCHRONIZE = 'true';
  process.env.DB_LOGGING = 'false';
  process.env.HCM_BASE_URL = 'http://localhost:3001';
  process.env.HCM_TIMEOUT = '5000';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.JWT_EXPIRES_IN = '24h';
  process.env.RATE_LIMIT_WINDOW_MS = '60000';
  process.env.RATE_LIMIT_MAX_REQUESTS = '1000';
  process.env.BUSINESS_MAX_DAYS_PER_REQUEST = '10';
  process.env.BUSINESS_MIN_NOTICE_DAYS = '1';
  process.env.SYNC_BATCH_SIZE = '50';
  process.env.SYNC_MAX_RETRIES = '3';
  process.env.METRICS_ENABLED = 'false';
});

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test utilities
global.createTestingModule = async (providers: any[], imports: any[] = []) => {
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [],
      }),
      ...imports,
    ],
    providers,
  }).compile();
};

// Mock data factories
global.createMockEmployee = (overrides = {}) => ({
  employeeId: 'EMP001',
  locationId: 'NYC',
  department: 'Engineering',
  hireDate: '2020-01-15',
  ...overrides,
});

global.createMockBalance = (overrides = {}) => ({
  employeeId: 'EMP001',
  locationId: 'NYC',
  policyType: 'vacation',
  currentBalance: 15.5,
  maxBalance: 20,
  version: 1,
  hcmVersion: 1,
  lastSyncAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

global.createMockTimeOffRequest = (overrides = {}) => {
  const request = {
    requestId: 'REQ_001',
    employeeId: 'EMP001',
    locationId: 'NYC',
    policyType: 'vacation',
    startDate: new Date('2026-05-15'),
    endDate: new Date('2026-05-17'),
    requestedDays: 3,
    reason: 'Family vacation',
    status: 'pending',
    priority: 'normal',
    department: 'Engineering',
    balanceAtRequest: 15.5,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  // Add methods that behave like the entity
  (request as any).approve = jest.fn(function(approverId, approverName) {
    this.status = 'approved';
    this.approverId = approverId;
    this.approvedAt = new Date();
  });

  (request as any).reject = jest.fn(function(reason) {
    this.status = 'rejected';
    this.rejectionReason = reason;
    this.rejectedAt = new Date();
  });

  (request as any).validate = jest.fn();
  (request as any).markAsSynchronized = jest.fn();
  (request as any).markSyncFailed = jest.fn();
  (request as any).resetSyncStatus = jest.fn();

  return request;
};

global.createMockHCMResponse = (overrides = {}) => ({
  employeeId: 'EMP001',
  locationId: 'NYC',
  policyType: 'vacation',
  currentBalance: 15.5,
  version: 1,
  lastUpdated: new Date().toISOString(),
  ...overrides,
});

// Test helpers
global.sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

global.waitForCondition = async (
  condition: () => boolean,
  timeout = 5000,
  interval = 100
) => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (condition()) {
      return true;
    }
    await global.sleep(interval);
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
};

// Mock HCM service responses
global.mockHCMResponses = {
  validBalance: {
    employeeId: 'EMP001',
    locationId: 'NYC',
    policyType: 'vacation',
    currentBalance: 15.5,
    version: 1,
    lastUpdated: new Date().toISOString(),
  },
  insufficientBalance: {
    employeeId: 'EMP001',
    locationId: 'NYC',
    policyType: 'vacation',
    currentBalance: 1.0,
    version: 1,
    lastUpdated: new Date().toISOString(),
  },
  incorrectData: {
    employeeId: 'EMP001',
    locationId: 'NYC',
    policyType: 'vacation',
    currentBalance: 999.9, // Incorrect high balance
    version: 999, // Incorrect version
    lastUpdated: '2020-01-01T00:00:00.000Z', // Stale timestamp
  },
  timeoutError: new Error('HCM service timeout'),
  networkError: new Error('Network error'),
  authError: new Error('Unauthorized'),
};

// Test scenarios
global.testScenarios = {
  validRequestApproval: {
    request: {
      employeeId: 'EMP001',
      locationId: 'NYC',
      policyType: 'vacation',
      startDate: '2026-05-15',
      endDate: '2026-05-17',
      requestedDays: 3,
      reason: 'Family vacation',
      requestId: 'REQ_001',
    },
    balance: {
      currentBalance: 15.5,
      maxBalance: 20,
    },
    expectedStatus: 'approved',
  },
  insufficientBalance: {
    request: {
      employeeId: 'EMP001',
      locationId: 'NYC',
      policyType: 'vacation',
      startDate: '2026-05-15',
      endDate: '2026-05-25',
      requestedDays: 10,
      reason: 'Extended vacation',
      requestId: 'REQ_002',
    },
    balance: {
      currentBalance: 5.0,
      maxBalance: 20,
    },
    expectedError: 'Insufficient balance',
  },
  overlappingRequest: {
    existingRequest: {
      requestId: 'REQ_003',
      employeeId: 'EMP001',
      locationId: 'NYC',
      policyType: 'vacation',
      startDate: '2026-05-15',
      endDate: '2026-05-17',
      status: 'approved',
    },
    newRequest: {
      employeeId: 'EMP001',
      locationId: 'NYC',
      policyType: 'vacation',
      startDate: '2026-05-16',
      endDate: '2026-05-18',
      requestedDays: 3,
      reason: 'Overlapping vacation',
      requestId: 'REQ_004',
    },
    expectedError: 'Overlapping time-off request detected',
  },
  hcmTimeout: {
    request: {
      employeeId: 'EMP001',
      locationId: 'NYC',
      policyType: 'vacation',
      startDate: '2026-05-15',
      endDate: '2026-05-17',
      requestedDays: 3,
      reason: 'Family vacation',
      requestId: 'REQ_005',
    },
    hcmError: 'timeout',
    expectedBehavior: 'proceed with local validation',
  },
  hcmIncorrectData: {
    request: {
      employeeId: 'EMP001',
      locationId: 'NYC',
      policyType: 'vacation',
      startDate: '2026-05-15',
      endDate: '2026-05-17',
      requestedDays: 3,
      reason: 'Family vacation',
      requestId: 'REQ_006',
    },
    localBalance: 15.5,
    hcmBalance: 999.9,
    expectedResolution: 'local_wins',
  },
  batchSyncUpdate: {
    employees: [
      {
        employeeId: 'EMP001',
        locationId: 'NYC',
        policyType: 'vacation',
        localBalance: 15.5,
        hcmBalance: 18.0,
        expectedUpdate: 18.0,
      },
      {
        employeeId: 'EMP002',
        locationId: 'NYC',
        policyType: 'sick',
        localBalance: 8.0,
        hcmBalance: 7.5,
        expectedUpdate: 7.5,
      },
    ],
  },
  externalHCMOverride: {
    scenario: 'external_update',
    localBalance: 15.5,
    externalUpdate: {
      employeeId: 'EMP001',
      locationId: 'NYC',
      policyType: 'vacation',
      newBalance: 20.0,
      reason: 'Anniversary bonus',
      source: 'HCM_external',
    },
    expectedBehavior: 'local_balance_updated',
  },
  raceCondition: {
    concurrentRequests: [
      {
        requestId: 'REQ_RACE_1',
        employeeId: 'EMP001',
        locationId: 'NYC',
        policyType: 'vacation',
        startDate: '2026-05-15',
        endDate: '2026-05-17',
        requestedDays: 3,
      },
      {
        requestId: 'REQ_RACE_2',
        employeeId: 'EMP001',
        locationId: 'NYC',
        policyType: 'vacation',
        startDate: '2026-05-18',
        endDate: '2026-05-20',
        requestedDays: 3,
      },
    ],
    initialBalance: 10.0,
    expectedBehavior: 'only_one_succeeds',
  },
};

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

// Cleanup after all tests
afterAll(async () => {
  // Clean up any resources
  await global.sleep(100);
});
