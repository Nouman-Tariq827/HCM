import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import {
  ApiResponse,
  TimeOffRequest,
  Balance,
  CreateTimeOffRequest,
  BalanceValidation,
  SyncOperation,
  HealthStatus,
  DashboardStats
} from '../types';

// Enhanced error types
interface ApiError extends Error {
  status?: number;
  code?: string;
  details?: any;
}

class ApiService {
  private client: AxiosInstance;
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  constructor() {
    this.client = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-ID': 'time-off-frontend',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for adding correlation ID and caching
    this.client.interceptors.request.use(
      (config) => {
        config.headers['X-Request-ID'] = this.generateRequestId();
        config.metadata = { startTime: Date.now() };
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling and performance monitoring
    this.client.interceptors.response.use(
      (response) => {
        const duration = Date.now() - response.config.metadata?.startTime;
        console.debug(`API call to ${response.config.url} took ${duration}ms`);
        return response;
      },
      (error: AxiosError) => {
        const duration = Date.now() - error.config?.metadata?.startTime;
        console.error(`API call to ${error.config?.url} failed after ${duration}ms:`, error.message);
        
        // Enhanced error handling
        if (error.response?.status === 401) {
          window.location.href = '/login';
        }
        
        const apiError: ApiError = new Error(error.message) as ApiError;
        apiError.status = error.response?.status;
        apiError.code = error.code;
        apiError.details = error.response?.data;
        
        return Promise.reject(apiError);
      }
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCacheKey(url: string, params?: any): string {
    return `${url}${params ? JSON.stringify(params) : ''}`;
  }

  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  private setCachedData(key: string, data: any, ttl: number = 300000): void {
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
  }

  // Time-off requests
  async createTimeOffRequest(request: CreateTimeOffRequest): Promise<ApiResponse<TimeOffRequest>> {
    const response = await this.client.post('/api/v1/time-off', request);
    return response.data;
  }

  async getTimeOffRequests(employeeId?: string): Promise<ApiResponse<TimeOffRequest[]>> {
    const params = employeeId ? { employeeId } : {};
    const response = await this.client.get('/api/v1/time-off', { params });
    return response.data;
  }

  async approveTimeOffRequest(requestId: string): Promise<ApiResponse<TimeOffRequest>> {
    const response = await this.client.patch(`/api/v1/time-off/${requestId}/approve`);
    return response.data;
  }

  async rejectTimeOffRequest(requestId: string, reason: string): Promise<ApiResponse<TimeOffRequest>> {
    const response = await this.client.patch(`/api/v1/time-off/${requestId}/reject`, { reason });
    return response.data;
  }

  async cancelTimeOffRequest(
    employeeId: string,
    locationId: string,
    policyType: string,
    referenceId: string
  ): Promise<ApiResponse<TimeOffRequest>> {
    const response = await this.client.post(
      `/api/v1/time-off/cancel/${employeeId}/${locationId}/${policyType}/${referenceId}`
    );
    return response.data;
  }

  // Balance operations
  async getBalance(employeeId: string, locationId: string, policyType: string): Promise<ApiResponse<Balance>> {
    const response = await this.client.get(
      `/api/v1/balances/${employeeId}?locationId=${locationId}&policyType=${policyType}`
    );
    return response.data;
  }

  async validateBalance(request: CreateTimeOffRequest): Promise<ApiResponse<BalanceValidation>> {
    const response = await this.client.post('/api/v1/balances/validate', request);
    return response.data;
  }

  async deductBalance(request: CreateTimeOffRequest): Promise<ApiResponse<Balance>> {
    const response = await this.client.post('/api/v1/balances/deduct', request);
    return response.data;
  }

  async addBalance(employeeId: string, locationId: string, policyType: string, days: number, reason: string): Promise<ApiResponse<Balance>> {
    const response = await this.client.post('/api/v1/balances/add', {
      employeeId,
      locationId,
      policyType,
      days,
      reason
    });
    return response.data;
  }

  async getBalanceHistory(employeeId: string, locationId: string, policyType: string): Promise<ApiResponse<any[]>> {
    const response = await this.client.get(
      `/api/v1/balances/${employeeId}/history?locationId=${locationId}&policyType=${policyType}`
    );
    return response.data;
  }

  // Synchronization operations
  async startBatchSync(employeeIds: string[], locationIds: string[], policyTypes: string[], forceSync = false): Promise<ApiResponse<SyncOperation>> {
    const response = await this.client.post('/api/v1/sync/batch', {
      employeeIds,
      locationIds,
      policyTypes,
      forceSync,
      batchSize: 50
    });
    return response.data;
  }

  async getSyncStatus(syncId: string): Promise<ApiResponse<SyncOperation>> {
    const response = await this.client.get(`/api/v1/sync/${syncId}`);
    return response.data;
  }

  async getAllSyncs(): Promise<ApiResponse<SyncOperation[]>> {
    const response = await this.client.get('/api/v1/sync');
    return response.data;
  }

  async cancelSync(syncId: string): Promise<ApiResponse<void>> {
    const response = await this.client.post('/api/v1/sync/cancel', { syncId });
    return response.data;
  }

  async getSyncMetrics(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/api/v1/sync/metrics');
    return response.data;
  }

  // Health and monitoring
  async getHealthStatus(): Promise<ApiResponse<HealthStatus>> {
    const response = await this.client.get('/api/health');
    return response.data;
  }

  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    const response = await this.client.get('/api/v1/dashboard/stats');
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;
