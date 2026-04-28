export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  location: string;
}

export interface TimeOffPolicy {
  type: 'vacation' | 'sick' | 'personal';
  name: string;
  description: string;
  maxDaysPerYear: number;
  requiresApproval: boolean;
}

export interface Balance {
  employeeId: string;
  locationId: string;
  policyType: string;
  currentBalance: number;
  lastSyncAt: string;
  syncVersion: number;
  staleness: 'fresh' | 'stale' | 'critical';
}

export interface TimeOffRequest {
  id?: string;
  employeeId: string;
  locationId: string;
  policyType: string;
  startDate: string;
  endDate: string;
  requestedDays: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  priority: 'normal' | 'urgent';
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  warnings?: string[];
  conflicts?: Conflict[];
}

export interface Conflict {
  field: string;
  localValue: any;
  hcmValue: any;
  resolution: 'local_wins' | 'hcm_wins' | 'manual_review';
  severity: 'low' | 'medium' | 'high';
}

export interface SyncOperation {
  syncId: string;
  type: 'batch' | 'full' | 'incremental';
  status: 'started' | 'running' | 'completed' | 'failed';
  totalEmployees: number;
  employeesProcessed: number;
  startTime: string;
  endTime?: string;
  errors?: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  metadata?: {
    requestId: string;
    processingTime: string;
    hcmValidated: boolean;
    warnings?: string[];
  };
}

export interface CreateTimeOffRequest {
  employeeId: string;
  locationId: string;
  policyType: string;
  startDate: string;
  endDate: string;
  requestedDays: number;
  reason: string;
  priority: 'normal' | 'urgent';
}

export interface BalanceValidation {
  isValid: boolean;
  availableBalance: number;
  requestedDays: number;
  remainingBalance: number;
  warnings?: string[];
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: 'connected' | 'disconnected';
  hcm: 'connected' | 'disconnected' | 'degraded';
  uptime: string;
  version: string;
  timestamp: string;
}

export interface DashboardStats {
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  totalEmployees: number;
  activeSyncs: number;
  lastSyncTime: string;
  systemHealth: 'healthy' | 'degraded' | 'unhealthy';
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}
