# Mock HCM Service Usage Guide

## Overview

The Mock HCM Service simulates a real-world HCM (Human Capital Management) system with configurable unreliability. This service is critical for testing the robustness and resilience of the Time-Off Microservice under various failure scenarios.

## 🎯 Purpose

- **Validate Error Handling**: Test retry logic, circuit breakers, and fallback mechanisms
- **Test Data Consistency**: Validate conflict resolution and data synchronization
- **Stress Testing**: Push the system to its limits with worst-case scenarios
- **Integration Testing**: Simulate real-world external system behavior
- **Performance Testing**: Test timeout handling and response time management

## 🚀 Quick Start

### Basic Usage

```typescript
import { MockHCMService } from '@/modules/hcm/mock-hcm.service';
import { getMockHCMScenario } from '@/modules/hcm/mock-hcm.config';

// Get the mock service instance
const mockHCM = app.get(MockHCMService);

// Apply a predefined scenario
const scenario = getMockHCMScenario('unreliable_network');
mockHCM.updateConfiguration(scenario.config);

// Use it like the real HCM service
const balance = await mockHCM.getBalance('EMP001', 'NYC', 'vacation');
```

### Environment Configuration

```bash
# .env file
MOCK_HCM_NETWORK_FAILURE_RATE=0.3
MOCK_HCM_SERVER_ERROR_RATE=0.1
MOCK_HCM_TIMEOUT_RATE=0.05
MOCK_HCM_STALE_DATA_RATE=0.2
MOCK_HCM_INCONSISTENT_DATA_RATE=0.1
MOCK_HCM_MIN_RESPONSE_TIME=200
MOCK_HCM_MAX_RESPONSE_TIME=2000
MOCK_HCM_TIMEOUT_TIME=5000
MOCK_HCM_BATCH_SIZE=100
MOCK_HCM_FAILURE_POINT=0
MOCK_HCM_ANNIVERSARY_BONUS_ENABLED=true
```

## 📋 Available Scenarios

### 1. Normal Operation
```typescript
const scenario = getMockHCMScenario('normal');
// Minimal failures for baseline testing
```

### 2. Unreliable Network
```typescript
const scenario = getMockHCMScenario('unreliable_network');
// 30% network failures, 10% timeouts
// Tests retry mechanisms and connection resilience
```

### 3. Server Instability
```typescript
const scenario = getMockHCMScenario('server_instability');
// 40% server errors
// Tests circuit breaker and fallback logic
```

### 4. Slow Responses
```typescript
const scenario = getMockHCMScenario('slow_responses');
// 2-10 second response times, 30% timeouts
// Tests timeout handling and performance
```

### 5. Stale Data
```typescript
const scenario = getMockHCMScenario('stale_data');
// 60% stale data, 6-hour threshold
// Tests data freshness validation
```

### 6. Inconsistent Data
```typescript
const scenario = getMockHCMScenario('inconsistent_data');
// 40% inconsistent data, high variance
// Tests conflict resolution
```

### 7. Batch Sync Failures
```typescript
const scenario = getMockHCMScenario('batch_sync_failures');
// Fails after 50 employees
// Tests batch operation resilience
```

### 8. External Updates
```typescript
const scenario = getMockHCMScenario('external_updates');
// Frequent anniversary bonuses
// Tests external system integration
```

### 9. Worst Case Scenario
```typescript
const scenario = getMockHCMScenario('worst_case');
// Maximum failure rates
// Stress testing
```

### 10. Recovery Scenario
```typescript
const scenario = getMockHCMScenario('recovery');
// Starts with failures, then recovers
// Tests recovery mechanisms
```

## 🔧 Configuration Options

### Failure Rates (0.0 - 1.0)
- `networkFailureRate`: Probability of network connection failures
- `serverErrorRate`: Probability of server-side errors
- `timeoutRate`: Probability of request timeouts
- `staleDataRate`: Probability of returning stale data
- `inconsistentDataRate`: Probability of returning inconsistent data

### Timing (milliseconds)
- `minResponseTime`: Minimum response time
- `maxResponseTime`: Maximum response time
- `timeoutTime`: Request timeout threshold
- `processingDelay`: Delay per employee in batch operations

### Data Behavior
- `maxBalanceVariance`: Maximum variance in balance data
- `staleDataThreshold`: Hours before data becomes stale
- `batchSize`: Number of employees per batch
- `failurePoint`: Fail after N employees (0 = no failure)

### External Updates
- `anniversaryBonusEnabled`: Enable automatic balance updates
- `anniversaryBonusAmount`: Days to add as bonus
- `anniversaryBonusFrequency`: Days between bonus updates

## 🧪 Testing Scenarios

### 1. Testing Retry Logic

```typescript
// Set up high failure rate
mockHCM.updateConfiguration({
  networkFailureRate: 0.5,
  serverErrorRate: 0.3,
  minResponseTime: 1000,
  maxResponseTime: 5000,
});

// Test retry mechanism
try {
  const balance = await mockHCM.getBalance('EMP001', 'NYC', 'vacation');
  console.log('Success after retries');
} catch (error) {
  console.log('Failed after retries:', error.message);
}
```

### 2. Testing Circuit Breaker

```typescript
// Set up server instability
mockHCM.updateConfiguration({
  serverErrorRate: 0.8, // 80% server errors
  minResponseTime: 2000,
  maxResponseTime: 8000,
});

// Make multiple requests to trigger circuit breaker
for (let i = 0; i < 10; i++) {
  try {
    await mockHCM.getBalance('EMP001', 'NYC', 'vacation');
  } catch (error) {
    console.log(`Request ${i + 1} failed:`, error.message);
  }
}
```

### 3. Testing Data Consistency

```typescript
// Set up inconsistent data
mockHCM.updateConfiguration({
  inconsistentDataRate: 0.4,
  maxBalanceVariance: 5.0,
});

// Get balance multiple times
const balances = [];
for (let i = 0; i < 5; i++) {
  const balance = await mockHCM.getBalance('EMP001', 'NYC', 'vacation');
  balances.push(balance.currentBalance);
}

// Check for inconsistencies
const variance = Math.max(...balances) - Math.min(...balances);
console.log(`Balance variance: ${variance} days`);
```

### 4. Testing Batch Operations

```typescript
// Set up batch sync failures
mockHCM.updateConfiguration({
  failurePoint: 50, // Fail after 50 employees
  batchSize: 20,
  processingDelay: 100,
});

// Start batch sync
const batchResponse = await mockHCM.startBatchSync({
  employeeIds: ['EMP001', 'EMP002', 'EMP003', 'EMP004', 'EMP005'],
  batchSize: 20,
});

// Monitor progress
let status = await mockHCM.getBatchSyncStatus(batchResponse.requestId);
while (status.status === 'processing') {
  await new Promise(resolve => setTimeout(resolve, 1000));
  status = await mockHCM.getBatchSyncStatus(batchResponse.requestId);
  console.log(`Progress: ${status.processedEmployees}/${status.totalEmployees}`);
}

console.log('Final status:', status.status);
console.log('Errors:', status.errors);
```

### 5. Testing External Updates

```typescript
// Enable external updates
mockHCM.updateConfiguration({
  anniversaryBonusEnabled: true,
  anniversaryBonusAmount: 2.0,
  anniversaryBonusFrequency: 60, // Every 60 days
});

// Get initial balance
const initialBalance = await mockHCM.getBalance('EMP001', 'NYC', 'vacation');
console.log('Initial balance:', initialBalance.currentBalance);

// Wait for external update (simulate time passing)
await new Promise(resolve => setTimeout(resolve, 1000));

// Get updated balance
const updatedBalance = await mockHCM.getBalance('EMP001', 'NYC', 'vacation');
console.log('Updated balance:', updatedBalance.currentBalance);
console.log('Difference:', updatedBalance.currentBalance - initialBalance.currentBalance);
```

## 📊 Monitoring and Health

### Health Check

```typescript
const health = await mockHCM.getHealthStatus();
console.log('HCM Health Status:', health);

// Expected output:
// {
//   status: 'healthy' | 'degraded' | 'unhealthy',
//   responseTime: 1234,
//   failureRate: 0.15,
//   config: {
//     networkFailureRate: 0.1,
//     serverErrorRate: 0.05,
//     timeoutRate: 0.02,
//     staleDataRate: 0.15
//   }
// }
```

### Reset Service State

```typescript
// Reset all data and configuration
mockHCM.reset();

// Apply new configuration
mockHCM.updateConfiguration({
  networkFailureRate: 0.2,
  serverErrorRate: 0.1,
});
```

## 🎯 Test Cases

### Essential Test Cases

1. **Basic Functionality**
   - Normal operation with minimal failures
   - All endpoints return expected data
   - Response times within acceptable range

2. **Error Handling**
   - Network failures trigger retries
   - Server errors are handled gracefully
   - Timeouts don't crash the system

3. **Data Consistency**
   - Stale data is detected and handled
   - Inconsistent data triggers conflict resolution
   - Version conflicts are resolved properly

4. **Batch Operations**
   - Large batches complete successfully
   - Partial failures are handled correctly
   - Progress tracking works accurately

5. **External Integration**
   - External updates are detected
   - Conflicts are resolved
   - Synchronization maintains integrity

### Performance Test Cases

1. **Load Testing**
   - Concurrent requests handled properly
   - Response times remain acceptable
   - No memory leaks or crashes

2. **Stress Testing**
   - Worst-case scenario handling
   - System recovers from failures
   - Circuit breaker functions correctly

## 🔍 Debugging

### Logging

The mock service provides detailed logging for debugging:

```typescript
// Enable debug logging
process.env.LOG_LEVEL = 'debug';

// Check logs for:
// - Request/response timing
// - Failure simulation details
// - Configuration changes
// - External update events
```

### Common Issues

1. **Too Many Failures**
   - Check configuration values
   - Verify scenario selection
   - Monitor health status

2. **Inconsistent Behavior**
   - Reset service state
   - Verify configuration application
   - Check for external updates

3. **Performance Issues**
   - Adjust response time ranges
   - Reduce batch sizes
   - Monitor processing delays

## 📚 Best Practices

1. **Start Simple**: Begin with normal operation scenario
2. **Gradual Complexity**: Progressively increase failure rates
3. **Isolate Variables**: Test one failure type at a time
4. **Document Results**: Record behavior for each scenario
5. **Reset Between Tests**: Clean state for accurate testing
6. **Monitor Health**: Check service health during tests
7. **Validate Configuration**: Ensure settings are within valid ranges

## 🚨 Important Notes

- The mock service simulates **real-world unreliability**, not perfect behavior
- External updates happen **asynchronously** and may affect test results
- Configuration changes take effect **immediately** for new requests
- Batch operations run **in the background** and may continue after response
- Always **reset** the service state between test runs
- Use **health checks** to verify service status during testing

This mock service is essential for validating that your Time-Off Microservice can handle the unpredictable nature of real-world external systems while maintaining data integrity and providing reliable service.
