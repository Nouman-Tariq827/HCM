# Technical Requirements Document (TRD)
## Time-Off Microservice

**Version:** 1.0  
**Date:** April 24, 2026  
**Author:** Senior System Design Engineer  
**Status:** Draft  

---

## 1. Problem Statement

### 1.1 Core Problem
ReadyOn requires a reliable time-off management microservice that maintains accurate employee leave balances while synchronizing with the HCM system (Workday/SAP-like). The system must handle real-time balance validation, batch synchronization, and resolve conflicts when external systems modify HCM balances independently.

### 1.2 Failure Scenarios to Address

#### 1.2.1 HCM System Failures
- **HCM API Unavailability:** Real-time API calls timeout or return 5xx errors
- **Inconsistent Data:** HCM returns different balance values for the same employee within a short time window
- **Partial Batch Failures:** Batch sync processes partially complete, leaving some employees with stale data
- **Rate Limiting:** HCM throttles API calls during peak usage

#### 1.2.2 Data Consistency Issues
- **Race Conditions:** Concurrent time-off requests from multiple systems
- **Stale Local Data:** Local cache becomes out of sync with HCM due to external updates
- **Duplicate Requests:** Network retries result in duplicate time-off deductions
- **Orphaned Transactions:** Failed operations leave balances in inconsistent state

#### 1.2.3 Business Logic Failures
- **Negative Balances:** System allows time-off deduction beyond available balance
- **Policy Violations:** Time-off requests violate company policies (e.g., minimum notice period)
- **Cross-Location Conflicts:** Employee has balances in multiple locations with conflicting policies

---

## 2. Functional Requirements

### 2.1 Core Time-Off Operations
- **FR-001:** Validate time-off request availability in real-time
- **FR-002:** Deduct time-off from employee balance upon approval
- **FR-003:** Refund time-off upon cancellation
- **FR-004:** Query current balance for any employee-location combination
- **FR-005:** Retrieve time-off history with audit trail

### 2.2 Synchronization Requirements
- **FR-006:** Perform real-time balance validation against HCM before deduction
- **FR-007:** Execute full batch synchronization of all employee balances
- **FR-008:** Handle incremental updates for specific employees
- **FR-009:** Detect and report synchronization conflicts

### 2.3 Balance Management
- **FR-010:** Support multiple time-off types (vacation, sick, personal, etc.)
- **FR-011:** Handle location-specific balance policies
- **FR-012:** Track balance adjustments (bonuses, corrections, yearly refresh)
- **FR-013:** Maintain balance expiration and accrual rules

### 2.4 Integration Requirements
- **FR-014:** Integrate with ReadyOn client-facing system
- **FR-015:** Provide RESTful APIs for external system consumption
- **FR-016:** Support webhook notifications for balance changes
- **FR-017:** Generate audit reports for compliance

---

## 3. Non-Functional Requirements

### 3.1 Consistency Requirements
- **NFR-001:** **Strong Consistency for Balance Operations** - All balance reads within a transaction must see the same data
- **NFR-002:** **Eventual Consistency for Batch Sync** - Full synchronization may take up to 30 minutes to complete
- **NFR-003:** **Read-After-Write Consistency** - Balance updates must be immediately visible to subsequent reads

### 3.2 Reliability Requirements
- **NFR-004:** **99.9% Uptime** - System must be available except for planned maintenance
- **NFR-005:** **Zero Data Loss** - No balance transaction may be lost due to system failures
- **NFR-006:** **Graceful Degradation** - System must operate in read-only mode when HCM is unavailable

### 3.3 Performance Requirements
- **NFR-007:** **API Latency:** Balance validation < 200ms (p95), balance query < 100ms (p95)
- **NFR-008:** **Throughput:** Support 1000 concurrent balance validation requests
- **NFR-009:** **Batch Sync Performance:** Full sync of 10,000 employees within 30 minutes

### 3.4 Scalability Requirements
- **NFR-010:** **Horizontal Scalability** - Must scale to support 100,000 employees
- **NFR-011:** **Database Scalability** - SQLite must support connection pooling and proper indexing
- **NFR-012:** **Cache Scalability** - Cache layer must handle 50,000 balance entries

---

## 4. Assumptions & Constraints

### 4.1 Technical Assumptions
- **TA-001:** HCM provides RESTful APIs with predictable response formats
- **TA-002:** Employee IDs are unique across all locations
- **TA-003:** Network latency to HCM is < 500ms on average
- **TA-004:** SQLite database can handle the expected load with proper optimization

### 4.2 Business Assumptions
- **BA-001:** Time-off policies are consistent within each location
- **BA-002:** Balance adjustments follow a predictable schedule (e.g., yearly refresh)
- **BA-003:** External systems update HCM balances through proper channels
- **BA-004:** ReadyOn has proper authentication mechanisms in place

### 4.3 Constraints
- **C-001:** Must use NestJS framework and SQLite database
- **C-002:** Cannot modify HCM system behavior or APIs
- **C-003:** Must maintain backward compatibility with existing ReadyOn integrations
- **C-004:** Budget constraints limit infrastructure complexity

---

## 5. High-Level Architecture

### 5.1 System Overview
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ReadyOn UI    │    │  External Apps  │    │   Admin Portal  │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │   API Gateway / Load       │
                    │   Balancer                 │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │   Time-Off Microservice    │
                    │   (NestJS)                 │
                    └─────────────┬─────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
┌─────────▼─────────┐  ┌─────────▼─────────┐  ┌─────────▼─────────┐
│   SQLite DB       │  │   Redis Cache    │  │   Message Queue   │
│   (Primary)       │  │   (Balance)      │  │   (Async Tasks)   │
└───────────────────┘  └───────────────────┘  └───────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │   HCM System              │
                    │   (Workday/SAP-like)      │
                    └───────────────────────────┘
```

### 5.2 Module Breakdown

#### 5.2.1 API Layer
- **Auth Module:** JWT validation and authorization
- **Rate Limiting:** Request throttling per client
- **Request Validation:** Input sanitization and validation

#### 5.2.2 Service Layer
- **Balance Service:** Core balance operations and validation
- **Sync Service:** HCM synchronization logic
- **Conflict Resolution Service:** Handle data conflicts
- **Audit Service:** Logging and audit trail

#### 5.2.3 Data Layer
- **Repository Layer:** Database operations abstraction
- **Cache Layer:** Redis-based balance caching
- **Transaction Manager:** ACID transaction handling

#### 5.2.4 Integration Layer
- **HCM Client:** HTTP client for HCM API calls
- **Message Producer:** Async task publishing
- **Webhook Service:** External notifications

---

## 6. Data Model Design

### 6.1 Database Schema

#### 6.1.1 Employees Table
```sql
CREATE TABLE employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id VARCHAR(50) NOT NULL UNIQUE,
    location_id VARCHAR(50) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_employee_id (employee_id),
    INDEX idx_location_id (location_id),
    INDEX idx_active (is_active)
);
```

#### 6.1.2 Time-Off Policies Table
```sql
CREATE TABLE time_off_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id VARCHAR(50) NOT NULL,
    policy_type VARCHAR(50) NOT NULL, -- vacation, sick, personal
    max_days_per_year INTEGER NOT NULL,
    min_notice_days INTEGER DEFAULT 0,
    accrual_rate DECIMAL(5,2), -- days per month
    expiration_policy VARCHAR(100), -- use_it_or_lose_it, rollover_max_30_days
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_location_policy (location_id, policy_type),
    INDEX idx_location_policy (location_id, policy_type)
);
```

#### 6.1.3 Balance History Table
```sql
CREATE TABLE balance_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id VARCHAR(50) NOT NULL,
    location_id VARCHAR(50) NOT NULL,
    policy_type VARCHAR(50) NOT NULL,
    balance_before DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    change_amount DECIMAL(10,2) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL, -- deduction, refund, adjustment, accrual
    reference_id VARCHAR(100), -- external reference
    reason TEXT,
    source_system VARCHAR(50) NOT NULL, -- readyon, hcm_sync, manual_adjustment
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_employee_policy (employee_id, policy_type),
    INDEX idx_transaction_type (transaction_type),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (employee_id, location_id) REFERENCES employees(employee_id, location_id)
);
```

#### 6.1.4 Current Balances Table
```sql
CREATE TABLE current_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id VARCHAR(50) NOT NULL,
    location_id VARCHAR(50) NOT NULL,
    policy_type VARCHAR(50) NOT NULL,
    current_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
    last_sync_at TIMESTAMP,
    sync_version INTEGER DEFAULT 0, -- for conflict detection
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_employee_balance (employee_id, location_id, policy_type),
    INDEX idx_employee_balance (employee_id, policy_type),
    INDEX idx_last_sync (last_sync_at),
    FOREIGN KEY (employee_id, location_id) REFERENCES employees(employee_id, location_id)
);
```

#### 6.1.5 Sync Status Table
```sql
CREATE TABLE sync_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_type VARCHAR(50) NOT NULL, -- full_batch, incremental, real_time
    status VARCHAR(50) NOT NULL, -- pending, in_progress, completed, failed
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    employees_processed INTEGER DEFAULT 0,
    employees_total INTEGER DEFAULT 0,
    conflicts_detected INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_sync_type_status (sync_type, status),
    INDEX idx_started_at (started_at)
);
```

### 6.2 Data Model Reasoning

#### 6.2.1 Separation of Concerns
- **Current Balances vs History:** Separate tables for performance and audit trail
- **Policies Table:** Centralized policy management per location
- **Sync Status:** Track synchronization operations for monitoring

#### 6.2.2 Indexing Strategy
- **Composite Indexes:** Optimize common query patterns (employee + policy)
- **Time-based Indexes:** Efficient history queries and cleanup
- **Status Indexes:** Fast sync status monitoring

#### 6.2.3 Data Integrity
- **Foreign Keys:** Ensure referential integrity
- **Unique Constraints:** Prevent duplicate balance entries
- **Check Constraints:** Validate data ranges (e.g., non-negative balances)

---

## 7. API Design

### 7.1 Balance Management APIs

#### 7.1.1 Get Current Balance
```http
GET /api/v1/balances/{employeeId}
Query Parameters:
- locationId: string (required)
- policyType: string (optional, all if not specified)

Response:
{
  "success": true,
  "data": {
    "employeeId": "EMP123456",
    "locationId": "NYC",
    "balances": [
      {
        "policyType": "vacation",
        "currentBalance": 15.5,
        "lastSyncAt": "2026-04-24T01:00:00Z",
        "syncVersion": 42
      },
      {
        "policyType": "sick",
        "currentBalance": 8.0,
        "lastSyncAt": "2026-04-24T01:00:00Z",
        "syncVersion": 42
      }
    ]
  },
  "metadata": {
    "requestId": "req_abc123",
    "timestamp": "2026-04-24T10:30:00Z"
  }
}
```

#### 7.1.2 Validate Time-Off Request
```http
POST /api/v1/balances/validate
Request Body:
{
  "employeeId": "EMP123456",
  "locationId": "NYC",
  "policyType": "vacation",
  "requestedDays": 5.0,
  "startDate": "2026-05-15",
  "endDate": "2026-05-19",
  "requestId": "req_abc123" // for idempotency
}

Response:
{
  "success": true,
  "data": {
    "isValid": true,
    "availableBalance": 15.5,
    "requestedDays": 5.0,
    "remainingBalance": 10.5,
    "policyViolations": [],
    "warnings": ["Request requires manager approval"]
  },
  "metadata": {
    "requestId": "req_abc123",
    "timestamp": "2026-04-24T10:30:00Z",
    "hcmValidated": true,
    "hcmResponseTime": "150ms"
  }
}
```

#### 7.1.3 Deduct Time-Off
```http
POST /api/v1/balances/deduct
Request Body:
{
  "employeeId": "EMP123456",
  "locationId": "NYC",
  "policyType": "vacation",
  "daysToDeduct": 5.0,
  "reason": "Annual vacation",
  "referenceId": "VAC_REQ_789",
  "requestId": "req_def456" // for idempotency
}

Response:
{
  "success": true,
  "data": {
    "transactionId": "txn_789012",
    "previousBalance": 15.5,
    "newBalance": 10.5,
    "deductedAmount": 5.0,
    "hcmSyncStatus": "success",
    "auditTrail": {
      "transactionId": "txn_789012",
      "timestamp": "2026-04-24T10:35:00Z",
      "sourceSystem": "readyon"
    }
  },
  "metadata": {
    "requestId": "req_def456",
    "timestamp": "2026-04-24T10:35:00Z"
  }
}
```

### 7.2 Synchronization APIs

#### 7.2.1 Trigger Full Sync
```http
POST /api/v1/sync/full
Request Body:
{
  "priority": "high", // high, medium, low
  "employeeIds": [], // optional, specific employees only
  "forceSync": false // override cache
}

Response:
{
  "success": true,
  "data": {
    "syncId": "sync_123456",
    "status": "pending",
    "estimatedDuration": "25 minutes",
    "employeesToProcess": 10450,
    "priority": "high"
  },
  "metadata": {
    "requestId": "req_ghi789",
    "timestamp": "2026-04-24T10:40:00Z"
  }
}
```

#### 7.2.2 Get Sync Status
```http
GET /api/v1/sync/{syncId}

Response:
{
  "success": true,
  "data": {
    "syncId": "sync_123456",
    "status": "in_progress",
    "startedAt": "2026-04-24T10:40:00Z",
    "estimatedCompletion": "2026-04-24T11:05:00Z",
    "progress": {
      "employeesProcessed": 6234,
      "employeesTotal": 10450,
      "percentageComplete": 59.6
    },
    "conflicts": {
      "detected": 12,
      "resolved": 8,
      "pending": 4
    }
  },
  "metadata": {
    "requestId": "req_jkl012",
    "timestamp": "2026-04-24T10:50:00Z"
  }
}
```

### 7.3 Audit APIs

#### 7.3.1 Get Balance History
```http
GET /api/v1/balances/{employeeId}/history
Query Parameters:
- locationId: string (required)
- policyType: string (optional)
- startDate: string (ISO 8601)
- endDate: string (ISO 8601)
- page: number (default: 1)
- limit: number (default: 50, max: 200)

Response:
{
  "success": true,
  "data": {
    "employeeId": "EMP123456",
    "locationId": "NYC",
    "history": [
      {
        "transactionId": "txn_789012",
        "policyType": "vacation",
        "balanceBefore": 15.5,
        "balanceAfter": 10.5,
        "changeAmount": -5.0,
        "transactionType": "deduction",
        "referenceId": "VAC_REQ_789",
        "reason": "Annual vacation",
        "sourceSystem": "readyon",
        "createdAt": "2026-04-24T10:35:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 156,
      "totalPages": 4
    }
  },
  "metadata": {
    "requestId": "req_mno345",
    "timestamp": "2026-04-24T10:45:00Z"
  }
}
```

---

## 8. Synchronization Strategy

### 8.1 Real-Time Validation Flow

#### 8.1.1 Flow Diagram
```
1. Client Request → Validation API
2. Check Local Cache → Cache Hit?
   ├─ Yes → Validate Local Balance
   │   ├─ Sufficient → Proceed to HCM Validation
   │   └─ Insufficient → Reject Request
   └─ No → Fetch from HCM → Update Cache → Validate
3. HCM Validation → Balance Valid?
   ├─ Yes → Reserve Balance (Temporary Hold)
   └─ No → Reject Request
4. Return Validation Result
```

#### 8.1.2 Implementation Details
- **Cache TTL:** 5 minutes for balance data
- **HCM Timeout:** 2 seconds with 2 retries
- **Fallback Strategy:** Use cached balance if HCM unavailable (with warning)
- **Reservation Period:** 15 minutes for validated but not yet deducted balances

### 8.2 Batch Sync Reconciliation

#### 8.2.1 Sync Strategy
```typescript
interface BatchSyncStrategy {
  // Phase 1: Discovery
  discoverEmployees(): Promise<Employee[]>;
  
  // Phase 2: Comparison
  compareBalances(employee: Employee): Promise<BalanceDiff[]>;
  
  // Phase 3: Conflict Resolution
  resolveConflicts(conflicts: BalanceConflict[]): Promise<void>;
  
  // Phase 4: Application
  applyUpdates(updates: BalanceUpdate[]): Promise<void>;
  
  // Phase 5: Verification
  verifySync(): Promise<SyncReport>;
}
```

#### 8.2.2 Sync Algorithm
1. **Full Export:** Fetch all employee balances from HCM
2. **Local Comparison:** Compare with local balances
3. **Conflict Detection:** Identify discrepancies > 0.1 days
4. **Resolution Strategy:** 
   - HCM wins for external adjustments
   - Local wins for recent deductions (< 24 hours)
   - Manual review for conflicts > 1 day
5. **Update Application:** Apply resolved changes
6. **Audit Logging:** Record all changes and resolutions

#### 8.2.3 Performance Optimizations
- **Parallel Processing:** Process 100 employees concurrently
- **Batch Size:** 500 employees per HCM API call
- **Progress Tracking:** Real-time sync progress updates
- **Checkpointing:** Save progress every 1000 employees

---

## 9. Conflict Resolution Strategy

### 9.1 Conflict Classification

#### 9.1.1 Data Conflicts
- **Balance Mismatch:** Local balance differs from HCM
- **Version Conflicts:** Concurrent updates to same balance
- **Policy Conflicts:** Different policies between systems
- **Temporal Conflicts:** Time-based synchronization issues

#### 9.1.2 Business Logic Conflicts
- **Negative Balance:** Local shows negative, HCM shows positive
- **Overdeduction:** Local deducted more than HCM allows
- **Policy Violations:** Local transactions violate HCM policies
- **Timing Conflicts:** Requests processed out of order

### 9.2 Resolution Matrix

| Conflict Type | HCM Available | HCM Unavailable | Resolution Strategy |
|---------------|----------------|------------------|-------------------|
| Balance Mismatch | Yes | N/A | HCM wins (source of truth) |
| Balance Mismatch | No | Yes | Use local, flag for manual review |
| Version Conflict | Yes | N/A | Latest timestamp wins |
| Version Conflict | No | Yes | Reject with retry later |
| Negative Balance | Yes | N/A | HCM correction required |
| Policy Violation | Yes | N/A | Reject request, notify user |

### 9.3 Conflict Resolution Algorithm

```typescript
class ConflictResolver {
  async resolveConflict(conflict: BalanceConflict): Promise<Resolution> {
    // Step 1: Classify conflict
    const conflictType = this.classifyConflict(conflict);
    
    // Step 2: Check HCM availability
    const hcmAvailable = await this.hcmClient.healthCheck();
    
    // Step 3: Apply resolution matrix
    const strategy = this.getResolutionStrategy(conflictType, hcmAvailable);
    
    // Step 4: Execute resolution
    switch (strategy) {
      case 'HCM_WINS':
        return await this.applyHCMValue(conflict);
      case 'LOCAL_WINS':
        return await this.applyLocalValue(conflict);
      case 'MANUAL_REVIEW':
        return await this.flagForReview(conflict);
      case 'RETRY_LATER':
        return await this.scheduleRetry(conflict);
    }
  }
  
  private classifyConflict(conflict: BalanceConflict): ConflictType {
    const diff = Math.abs(conflict.localBalance - conflict.hcmBalance);
    
    if (diff > 1.0) return 'MAJOR_MISMATCH';
    if (diff > 0.1) return 'MINOR_MISMATCH';
    if (conflict.localBalance < 0) return 'NEGATIVE_BALANCE';
    if (conflict.versionConflict) return 'VERSION_CONFLICT';
    
    return 'UNKNOWN';
  }
}
```

### 9.4 Stale Data Handling

#### 9.4.1 Freshness Indicators
- **Last Sync Timestamp:** Track when data was last synchronized
- **Data Version:** Incremental version for each update
- **Checksum:** MD5 hash of balance record for integrity

#### 9.4.2 Staleness Thresholds
- **Critical Data:** 5 minutes (balance validation)
- **Important Data:** 1 hour (policies, employee info)
- **Historical Data:** 24 hours (audit logs, history)

#### 9.4.3 Refresh Strategies
- **Proactive Refresh:** Refresh cache before expiration for active users
- **Lazy Refresh:** Refresh on access if stale
- **Background Refresh:** Periodic refresh of all cached data

---

## 10. Concurrency & Race Condition Handling

### 10.1 Concurrency Scenarios

#### 10.1.1 Concurrent Balance Updates
- **Scenario:** Multiple systems try to update the same employee's balance simultaneously
- **Risk:** Double-spending, incorrect final balance
- **Solution:** Pessimistic locking with version control

#### 10.1.2 Read-Modify-Write Race
- **Scenario:** Read balance → Calculate new balance → Write balance
- **Risk:** Lost updates, inconsistent state
- **Solution:** Atomic operations with compare-and-swap

#### 10.1.3 Cache Race Conditions
- **Scenario:** Cache invalidation and update race
- **Risk:** Stale cache serving incorrect data
- **Solution:** Cache-aside pattern with write-through

### 10.2 Concurrency Control Mechanisms

#### 10.2.1 Database-Level Control
```sql
-- Pessimistic locking for balance updates
BEGIN TRANSACTION;
SELECT current_balance, sync_version 
FROM current_balances 
WHERE employee_id = ? AND location_id = ? AND policy_type = ?
FOR UPDATE;

-- Validate version
UPDATE current_balances 
SET current_balance = ?, sync_version = sync_version + 1
WHERE employee_id = ? AND sync_version = ?;
COMMIT;
```

#### 10.2.2 Application-Level Control
```typescript
class BalanceService {
  @Transactional()
  async deductBalance(request: DeductRequest): Promise<DeductResponse> {
    // Step 1: Acquire distributed lock
    const lockKey = `balance:${request.employeeId}:${request.policyType}`;
    const lock = await this.lockManager.acquire(lockKey, 30000);
    
    try {
      // Step 2: Read current state with version
      const current = await this.balanceRepository.findWithVersion(
        request.employeeId, 
        request.locationId, 
        request.policyType
      );
      
      // Step 3: Validate business rules
      if (current.balance < request.daysToDeduct) {
        throw new InsufficientBalanceError();
      }
      
      // Step 4: Apply update with version check
      const updated = await this.balanceRepository.updateWithVersion(
        current.id,
        current.balance - request.daysToDeduct,
        current.version
      );
      
      // Step 5: Update cache
      await this.cacheManager.set(
        this.getCacheKey(request),
        updated,
        { ttl: 300 }
      );
      
      return updated;
    } finally {
      await this.lockManager.release(lock);
    }
  }
}
```

#### 10.2.3 Distributed Locking
- **Lock Scope:** Employee + Policy Type combination
- **Lock Timeout:** 30 seconds maximum
- **Lock Renewal:** Automatic renewal for long operations
- **Deadlock Detection:** Timeout-based deadlock resolution

### 10.3 Race Condition Prevention

#### 10.3.1 Idempotent Operations
- **Request Deduplication:** Use request ID for idempotency
- **Transaction deduplication:** Check for existing transactions
- **State Validation:** Validate preconditions before operation

#### 10.3.2 Optimistic Concurrency Control
```typescript
interface OptimisticLock {
  version: number;
  lastModified: Date;
}

class BalanceRepository {
  async updateWithOptimisticLock(
    id: string, 
    newBalance: number, 
    expectedVersion: number
  ): Promise<Balance> {
    const result = await this.database.query(`
      UPDATE current_balances 
      SET current_balance = ?, version = version + 1, updated_at = NOW()
      WHERE id = ? AND version = ?
      RETURNING *
    `, [newBalance, id, expectedVersion]);
    
    if (result.affectedRows === 0) {
      throw new OptimisticLockError();
    }
    
    return result.rows[0];
  }
}
```

---

## 11. Idempotency Strategy

### 11.1 Idempotency Requirements

#### 11.1.1 API Idempotency
- **Deduction Requests:** Must not double-deduct for same request
- **Refund Requests:** Must not double-refund for same request
- **Adjustment Requests:** Must not double-adjust for same request
- **Sync Requests:** Must not duplicate sync operations

#### 11.1.2 Idempotency Scope
- **Request Level:** Unique request ID per operation
- **Time Window:** 24 hours idempotency window
- **Client Scope:** Per client application
- **Operation Scope:** Per employee + policy type

### 11.2 Idempotency Implementation

#### 11.2.1 Request Deduplication Table
```sql
CREATE TABLE idempotency_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id VARCHAR(100) NOT NULL UNIQUE,
    client_id VARCHAR(50) NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    employee_id VARCHAR(50) NOT NULL,
    policy_type VARCHAR(50) NOT NULL,
    request_hash VARCHAR(64) NOT NULL, -- SHA-256 of request body
    response_data TEXT, -- cached response
    status VARCHAR(20) NOT NULL, -- processing, completed, failed
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_request_id (request_id),
    INDEX idx_client_operation (client_id, operation_type),
    INDEX idx_expires_at (expires_at)
);
```

#### 11.2.2 Idempotency Middleware
```typescript
@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] as string;
    const clientId = req.headers['x-client-id'] as string;
    
    if (!requestId || !clientId) {
      return res.status(400).json({
        error: 'Missing required headers: x-request-id, x-client-id'
      });
    }
    
    // Generate request hash
    const requestHash = this.generateRequestHash(req.body);
    
    // Check for existing request
    const existing = await this.idempotencyService.findRequest(
      requestId, 
      clientId, 
      requestHash
    );
    
    if (existing) {
      if (existing.status === 'processing') {
        return res.status(409).json({
          error: 'Request already being processed',
          requestId: requestId
        });
      }
      
      // Return cached response
      return res.status(200).json(JSON.parse(existing.response_data));
    }
    
    // Mark as processing
    await this.idempotencyService.markProcessing(
      requestId, 
      clientId, 
      req.path, 
      requestHash
    );
    
    // Capture response
    const originalJson = res.json;
    res.json = function(data) {
      // Cache successful responses
      if (res.statusCode === 200) {
        idempotencyService.cacheResponse(requestId, JSON.stringify(data));
      }
      return originalJson.call(this, data);
    };
    
    next();
  }
  
  private generateRequestHash(body: any): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(body))
      .digest('hex');
  }
}
```

#### 11.2.3 Service-Level Idempotency
```typescript
class BalanceService {
  async deductBalance(request: DeductRequest): Promise<DeductResponse> {
    // Check for existing transaction
    const existingTxn = await this.transactionRepository.findByReference(
      request.referenceId
    );
    
    if (existingTxn) {
      return {
        success: true,
        transactionId: existingTxn.id,
        message: 'Transaction already processed',
        duplicate: true
      };
    }
    
    // Process new transaction
    return await this.processDeduction(request);
  }
}
```

### 11.3 Idempotency Cleanup

#### 11.3.1 Cleanup Strategy
- **Scheduled Cleanup:** Remove expired entries every hour
- **Retention Period:** Keep completed requests for 24 hours
- **Failed Requests:** Keep failed requests for 7 days (for debugging)

#### 11.3.2 Cleanup Implementation
```typescript
@Cron('0 * * * *') // Every hour
async cleanupExpiredRequests() {
  const deleted = await this.idempotencyRepository.deleteExpired();
  this.logger.log(`Cleaned up ${deleted} expired idempotency entries`);
}
```

---

## 12. Error Handling & Retry Strategy

### 12.1 Error Classification

#### 12.1.1 Error Categories
- **Client Errors (4xx):** Invalid requests, validation failures
- **Server Errors (5xx):** Internal failures, database issues
- **HCM Errors:** External system failures, timeouts
- **Business Logic Errors:** Insufficient balance, policy violations

#### 12.1.2 Error Severity Levels
- **Critical:** System unavailable, data corruption
- **High:** HCM unavailable, major functionality broken
- **Medium:** Performance degradation, partial failures
- **Low:** Non-critical features, cosmetic issues

### 12.2 Retry Strategy

#### 12.2.1 Retry Configuration
```typescript
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  retryableErrors: string[];
}

const RETRY_CONFIGS: Record<string, RetryConfig> = {
  HCM_API: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED']
  },
  DATABASE: {
    maxAttempts: 2,
    baseDelay: 500,
    maxDelay: 2000,
    backoffMultiplier: 2,
    retryableErrors: ['ConnectionLost', 'Deadlock']
  },
  CACHE: {
    maxAttempts: 2,
    baseDelay: 200,
    maxDelay: 1000,
    backoffMultiplier: 1.5,
    retryableErrors: ['Timeout', 'ConnectionError']
  }
};
```

#### 12.2.2 Exponential Backoff Implementation
```typescript
class RetryService {
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig,
    context: string
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (!this.isRetryableError(error, config.retryableErrors)) {
          throw error;
        }
        
        if (attempt === config.maxAttempts) {
          this.logger.error(
            `Max retry attempts reached for ${context}`,
            { error: lastError.message, attempts: attempt }
          );
          throw lastError;
        }
        
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );
        
        this.logger.warn(
          `Attempt ${attempt} failed for ${context}, retrying in ${delay}ms`,
          { error: lastError.message }
        );
        
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }
  
  private isRetryableError(error: Error, retryableErrors: string[]): boolean {
    return retryableErrors.some(retryableError => 
      error.message.includes(retryableError) || 
      error.constructor.name === retryableError
    );
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 12.3 Circuit Breaker Pattern

#### 12.3.1 Circuit Breaker Implementation
```typescript
class CircuitBreaker {
  private failureCount = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private lastFailureTime = 0;
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000, // 1 minute
    private monitorWindow: number = 10000 // 10 seconds
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new CircuitBreakerOpenError();
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}
```

### 12.4 Error Response Format

#### 12.4.1 Standard Error Response
```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string; // BUSINESS_ERROR, SYSTEM_ERROR, HCM_ERROR
    message: string;
    details?: any;
    requestId: string;
    timestamp: string;
    retryable: boolean;
    retryAfter?: number; // seconds
  };
}
```

#### 12.4.2 Error Examples
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Requested vacation days exceed available balance",
    "details": {
      "requested": 10.0,
      "available": 7.5,
      "shortfall": 2.5
    },
    "requestId": "req_abc123",
    "timestamp": "2026-04-24T10:30:00Z",
    "retryable": false
  }
}

{
  "success": false,
  "error": {
    "code": "HCM_UNAVAILABLE",
    "message": "HCM system temporarily unavailable",
    "details": {
      "hcmResponseTime": "5000ms",
      "timeout": "2000ms"
    },
    "requestId": "req_def456",
    "timestamp": "2026-04-24T10:35:00Z",
    "retryable": true,
    "retryAfter": 30
  }
}
```

---

## 13. Security Considerations

### 13.1 Authentication & Authorization

#### 13.1.1 Authentication Mechanisms
- **JWT Tokens:** Bearer token authentication for API access
- **API Keys:** Service-to-service authentication
- **Mutual TLS:** For HCM system communication
- **OAuth 2.0:** For client application integration

#### 13.1.2 Authorization Model
```typescript
interface Permission {
  resource: string; // balances, sync, audit
  action: string; // read, write, delete, admin
  scope: string; // self, team, location, all
}

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  EMPLOYEE: [
    { resource: 'balances', action: 'read', scope: 'self' },
    { resource: 'balances', action: 'write', scope: 'self' }
  ],
  MANAGER: [
    { resource: 'balances', action: 'read', scope: 'team' },
    { resource: 'balances', action: 'write', scope: 'team' }
  ],
  HR_ADMIN: [
    { resource: 'balances', action: 'read', scope: 'location' },
    { resource: 'balances', action: 'write', scope: 'location' },
    { resource: 'sync', action: 'write', scope: 'all' },
    { resource: 'audit', action: 'read', scope: 'all' }
  ],
  SYSTEM: [
    { resource: 'balances', action: 'write', scope: 'all' },
    { resource: 'sync', action: 'write', scope: 'all' }
  ]
};
```

### 13.2 Data Protection

#### 13.2.1 Sensitive Data Handling
- **PII Encryption:** Encrypt employee personal information at rest
- **Balance Data:** Consider balance information as sensitive
- **Audit Logs:** Mask sensitive information in logs
- **API Responses:** Filter sensitive fields based on user role

#### 13.2.2 Data Encryption
```typescript
class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  
  async encryptSensitiveData(data: string): Promise<string> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.getEncryptionKey());
    cipher.setAAD(Buffer.from('time-off-service'));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }
  
  async decryptSensitiveData(encryptedData: string): Promise<string> {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipher(this.algorithm, this.getEncryptionKey());
    decipher.setAAD(Buffer.from('time-off-service'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

### 13.3 API Security

#### 13.3.1 Rate Limiting
```typescript
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly rateLimiter: RateLimiter) {}
  
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const clientId = request.headers['x-client-id'];
    const endpoint = request.route.path;
    
    const key = `${clientId}:${endpoint}`;
    const allowed = await this.rateLimiter.checkLimit(key, {
      windowMs: 60000, // 1 minute
      maxRequests: 100, // 100 requests per minute
      burstLimit: 20 // 20 requests in first second
    });
    
    if (!allowed) {
      throw new ThrottlerException('Too many requests');
    }
    
    return true;
  }
}
```

#### 13.3.2 Input Validation
```typescript
export class DeductBalanceDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]+$/)
  employeeId: string;
  
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]+$/)
  locationId: string;
  
  @IsString()
  @IsIn(['vacation', 'sick', 'personal'])
  policyType: string;
  
  @IsNumber()
  @IsPositive()
  @Max(365) // Max 1 year at once
  @Min(0.5) // Minimum half day
  daysToDeduct: number;
  
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
  
  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Matches(/^[A-Z0-9_-]+$/)
  referenceId?: string;
}
```

### 13.4 Infrastructure Security

#### 13.4.1 Network Security
- **VPC Isolation:** Deploy in isolated network segment
- **Firewall Rules:** Restrict access to required ports only
- **VPN Access:** Secure admin access to infrastructure
- **Load Balancer:** SSL termination at load balancer

#### 13.4.2 Database Security
```typescript
// Database connection with SSL
const dbConfig = {
  client: 'sqlite3',
  connection: {
    filename: process.env.DB_PATH,
    ssl: {
      rejectUnauthorized: true,
      ca: process.env.DB_CA_CERT
    }
  },
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000
  }
};
```

---

## 14. Observability

### 14.1 Logging Strategy

#### 14.1.1 Log Levels and Categories
```typescript
enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

enum LogCategory {
  API = 'api',
  BALANCE = 'balance',
  SYNC = 'sync',
  HCM = 'hcm',
  SECURITY = 'security',
  PERFORMANCE = 'performance'
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  requestId?: string;
  employeeId?: string;
  locationId?: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, any>;
}
```

#### 14.1.2 Structured Logging Implementation
```typescript
@Injectable()
export class LoggerService {
  private readonly logger = new WinstonLogger({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ 
        filename: 'logs/error.log', 
        level: 'error' 
      }),
      new winston.transports.File({ 
        filename: 'logs/combined.log' 
      })
    ]
  });
  
  logBalanceOperation(
    operation: string,
    employeeId: string,
    locationId: string,
    duration: number,
    success: boolean,
    metadata?: any
  ) {
    this.logger.info('Balance operation', {
      category: LogCategory.BALANCE,
      operation,
      employeeId,
      locationId,
      duration,
      success,
      metadata
    });
  }
  
  logSyncOperation(
    syncId: string,
    operation: string,
    status: string,
    metadata?: any
  ) {
    this.logger.info('Sync operation', {
      category: LogCategory.SYNC,
      syncId,
      operation,
      status,
      metadata
    });
  }
}
```

### 14.2 Metrics and Monitoring

#### 14.2.1 Key Performance Indicators
```typescript
interface Metrics {
  // API Metrics
  apiRequestTotal: Counter;
  apiRequestDuration: Histogram;
  apiErrorTotal: Counter;
  
  // Balance Metrics
  balanceValidationTotal: Counter;
  balanceDeductionTotal: Counter;
  balanceConflictTotal: Counter;
  
  // Sync Metrics
  syncOperationTotal: Counter;
  syncDuration: Histogram;
  syncConflictTotal: Counter;
  
  // HCM Metrics
  hcmApiCallTotal: Counter;
  hcmApiDuration: Histogram;
  hcmApiErrorTotal: Counter;
  
  // Business Metrics
  activeEmployees: Gauge;
  totalBalanceValue: Gauge;
  dailyTimeOffRequests: Counter;
}

class MetricsService {
  private readonly metrics: Metrics;
  
  constructor() {
    this.metrics = {
      apiRequestTotal: new Counter({
        name: 'api_requests_total',
        help: 'Total number of API requests',
        labelNames: ['method', 'endpoint', 'status']
      }),
      
      apiRequestDuration: new Histogram({
        name: 'api_request_duration_seconds',
        help: 'API request duration in seconds',
        labelNames: ['method', 'endpoint'],
        buckets: [0.1, 0.5, 1, 2, 5, 10]
      }),
      
      balanceValidationTotal: new Counter({
        name: 'balance_validation_total',
        help: 'Total number of balance validations',
        labelNames: ['result'] // success, insufficient_balance, error
      }),
      
      syncOperationTotal: new Counter({
        name: 'sync_operations_total',
        help: 'Total number of sync operations',
        labelNames: ['type', 'status'] // full_batch, incremental, real_time
      })
    };
  }
  
  recordApiRequest(method: string, endpoint: string, statusCode: number, duration: number) {
    this.metrics.apiRequestTotal.inc({ method, endpoint, status: statusCode.toString() });
    this.metrics.apiRequestDuration.observe({ method, endpoint }, duration / 1000);
    
    if (statusCode >= 400) {
      this.metrics.apiErrorTotal.inc({ method, endpoint, status: statusCode.toString() });
    }
  }
}
```

#### 14.2.2 Health Checks
```typescript
@Injectable()
export class HealthService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly hcmService: HCMService,
    private readonly redisService: RedisService
  ) {}
  
  async checkHealth(): Promise<HealthCheckResult> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkHCM(),
      this.checkRedis(),
      this.checkDiskSpace()
    ]);
    
    return {
      status: this.calculateOverallStatus(checks),
      checks: {
        database: this.getCheckResult(checks[0]),
        hcm: this.getCheckResult(checks[1]),
        redis: this.getCheckResult(checks[2]),
        diskSpace: this.getCheckResult(checks[3])
      },
      timestamp: new Date().toISOString()
    };
  }
  
  private async checkDatabase(): Promise<CheckResult> {
    const start = Date.now();
    try {
      await this.dbService.query('SELECT 1');
      return {
        status: 'healthy',
        responseTime: Date.now() - start
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        responseTime: Date.now() - start
      };
    }
  }
  
  private calculateOverallStatus(checks: PromiseSettledResult<CheckResult>[]): string {
    const hasFailure = checks.some(check => 
      check.status === 'rejected' || 
      (check.status === 'fulfilled' && check.value.status === 'unhealthy')
    );
    
    return hasFailure ? 'unhealthy' : 'healthy';
  }
}
```

### 14.3 Distributed Tracing

#### 14.3.1 Trace Context Propagation
```typescript
@Injectable()
export class TracingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const traceId = request.headers['x-trace-id'] || this.generateTraceId();
    
    // Set trace context
    request.traceId = traceId;
    
    return next.handle().pipe(
      tap(() => {
        // Record trace completion
        this.tracingService.completeTrace(traceId);
      })
    );
  }
  
  private generateTraceId(): string {
    return crypto.randomUUID();
  }
}
```

### 14.4 Alerting Strategy

#### 14.4.1 Alert Conditions
- **High Error Rate:** >5% error rate over 5 minutes
- **HCM Unavailability:** HCM API failure rate >10% over 2 minutes
- **Sync Failures:** Sync operation failure rate >20% over 10 minutes
- **Performance Degradation:** P95 latency >500ms over 5 minutes
- **Database Connection Issues:** Connection pool exhaustion

#### 14.4.2 Alert Implementation
```typescript
class AlertService {
  async checkAndAlert() {
    const metrics = await this.metricsService.getRecentMetrics();
    
    // Check error rate
    const errorRate = this.calculateErrorRate(metrics);
    if (errorRate > 0.05) {
      await this.sendAlert({
        severity: 'high',
        message: `High error rate detected: ${(errorRate * 100).toFixed(2)}%`,
        metric: 'error_rate',
        value: errorRate,
        threshold: 0.05
      });
    }
    
    // Check HCM availability
    const hcmErrorRate = this.calculateHCMErrorRate(metrics);
    if (hcmErrorRate > 0.10) {
      await this.sendAlert({
        severity: 'critical',
        message: `HCM API issues detected: ${(hcmErrorRate * 100).toFixed(2)}% failure rate`,
        metric: 'hcm_error_rate',
        value: hcmErrorRate,
        threshold: 0.10
      });
    }
  }
}
```

---

## 15. Testing Strategy

### 15.1 Unit Testing

#### 15.1.1 Test Coverage Requirements
- **Service Layer:** 95% code coverage
- **Repository Layer:** 90% code coverage
- **Controller Layer:** 85% code coverage
- **Utility Functions:** 100% code coverage

#### 15.1.2 Unit Test Examples
```typescript
describe('BalanceService', () => {
  let service: BalanceService;
  let repository: jest.Mocked<BalanceRepository>;
  let hcmService: jest.Mocked<HCMService>;
  
  beforeEach(() => {
    repository = createMock<BalanceRepository>();
    hcmService = createMock<HCMService>();
    service = new BalanceService(repository, hcmService);
  });
  
  describe('deductBalance', () => {
    it('should successfully deduct balance when sufficient funds', async () => {
      // Arrange
      const request: DeductRequest = {
        employeeId: 'EMP123',
        locationId: 'NYC',
        policyType: 'vacation',
        daysToDeduct: 5.0,
        reason: 'Vacation'
      };
      
      const currentBalance: Balance = {
        employeeId: 'EMP123',
        locationId: 'NYC',
        policyType: 'vacation',
        currentBalance: 15.0,
        version: 1
      };
      
      repository.findWithVersion.mockResolvedValue(currentBalance);
      repository.updateWithVersion.mockResolvedValue({
        ...currentBalance,
        currentBalance: 10.0,
        version: 2
      });
      
      hcmService.validateBalance.mockResolvedValue({
        valid: true,
        balance: 15.0
      });
      
      // Act
      const result = await service.deductBalance(request);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(10.0);
      expect(repository.updateWithVersion).toHaveBeenCalledWith(
        expect.any(String),
        10.0,
        1
      );
    });
    
    it('should throw InsufficientBalanceError when funds insufficient', async () => {
      // Arrange
      const request: DeductRequest = {
        employeeId: 'EMP123',
        locationId: 'NYC',
        policyType: 'vacation',
        daysToDeduct: 20.0,
        reason: 'Vacation'
      };
      
      const currentBalance: Balance = {
        employeeId: 'EMP123',
        locationId: 'NYC',
        policyType: 'vacation',
        currentBalance: 15.0,
        version: 1
      };
      
      repository.findWithVersion.mockResolvedValue(currentBalance);
      
      // Act & Assert
      await expect(service.deductBalance(request))
        .rejects
        .toThrow(InsufficientBalanceError);
    });
  });
});
```

### 15.2 Integration Testing

#### 15.2.1 Database Integration Tests
```typescript
describe('BalanceRepository Integration', () => {
  let repository: BalanceRepository;
  let db: SqliteDatabase;
  
  beforeAll(async () => {
    db = await createTestDatabase();
    repository = new BalanceRepository(db);
  });
  
  beforeEach(async () => {
    await db.clear();
  });
  
  afterAll(async () => {
    await db.close();
  });
  
  describe('concurrent updates', () => {
    it('should handle concurrent balance updates correctly', async () => {
      // Arrange
      const employeeId = 'EMP123';
      const locationId = 'NYC';
      const policyType = 'vacation';
      
      await repository.create({
        employeeId,
        locationId,
        policyType,
        currentBalance: 20.0,
        version: 1
      });
      
      // Act - Simulate concurrent updates
      const promises = [
        repository.deductWithVersion(employeeId, locationId, policyType, 5.0, 1),
        repository.deductWithVersion(employeeId, locationId, policyType, 3.0, 1),
        repository.deductWithVersion(employeeId, locationId, policyType, 2.0, 1)
      ];
      
      const results = await Promise.allSettled(promises);
      
      // Assert - Only one should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');
      
      expect(successful).toHaveLength(1);
      expect(failed).toHaveLength(2);
      
      const finalBalance = await repository.findByEmployee(employeeId, locationId, policyType);
      expect(finalBalance.currentBalance).toBe(15.0); // 20 - 5
    });
  });
});
```

#### 15.2.2 HCM Integration Tests
```typescript
describe('HCM Integration', () => {
  let hcmService: HCMService;
  let mockHCM: MockHCMServer;
  
  beforeAll(async () => {
    mockHCM = new MockHCMServer();
    await mockHCM.start();
    hcmService = new HCMService(mockHCM.getUrl());
  });
  
  afterAll(async () => {
    await mockHCM.stop();
  });
  
  describe('balance validation', () => {
    it('should handle HCM timeout gracefully', async () => {
      // Arrange
      mockHCM.setDelay(5000); // 5 second delay
      
      // Act & Assert
      await expect(
        hcmService.validateBalance('EMP123', 'NYC', 'vacation')
      ).rejects.toThrow(HCMTimeoutError);
    });
    
    it('should retry on HCM failure', async () => {
      // Arrange
      mockHCM.setFailure(true);
      mockHCM.setFailureCount(2); // Fail twice, then succeed
      
      // Act
      const result = await hcmService.validateBalance('EMP123', 'NYC', 'vacation');
      
      // Assert
      expect(result.valid).toBe(true);
      expect(mockHCM.getCallCount()).toBe(3); // 2 failures + 1 success
    });
  });
});
```

### 15.3 End-to-End Testing

#### 15.3.1 API E2E Tests
```typescript
describe('Balance API E2E', () => {
  let app: INestApplication;
  let testDb: SqliteDatabase;
  
  beforeAll(async () => {
    testDb = await createTestDatabase();
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider(DatabaseService)
    .useValue(testDb)
    .compile();
    
    app = moduleFixture.createNestApplication();
    await app.init();
  });
  
  afterAll(async () => {
    await app.close();
    await testDb.close();
  });
  
  describe('complete time-off request flow', () => {
    it('should handle complete time-off request workflow', async () => {
      // Arrange
      const employeeId = 'EMP123';
      const locationId = 'NYC';
      
      // Setup initial balance
      await testDb.query(`
        INSERT INTO current_balances (employee_id, location_id, policy_type, current_balance)
        VALUES (?, ?, ?, ?)
      `, [employeeId, locationId, 'vacation', 20.0]);
      
      // Act - Step 1: Validate request
      const validateResponse = await request(app.getHttpServer())
        .post('/api/v1/balances/validate')
        .set('x-request-id', 'req_123')
        .set('x-client-id', 'test-client')
        .send({
          employeeId,
          locationId,
          policyType: 'vacation',
          requestedDays: 5.0,
          startDate: '2026-05-15',
          endDate: '2026-05-19'
        });
      
      expect(validateResponse.status).toBe(200);
      expect(validateResponse.body.data.isValid).toBe(true);
      
      // Act - Step 2: Deduct balance
      const deductResponse = await request(app.getHttpServer())
        .post('/api/v1/balances/deduct')
        .set('x-request-id', 'req_124')
        .set('x-client-id', 'test-client')
        .send({
          employeeId,
          locationId,
          policyType: 'vacation',
          daysToDeduct: 5.0,
          reason: 'Vacation',
          referenceId: 'VAC_REQ_789'
        });
      
      expect(deductResponse.status).toBe(200);
      expect(deductResponse.body.data.newBalance).toBe(15.0);
      
      // Act - Step 3: Verify balance
      const balanceResponse = await request(app.getHttpServer())
        .get(`/api/v1/balances/${employeeId}?locationId=${locationId}`)
        .set('x-client-id', 'test-client');
      
      expect(balanceResponse.status).toBe(200);
      expect(balanceResponse.body.data.balances[0].currentBalance).toBe(15.0);
    });
  });
});
```

### 15.4 Failure Simulation Testing

#### 15.4.1 Chaos Testing
```typescript
describe('Chaos Testing', () => {
  let service: BalanceService;
  let chaosMonkey: ChaosMonkey;
  
  beforeEach(() => {
    chaosMonkey = new ChaosMonkey();
    service = new BalanceService(repository, hcmService, chaosMonkey);
  });
  
  describe('database failures', () => {
    it('should handle database connection loss', async () => {
      // Arrange
      chaosMonkey.enableDatabaseFailure(0.5); // 50% failure rate
      
      // Act
      const promises = Array.from({ length: 10 }, () => 
        service.getBalance('EMP123', 'NYC', 'vacation')
      );
      
      const results = await Promise.allSettled(promises);
      
      // Assert
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');
      
      // Should have some successes and some failures
      expect(successful.length).toBeGreaterThan(0);
      expect(failed.length).toBeGreaterThan(0);
      
      // Failed requests should have proper error types
      failed.forEach(result => {
        expect(result.reason).toBeInstanceOf(DatabaseError);
      });
    });
  });
  
  describe('HCM failures', () => {
    it('should handle HCM timeout during validation', async () => {
      // Arrange
      chaosMonkey.enableHCMTimeout(1000); // 1 second timeout
      
      // Act & Assert
      await expect(
        service.validateBalance('EMP123', 'NYC', 'vacation', 5.0)
      ).rejects.toThrow(HCMTimeoutError);
    });
  });
});
```

### 15.5 Performance Testing

#### 15.5.1 Load Testing
```typescript
describe('Performance Tests', () => {
  describe('balance validation under load', () => {
    it('should handle 1000 concurrent validation requests', async () => {
      // Arrange
      const concurrentRequests = 1000;
      const requests = Array.from({ length: concurrentRequests }, (_, i) => 
        service.validateBalance(`EMP${i}`, 'NYC', 'vacation', 5.0)
      );
      
      // Act
      const startTime = Date.now();
      const results = await Promise.allSettled(requests);
      const endTime = Date.now();
      
      // Assert
      const duration = endTime - startTime;
      const successful = results.filter(r => r.status === 'fulfilled');
      
      expect(successful.length).toBeGreaterThan(950); // 95% success rate
      expect(duration).toBeLessThan(10000); // Under 10 seconds
      
      // Calculate P95 latency
      const latencies = results.map(r => 
        r.status === 'fulfilled' ? r.value.duration : 0
      ).sort((a, b) => a - b);
      
      const p95Index = Math.floor(latencies.length * 0.95);
      expect(latencies[p95Index]).toBeLessThan(200); // P95 < 200ms
    });
  });
});
```

---

## 16. Edge Cases

### 16.1 Data Edge Cases

#### 16.1.1 Zero and Negative Balances
- **Zero Balance:** Employee has exactly 0 days available
- **Negative Balance:** System incorrectly shows negative balance
- **Fractional Days:** Requests for partial days (0.5, 1.5, etc.)
- **Large Deductions:** Requests exceeding yearly maximum

#### 16.1.2 Time-Based Edge Cases
- **Leap Year:** February 29th calculations
- **Year Boundary:** Requests spanning year change
- **Time Zone Issues:** Employees in different time zones
- **Daylight Saving:** Time changes affecting date calculations

#### 16.1.3 Employee Status Edge Cases
- **Terminated Employees:** Time-off requests after termination
- **Transferred Employees:** Location changes during pending requests
- **On Leave:** Employees already on leave requesting more time-off
- **New Hires:** Prorated balances for new employees

### 16.2 System Edge Cases

#### 16.2.1 Database Edge Cases
```typescript
class EdgeCaseHandler {
  async handleZeroBalance(employeeId: string, policyType: string): Promise<void> {
    const balance = await this.getBalance(employeeId, policyType);
    
    if (balance.currentBalance === 0) {
      // Log zero balance for monitoring
      this.logger.warn('Zero balance detected', {
        employeeId,
        policyType,
        lastActivity: balance.lastActivity
      });
      
      // Check if this is expected (e.g., year-end reset)
      if (this.isUnexpectedZeroBalance(balance)) {
        await this.alertService.notifyZeroBalance(employeeId, policyType);
      }
    }
  }
  
  async handleFractionalDays(request: TimeOffRequest): Promise<ValidationResult> {
    const requestedDays = request.daysToDeduct;
    
    // Validate fractional day precision
    if (!this.isValidFraction(requestedDays)) {
      return {
        valid: false,
        reason: 'Fractional days must be in 0.5 day increments'
      };
    }
    
    // Check policy allows fractional days
    const policy = await this.getPolicy(request.locationId, request.policyType);
    if (!policy.allowsFractionalDays) {
      return {
        valid: false,
        reason: 'Policy does not allow fractional days'
      };
    }
    
    return { valid: true };
  }
  
  private isValidFraction(days: number): boolean {
    // Allow only 0.5 day increments
    return (days * 2) % 1 === 0;
  }
}
```

#### 16.2.2 HCM Integration Edge Cases
```typescript
class HCMEdgeCaseHandler {
  async handleHCMInconsistency(
    employeeId: string, 
    localBalance: number, 
    hcmBalance: number
  ): Promise<ConflictResolution> {
    const difference = Math.abs(localBalance - hcmBalance);
    
    if (difference < 0.1) {
      // Minor difference - likely rounding
      return {
        action: 'use_hcm',
        reason: 'Minor rounding difference'
      };
    }
    
    if (difference > 10) {
      // Major difference - requires investigation
      await this.alertService.notifyMajorDiscrepancy(
        employeeId, 
        localBalance, 
        hcmBalance
      );
      
      return {
        action: 'manual_review',
        reason: 'Major balance discrepancy detected'
      };
    }
    
    // Check for recent local activity
    const recentActivity = await this.getRecentActivity(employeeId, 24); // 24 hours
    if (recentActivity.length > 0) {
      return {
        action: 'use_local',
        reason: 'Recent local activity detected'
      };
    }
    
    return {
      action: 'use_hcm',
      reason: 'HCM is source of truth'
    };
  }
  
  async handleHCMRateLimit(): Promise<void> {
    // Implement exponential backoff
    const backoff = this.calculateBackoff();
    
    await this.sleep(backoff);
    
    // Check if still rate limited
    const rateLimitStatus = await this.hcmClient.checkRateLimitStatus();
    if (rateLimitStatus.limited) {
      // Queue request for later processing
      await this.queueService.enqueue({
        type: 'hcm_request',
        retryAfter: rateLimitStatus.resetTime
      });
    }
  }
}
```

### 16.3 Business Logic Edge Cases

#### 16.3.1 Policy Violation Edge Cases
```typescript
class PolicyEdgeCaseHandler {
  async validateCrossLocationRequest(request: TimeOffRequest): Promise<ValidationResult> {
    // Check if employee has multiple locations
    const employeeLocations = await this.getEmployeeLocations(request.employeeId);
    
    if (employeeLocations.length > 1) {
      // Validate against all applicable policies
      const policyViolations = [];
      
      for (const location of employeeLocations) {
        const policy = await this.getPolicy(location.locationId, request.policyType);
        const validation = await this.validateAgainstPolicy(request, policy);
        
        if (!validation.valid) {
          policyViolations.push({
            locationId: location.locationId,
            violation: validation.reason
          });
        }
      }
      
      if (policyViolations.length > 0) {
        return {
          valid: false,
          reason: 'Policy violations in multiple locations',
          details: policyViolations
        };
      }
    }
    
    return { valid: true };
  }
  
  async handleYearBoundary(request: TimeOffRequest): Promise<ValidationResult> {
    const requestStart = new Date(request.startDate);
    const requestEnd = new Date(request.endDate);
    const currentYear = new Date().getFullYear();
    
    // Check if request spans year boundary
    if (requestStart.getFullYear() !== requestEnd.getFullYear()) {
      // Split request by year
      const daysInCurrentYear = this.calculateDaysInYear(
        requestStart, 
        new Date(currentYear, 11, 31)
      );
      
      const daysInNextYear = this.calculateDaysInYear(
        new Date(currentYear + 1, 0, 1), 
        requestEnd
      );
      
      // Validate each year separately
      const currentYearBalance = await this.getBalanceForYear(
        request.employeeId, 
        request.locationId, 
        request.policyType, 
        currentYear
      );
      
      const nextYearBalance = await this.getBalanceForYear(
        request.employeeId, 
        request.locationId, 
        request.policyType, 
        currentYear + 1
      );
      
      if (daysInCurrentYear > currentYearBalance.available) {
        return {
          valid: false,
          reason: `Insufficient balance for ${currentYear}. Available: ${currentYearBalance.available}, Requested: ${daysInCurrentYear}`
        };
      }
      
      if (daysInNextYear > nextYearBalance.available) {
        return {
          valid: false,
          reason: `Insufficient balance for ${currentYear + 1}. Available: ${nextYearBalance.available}, Requested: ${daysInNextYear}`
        };
      }
    }
    
    return { valid: true };
  }
}
```

### 16.4 Performance Edge Cases

#### 16.4.1 Large Scale Operations
```typescript
class PerformanceEdgeCaseHandler {
  async handleLargeBatchSync(employeeCount: number): Promise<void> {
    // Break down large sync into manageable chunks
    const chunkSize = 1000;
    const chunks = Math.ceil(employeeCount / chunkSize);
    
    this.logger.info(`Starting large batch sync for ${employeeCount} employees in ${chunks} chunks`);
    
    for (let i = 0; i < chunks; i++) {
      const startIdx = i * chunkSize;
      const endIdx = Math.min(startIdx + chunkSize, employeeCount);
      
      try {
        await this.processSyncChunk(startIdx, endIdx);
        
        // Add delay between chunks to prevent overwhelming HCM
        if (i < chunks - 1) {
          await this.sleep(1000); // 1 second delay
        }
      } catch (error) {
        this.logger.error(`Failed to process chunk ${i + 1}/${chunks}`, { error });
        
        // Decide whether to continue or abort
        if (this.shouldAbortSync(error)) {
          throw new Error(`Batch sync aborted at chunk ${i + 1}: ${error.message}`);
        }
      }
    }
  }
  
  async handleMemoryPressure(): Promise<void> {
    const memoryUsage = process.memoryUsage();
    const memoryThreshold = 0.8; // 80% of available memory
    
    if (memoryUsage.heapUsed / memoryUsage.heapTotal > memoryThreshold) {
      this.logger.warn('High memory usage detected, triggering cleanup');
      
      // Clear caches
      await this.cacheManager.clear();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Check if memory pressure is resolved
      const newUsage = process.memoryUsage();
      if (newUsage.heapUsed / newUsage.heapTotal > memoryThreshold) {
        this.alertService.notifyHighMemoryUsage(newUsage);
      }
    }
  }
}
```

---

## 17. Alternatives Considered

### 17.1 Architecture Alternatives

#### 17.1.1 Event-Driven Architecture vs Synchronous API

**Event-Driven Approach:**
```typescript
// Event-driven time-off request
interface TimeOffRequestedEvent {
  eventId: string;
  employeeId: string;
  locationId: string;
  policyType: string;
  requestedDays: number;
  timestamp: Date;
}

// Event handler
@EventHandler(TimeOffRequestedEvent)
async handleTimeOffRequested(event: TimeOffRequestedEvent) {
  // Process asynchronously
  await this.balanceService.processTimeOffRequest(event);
}
```

**Pros:**
- Better resilience to HCM failures
- Natural fit for eventual consistency
- Easier to scale with message queues
- Better audit trail

**Cons:**
- More complex implementation
- Harder to provide immediate feedback
- Requires message broker infrastructure
- Increased operational complexity

**Decision:** Synchronous API chosen for immediate user feedback and simpler implementation. Event-driven approach can be added later for batch operations.

#### 17.1.2 Database Alternatives

**PostgreSQL vs SQLite:**

**PostgreSQL Advantages:**
- Better concurrent performance
- Advanced locking mechanisms
- Built-in replication
- More robust for production

**SQLite Advantages:**
- Simpler deployment
- No external dependencies
- Faster for read-heavy workloads
- Lower operational overhead

**Decision:** SQLite chosen for simplicity and lower operational cost. Can migrate to PostgreSQL if scaling requirements increase.

### 17.2 Synchronization Alternatives

#### 17.2.1 Polling vs Webhooks

**Polling Approach:**
```typescript
// Poll HCM for changes
@Cron('*/5 * * * *') // Every 5 minutes
async pollHCMForChanges() {
  const changes = await this.hcmService.getRecentChanges();
  await this.processChanges(changes);
}
```

**Webhook Approach:**
```typescript
// Receive HCM webhooks
@Post('/webhooks/hcm')
async handleHCMWebhook(@Body() webhook: HCMWebhook) {
  await this.processHCMChange(webhook);
}
```

**Comparison:**
- **Polling:** Simpler, more control, but higher latency
- **Webhooks:** Real-time, more efficient, but more complex

**Decision:** Hybrid approach - polling for regular sync, webhooks for critical updates if HCM supports them.

#### 17.2.2 Full Sync vs Incremental Sync

**Full Sync:**
- Always fetch all data
- Simpler implementation
- Higher resource usage
- Guaranteed consistency

**Incremental Sync:**
- Only fetch changes
- More efficient
- Requires change tracking
- Risk of missed updates

**Decision:** Primary use of incremental sync with periodic full sync for consistency verification.

### 17.3 Cache Strategy Alternatives

#### 17.3.1 Cache-Aside vs Read-Through vs Write-Through

**Cache-Aside:**
```typescript
async getBalance(employeeId: string): Promise<Balance> {
  let balance = await this.cache.get(employeeId);
  
  if (!balance) {
    balance = await this.database.getBalance(employeeId);
    await this.cache.set(employeeId, balance);
  }
  
  return balance;
}
```

**Read-Through:**
```typescript
async getBalance(employeeId: string): Promise<Balance> {
  return await this.cache.getOrLoad(employeeId, () => 
    this.database.getBalance(employeeId)
  );
}
```

**Write-Through:**
```typescript
async updateBalance(employeeId: string, newBalance: number): Promise<void> {
  await this.database.updateBalance(employeeId, newBalance);
  await this.cache.set(employeeId, newBalance);
}
```

**Decision:** Cache-Aside pattern chosen for flexibility and easier cache invalidation control.

### 17.4 Conflict Resolution Alternatives

#### 17.4.1 Last-Writer-Wins vs Operational Transformation

**Last-Writer-Wins:**
```typescript
async resolveConflict(local: Balance, hcm: Balance): Promise<Balance> {
  return local.lastModified > hcm.lastModified ? local : hcm;
}
```

**Operational Transformation:**
```typescript
async resolveConflict(local: Balance, hcm: Balance): Promise<Balance> {
  // Apply operations in correct order
  const operations = this.mergeOperations(local.operations, hcm.operations);
  return this.applyOperations(baseBalance, operations);
}
```

**Decision:** Last-Writer-Wins chosen for simplicity. Operational transformation adds unnecessary complexity for this use case.

### 17.5 Technology Alternatives

#### 17.5.1 Framework Alternatives

**NestJS vs Express.js vs Fastify:**

**NestJS Advantages:**
- Built-in dependency injection
- Modular architecture
- TypeScript support
- Rich ecosystem

**Express.js Advantages:**
- Simpler learning curve
- More flexible
- Larger community
- Less opinionated

**Fastify Advantages:**
- Better performance
- Lower overhead
- Modern async/await support

**Decision:** NestJS chosen for enterprise features and maintainability.

#### 17.5.2 Message Queue Alternatives

**Redis vs RabbitMQ vs Apache Kafka:**

**Redis:**
- Simple setup
- Good performance
- Limited features

**RabbitMQ:**
- Rich features
- Good reliability
- Complex setup

**Apache Kafka:**
- High throughput
- Durable storage
- Complex architecture

**Decision:** Redis chosen for simplicity and sufficient features for current requirements.

---

## Conclusion

This Technical Requirements Document provides a comprehensive foundation for implementing a production-ready Time-Off Microservice using NestJS and SQLite. The design prioritizes:

1. **Reliability:** Multiple layers of error handling and conflict resolution
2. **Scalability:** Modular architecture that can grow with business needs
3. **Maintainability:** Clean separation of concerns and comprehensive testing
4. **Performance:** Optimized caching and database strategies
5. **Security:** Robust authentication and data protection measures

The system is designed to handle real-world production scenarios including HCM failures, concurrent operations, and data consistency challenges while providing a seamless experience for ReadyOn users.

Next steps should include:
1. Proof of concept implementation
2. Performance testing with realistic data volumes
3. Security audit and penetration testing
4. Production deployment planning
5. Monitoring and alerting setup

---

**Document Version:** 1.0  
**Last Updated:** April 24, 2026  
**Next Review Date:** May 24, 2026
