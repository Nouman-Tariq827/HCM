# REST API Documentation

## Overview

This document provides comprehensive documentation for the Time-Off Microservice REST APIs. The API follows RESTful principles with proper HTTP status codes, comprehensive validation, and meaningful error messages.

## Base URL

```
https://api.timeoff.com/api/v1
```

## Authentication

All API endpoints require authentication via Bearer token:

```
Authorization: Bearer <jwt_token>
```

## Common Headers

| Header | Description | Example |
|--------|-------------|---------|
| `x-request-id` | Unique request identifier for tracing | `req_1234567890` |
| `x-client-id` | Client application identifier | `web-app-v1.2` |
| `x-user-id` | User identifier for audit trail | `user_123456` |

## Common Response Format

All successful responses follow this structure:

```json
{
  "success": true,
  "data": {
    // Response data varies by endpoint
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "processingTime": "45ms",
    "requestId": "req_1234567890"
  }
}
```

## Error Response Format

All error responses follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "field": "startDate",
        "message": "Start date cannot be in the past"
      }
    ]
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req_1234567890"
  }
}
```

---

## Time-Off APIs

### POST /time-off

Create a new time-off request with comprehensive validation.

**Endpoint**: `POST /api/v1/time-off`

**Request Body**:
```json
{
  "employeeId": "EMP001",
  "locationId": "NYC",
  "policyType": "vacation",
  "startDate": "2024-02-15",
  "endDate": "2024-02-17",
  "requestedDays": 3,
  "reason": "Family vacation",
  "requestId": "req_123456",
  "priority": "normal",
  "department": "Engineering"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "request": {
      "requestId": "req_123456",
      "status": "pending",
      "employeeId": "EMP001",
      "locationId": "NYC",
      "policyType": "vacation",
      "startDate": "2024-02-15",
      "endDate": "2024-02-17",
      "requestedDays": 3,
      "reason": "Family vacation",
      "balanceAtRequest": 15.5,
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    "validation": {
      "isValid": true,
      "availableBalance": 15.5,
      "policyViolations": [],
      "warnings": []
    }
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "processingTime": "125ms",
    "requestId": "req_123456"
  }
}
```

**HTTP Status Codes**:
- `201 Created` - Request created successfully
- `400 Bad Request` - Invalid request data or validation failed
- `409 Conflict` - Request conflicts with existing time-off
- `422 Unprocessable Entity` - Business rule violation

**Validation Rules**:
- `employeeId` - Required, non-empty string
- `locationId` - Required, non-empty string
- `policyType` - Required, one of: `vacation`, `sick`, `personal`, `maternity`, `paternity`
- `startDate` - Required, valid date, not in past
- `endDate` - Required, valid date, on or after startDate
- `requestedDays` - Required, positive number
- `reason` - Required, non-empty string, max 500 characters
- `priority` - Optional, one of: `low`, `normal`, `high`, `urgent`

---

### GET /time-off

Retrieve time-off requests with filtering and pagination.

**Endpoint**: `GET /api/v1/time-off`

**Query Parameters**:
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `employeeId` | string | No | Filter by employee ID | `EMP001` |
| `locationId` | string | No | Filter by location ID | `NYC` |
| `policyType` | string | No | Filter by policy type | `vacation` |
| `status` | string | No | Filter by status | `pending` |
| `startDate` | string | No | Filter by start date | `2024-01-01` |
| `endDate` | string | No | Filter by end date | `2024-12-31` |
| `page` | number | No | Page number (default: 1) | `1` |
| `limit` | number | No | Items per page (default: 20, max: 100) | `20` |

**Response**:
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "requestId": "REQ_001",
        "employeeId": "EMP001",
        "locationId": "NYC",
        "policyType": "vacation",
        "status": "pending",
        "startDate": "2024-02-15",
        "endDate": "2024-02-17",
        "requestedDays": 3,
        "reason": "Family vacation",
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "processingTime": "45ms"
  }
}
```

**HTTP Status Codes**:
- `200 OK` - Requests retrieved successfully
- `400 Bad Request` - Invalid query parameters

---

### PATCH /time-off/:id/approve

Approve a time-off request and trigger synchronization with HCM.

**Endpoint**: `PATCH /api/v1/time-off/:id/approve`

**Path Parameters**:
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `id` | string | Request ID | `REQ_001` |

**Request Body**:
```json
{
  "approvedBy": "manager_001",
  "comments": "Approved for family vacation",
  "approvedDays": 3
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "request": {
      "requestId": "REQ_001",
      "status": "approved",
      "approvedBy": "manager_001",
      "approvedAt": "2024-01-15T10:35:00.000Z",
      "comments": "Approved for family vacation"
    },
    "syncResult": {
      "success": true,
      "hcmRequestId": "hcm_REQ_001_1642248900000",
      "conflicts": [],
      "warnings": []
    }
  },
  "metadata": {
    "timestamp": "2024-01-15T10:35:00.000Z",
    "processingTime": "250ms",
    "requestId": "req_123456"
  }
}
```

**HTTP Status Codes**:
- `200 OK` - Request approved successfully
- `400 Bad Request` - Invalid approval data
- `404 Not Found` - Request not found
- `409 Conflict` - Request already processed

**Validation Rules**:
- `approvedBy` - Required, non-empty string
- `comments` - Optional, max 500 characters
- `approvedDays` - Optional, positive integer

---

### PATCH /time-off/:id/reject

Reject a time-off request with reason.

**Endpoint**: `PATCH /api/v1/time-off/:id/reject`

**Path Parameters**:
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `id` | string | Request ID | `REQ_001` |

**Request Body**:
```json
{
  "rejectedBy": "manager_001",
  "reason": "Insufficient coverage during this period",
  "comments": "Please reschedule for a later date"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "request": {
      "requestId": "REQ_001",
      "status": "rejected",
      "rejectedBy": "manager_001",
      "rejectedAt": "2024-01-15T10:35:00.000Z",
      "reason": "Insufficient coverage during this period",
      "comments": "Please reschedule for a later date"
    }
  },
  "metadata": {
    "timestamp": "2024-01-15T10:35:00.000Z",
    "processingTime": "45ms",
    "requestId": "req_123456"
  }
}
```

**HTTP Status Codes**:
- `200 OK` - Request rejected successfully
- `400 Bad Request` - Invalid rejection data
- `404 Not Found` - Request not found
- `409 Conflict` - Request already processed

**Validation Rules**:
- `rejectedBy` - Required, non-empty string
- `reason` - Required, non-empty string, max 500 characters
- `comments` - Optional, max 500 characters

---

## Balance APIs

### GET /balances

Retrieve balances with optional filtering for employees, locations, and policy types.

**Endpoint**: `GET /api/v1/balances`

**Query Parameters**:
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `employeeId` | string | No | Filter by employee ID | `EMP001` |
| `locationId` | string | No | Filter by location ID | `NYC` |
| `policyType` | string | No | Filter by policy type | `vacation` |
| `includeDetails` | boolean | No | Include detailed information | `true` |
| `page` | number | No | Page number (default: 1) | `1` |
| `limit` | number | No | Records per page (default: 20, max: 100) | `20` |

**Response**:
```json
{
  "success": true,
  "data": {
    "balances": [
      {
        "employeeId": "EMP001",
        "locationId": "NYC",
        "policyType": "vacation",
        "currentBalance": 15.5,
        "maxBalance": 20,
        "lastUpdated": "2024-01-15T10:30:00.000Z",
        "isStale": false
      },
      {
        "employeeId": "EMP002",
        "locationId": "NYC",
        "policyType": "sick",
        "currentBalance": 8.0,
        "maxBalance": 10,
        "lastUpdated": "2024-01-15T10:30:00.000Z",
        "isStale": false
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 2,
      "totalPages": 1
    }
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "processingTime": "35ms"
  }
}
```

**HTTP Status Codes**:
- `200 OK` - Balances retrieved successfully
- `400 Bad Request` - Invalid request parameters

---

### GET /balances/:employeeId

Get current balance for a specific employee.

**Endpoint**: `GET /api/v1/balances/:employeeId`

**Path Parameters**:
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `employeeId` | string | Employee ID | `EMP001` |

**Query Parameters**:
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `locationId` | string | Yes | Location ID | `NYC` |
| `policyType` | string | No | Policy type | `vacation` |
| `includeDetails` | boolean | No | Include detailed information | `true` |

**Response**:
```json
{
  "success": true,
  "data": {
    "employeeId": "EMP001",
    "locationId": "NYC",
    "policyType": "vacation",
    "currentBalance": 15.5,
    "maxBalance": 20,
    "availableBalance": 15.5,
    "pendingRequests": 3,
    "lastUpdated": "2024-01-15T10:30:00.000Z",
    "isStale": false,
    "details": {
      "accrualRate": 1.5,
      "accrualFrequency": "monthly",
      "carryOverLimit": 5,
      "prorationEnabled": true
    }
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "processingTime": "25ms"
  }
}
```

**HTTP Status Codes**:
- `200 OK` - Balance retrieved successfully
- `400 Bad Request` - Invalid request parameters
- `404 Not Found` - Balance not found

---

## Sync APIs

### POST /sync/batch

Trigger batch synchronization with HCM system.

**Endpoint**: `POST /api/v1/sync/batch`

**Request Body**:
```json
{
  "employeeIds": ["EMP001", "EMP002"],
  "locationIds": ["NYC", "LAX"],
  "policyTypes": ["vacation", "sick"],
  "forceSync": false,
  "batchSize": 50
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "syncId": "batch_1642248900000_abc123",
    "status": "started",
    "totalEmployees": 2,
    "estimatedDuration": 300
  },
  "metadata": {
    "requestId": "batch_1642248900000_abc123",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "processingTime": "15ms"
  }
}
```

**HTTP Status Codes**:
- `202 Accepted` - Batch sync started successfully
- `400 Bad Request` - Invalid sync request
- `409 Conflict` - Sync already in progress

**Validation Rules**:
- `employeeIds` - Optional, array of strings, max 1000 items
- `locationIds` - Optional, array of strings
- `policyTypes` - Optional, array of valid policy types
- `forceSync` - Optional, boolean
- `batchSize` - Optional, number between 1 and 500

---

## Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `BUSINESS_RULE_VIOLATION` | 422 | Business rule violation |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `HCM_UNAVAILABLE` | 503 | HCM system unavailable |
| `SYNC_IN_PROGRESS` | 409 | Sync operation already in progress |
| `INSUFFICIENT_BALANCE` | 422 | Insufficient balance for request |
| `POLICY_VIOLATION` | 422 | Time-off policy violation |
| `OVERLAP_DETECTED` | 409 | Overlapping time-off request detected |
| `STALE_DATA` | 409 | Stale data detected |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Internal server error |

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

| Endpoint | Rate Limit | Window |
|----------|------------|--------|
| POST /time-off | 10 requests/min | 1 minute |
| GET /time-off | 100 requests/min | 1 minute |
| PATCH /time-off/:id/approve | 20 requests/min | 1 minute |
| PATCH /time-off/:id/reject | 20 requests/min | 1 minute |
| GET /balances | 200 requests/min | 1 minute |
| POST /sync/batch | 5 requests/min | 1 minute |

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1642248960
```

---

## Pagination

List endpoints support pagination using `page` and `limit` parameters:

- `page`: Page number (default: 1, minimum: 1)
- `limit`: Items per page (default: 20, minimum: 1, maximum: 100)

Pagination information is included in response metadata:

```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## Request Tracing

Use the `x-request-id` header for request tracing:

```bash
curl -X POST "https://api.timeoff.com/api/v1/time-off" \
  -H "Authorization: Bearer <token>" \
  -H "x-request-id: req_$(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"EMP001","locationId":"NYC","policyType":"vacation","startDate":"2024-02-15","endDate":"2024-02-17","requestedDays":3,"reason":"Vacation"}'
```

The request ID will be returned in response metadata and included in logs for troubleshooting.

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { TimeOffClient } from '@company/timeoff-sdk';

const client = new TimeOffClient({
  baseURL: 'https://api.timeoff.com/api/v1',
  apiKey: 'your-api-key'
});

// Create time-off request
const request = await client.timeOff.create({
  employeeId: 'EMP001',
  locationId: 'NYC',
  policyType: 'vacation',
  startDate: '2024-02-15',
  endDate: '2024-02-17',
  requestedDays: 3,
  reason: 'Family vacation'
});

// Get balances
const balances = await client.balances.list({
  employeeId: 'EMP001',
  includeDetails: true
});

// Approve request
const approved = await client.timeOff.approve('REQ_001', {
  approvedBy: 'manager_001',
  comments: 'Approved'
});
```

### Python

```python
from timeoff_sdk import TimeOffClient

client = TimeOffClient(
    base_url='https://api.timeoff.com/api/v1',
    api_key='your-api-key'
)

# Create time-off request
request = client.time_off.create({
    'employeeId': 'EMP001',
    'locationId': 'NYC',
    'policyType': 'vacation',
    'startDate': '2024-02-15',
    'endDate': '2024-02-17',
    'requestedDays': 3,
    'reason': 'Family vacation'
})

# Get balances
balances = client.balances.list(
    employeeId='EMP001',
    include_details=True
)

# Approve request
approved = client.time_off.approve(
    'REQ_001',
    approved_by='manager_001',
    comments='Approved'
)
```

---

## Testing

### Postman Collection

A comprehensive Postman collection is available with examples for all endpoints:

1. Import the collection from `docs/postman-collection.json`
2. Set environment variables:
   - `base_url`: `https://api.timeoff.com/api/v1`
   - `api_key`: Your API key
   - `employee_id`: Test employee ID

### Example cURL Commands

```bash
# Create time-off request
curl -X POST "https://api.timeoff.com/api/v1/time-off" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMP001",
    "locationId": "NYC",
    "policyType": "vacation",
    "startDate": "2024-02-15",
    "endDate": "2024-02-17",
    "requestedDays": 3,
    "reason": "Family vacation"
  }'

# Get balances
curl -X GET "https://api.timeoff.com/api/v1/balances?employeeId=EMP001&includeDetails=true" \
  -H "Authorization: Bearer <token>"

# Approve request
curl -X PATCH "https://api.timeoff.com/api/v1/time-off/REQ_001/approve" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "approvedBy": "manager_001",
    "comments": "Approved"
  }'

# Trigger batch sync
curl -X POST "https://api.timeoff.com/api/v1/sync/batch" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeIds": ["EMP001", "EMP002"],
    "batchSize": 50
  }'
```

---

## Best Practices

1. **Always include request IDs** for tracing and debugging
2. **Handle rate limits gracefully** with exponential backoff
3. **Validate responses** and handle errors appropriately
4. **Use pagination** for large datasets
5. **Cache balance data** appropriately to reduce API calls
6. **Implement retry logic** for transient failures
7. **Monitor sync status** for long-running operations
8. **Use webhooks** for real-time notifications (when available)

---

## Changelog

### v1.0.0 (2024-01-15)
- Initial API release
- Time-Off CRUD operations
- Balance management
- Batch synchronization
- Comprehensive validation and error handling

---

For additional support, contact the API team at api-support@company.com or visit our developer portal at https://developers.company.com/timeoff.
