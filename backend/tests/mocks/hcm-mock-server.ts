#!/usr/bin/env node

/**
 * Mock HCM Server
 * 
 * This mock server simulates the HCM system (Workday/SAP-like) for testing purposes.
 * It provides realistic endpoints with configurable behaviors for different test scenarios.
 * 
 * Features:
 * - Real-time balance API
 * - Batch synchronization endpoint
 * - Configurable failures and delays
 * - Data consistency simulation
 * - External balance updates simulation
 */

import express from 'express';
import cors from 'cors';
import { randomBytes } from 'crypto';

interface EmployeeBalance {
  employeeId: string;
  locationId: string;
  policyType: string;
  currentBalance: number;
  version: number;
  lastUpdated: Date;
}

interface MockConfig {
  delays: Record<string, number>;
  errors: Record<string, boolean>;
  inconsistentData: boolean;
  externalUpdates: boolean;
}

class MockHCMDatabase {
  private balances: Map<string, EmployeeBalance> = new Map();
  private externalUpdateInterval: NodeJS.Timeout | null = null;
  public inconsistentData: boolean = false;

  constructor() {
    this.initializeData();
  }

  private initializeData(): void {
    // Initialize with sample data
    const sampleData = [
      { employeeId: 'EMP001', locationId: 'NYC', policyType: 'vacation', currentBalance: 15.5 },
      { employeeId: 'EMP001', locationId: 'NYC', policyType: 'sick', currentBalance: 8.0 },
      { employeeId: 'EMP002', locationId: 'NYC', policyType: 'vacation', currentBalance: 12.0 },
      { employeeId: 'EMP002', locationId: 'NYC', policyType: 'sick', currentBalance: 6.5 },
      { employeeId: 'EMP003', locationId: 'LAX', policyType: 'vacation', currentBalance: 20.0 },
      { employeeId: 'EMP003', locationId: 'LAX', policyType: 'sick', currentBalance: 10.0 },
    ];

    sampleData.forEach(data => {
      const key = this.generateKey(data.employeeId, data.locationId, data.policyType);
      this.balances.set(key, {
        ...data,
        version: 1,
        lastUpdated: new Date(),
      });
    });
  }

  private generateKey(employeeId: string, locationId: string, policyType: string): string {
    return `${employeeId}:${locationId}:${policyType}`;
  }

  getBalance(employeeId: string, locationId: string, policyType: string): EmployeeBalance | null {
    const key = this.generateKey(employeeId, locationId, policyType);
    return this.balances.get(key) || null;
  }

  getAllBalances(): EmployeeBalance[] {
    return Array.from(this.balances.values());
  }

  updateBalance(employeeId: string, locationId: string, policyType: string, newBalance: number): void {
    const key = this.generateKey(employeeId, locationId, policyType);
    const existing = this.balances.get(key);
    
    if (existing) {
      this.balances.set(key, {
        ...existing,
        currentBalance: newBalance,
        version: existing.version + 1,
        lastUpdated: new Date(),
      });
    } else {
      this.balances.set(key, {
        employeeId,
        locationId,
        policyType,
        currentBalance: newBalance,
        version: 1,
        lastUpdated: new Date(),
      });
    }
  }

  simulateExternalUpdates(config: MockConfig): void {
    if (config.externalUpdates && !this.externalUpdateInterval) {
      this.externalUpdateInterval = setInterval(() => {
        // Simulate work anniversary bonus
        const randomBalance = this.getRandomBalance();
        if (randomBalance && Math.random() > 0.7) {
          const bonus = Math.random() > 0.5 ? 1.0 : 0.5;
          this.updateBalance(
            randomBalance.employeeId,
            randomBalance.locationId,
            randomBalance.policyType,
            randomBalance.currentBalance + bonus
          );
          console.log(`[HCM Mock] External update: ${randomBalance.employeeId} +${bonus} days`);
        }
      }, 10000); // Every 10 seconds
    }
  }

  stopExternalUpdates(): void {
    if (this.externalUpdateInterval) {
      clearInterval(this.externalUpdateInterval);
      this.externalUpdateInterval = null;
    }
  }

  private getRandomBalance(): EmployeeBalance | null {
    const balances = Array.from(this.balances.values());
    return balances.length > 0 ? balances[Math.floor(Math.random() * balances.length)] : null;
  }

  simulateInconsistentData(): EmployeeBalance | null {
    if (!this.inconsistentData) return null;
    
    const balance = this.getRandomBalance();
    if (balance && Math.random() > 0.8) {
      // Return inconsistent data
      return {
        ...balance,
        currentBalance: balance.currentBalance + (Math.random() * 10 - 5), // Random variation
        version: balance.version + Math.floor(Math.random() * 5),
        lastUpdated: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000), // Random past time
      };
    }
    
    return balance;
  }
}

class MockHCMService {
  private app: express.Application;
  private database: MockHCMDatabase;
  private config: MockConfig;
  private server: any;

  constructor() {
    this.app = express();
    this.database = new MockHCMDatabase();
    this.config = {
      delays: {},
      errors: {},
      inconsistentData: false,
      externalUpdates: false,
    };
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      console.log(`[HCM Mock] ${req.method} ${req.path} - ${JSON.stringify(req.body)}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Real-time balance API
    this.app.get('/api/v1/balances/:employeeId/:locationId/:policyType', async (req, res) => {
      const { employeeId, locationId, policyType } = req.params;
      
      // Apply configured delay
      await this.applyDelay('getBalance');
      
      // Apply configured error
      this.applyError('getBalance', res);
      
      const balance = this.config.inconsistentData 
        ? this.database.simulateInconsistentData()
        : this.database.getBalance(employeeId, locationId, policyType);
      
      if (!balance) {
        return res.status(404).json({
          error: 'Balance not found',
          employeeId,
          locationId,
          policyType,
        });
      }
      
      res.json({
        employeeId: balance.employeeId,
        locationId: balance.locationId,
        policyType: balance.policyType,
        currentBalance: balance.currentBalance,
        version: balance.version,
        lastUpdated: balance.lastUpdated.toISOString(),
      });
    });

    // Validate time-off request
    this.app.post('/api/v1/validate', async (req, res) => {
      const { employeeId, locationId, policyType, requestedDays } = req.body;
      
      // Apply configured delay
      await this.applyDelay('validate');
      
      // Apply configured error
      this.applyError('validate', res);
      
      const balance = this.database.getBalance(employeeId, locationId, policyType);
      
      if (!balance) {
        return res.status(404).json({
          error: 'Balance not found',
          valid: false,
          message: 'Employee balance not found',
        });
      }
      
      const isValid = balance.currentBalance >= requestedDays;
      
      res.json({
        valid: isValid,
        currentBalance: balance.currentBalance,
        requestedDays,
        availableBalance: isValid ? balance.currentBalance - requestedDays : 0,
        message: isValid ? 'Request valid' : 'Insufficient balance',
        version: balance.version,
      });
    });

    // Create time-off request
    this.app.post('/api/v1/requests', async (req, res) => {
      const { employeeId, locationId, policyType, requestedDays, reason } = req.body;
      
      // Apply configured delay
      await this.applyDelay('createRequest');
      
      // Apply configured error
      this.applyError('createRequest', res);
      
      const balance = this.database.getBalance(employeeId, locationId, policyType);
      
      if (!balance) {
        return res.status(404).json({
          error: 'Balance not found',
        });
      }
      
      if (balance.currentBalance < requestedDays) {
        return res.status(400).json({
          error: 'Insufficient balance',
          currentBalance: balance.currentBalance,
          requestedDays,
        });
      }
      
      // Deduct balance
      this.database.updateBalance(
        employeeId,
        locationId,
        policyType,
        balance.currentBalance - requestedDays
      );
      
      const requestId = `hcm_req_${randomBytes(8).toString('hex')}`;
      
      res.json({
        requestId,
        status: 'approved',
        employeeId,
        locationId,
        policyType,
        requestedDays,
        remainingBalance: balance.currentBalance - requestedDays,
        createdAt: new Date().toISOString(),
      });
    });

    // Batch synchronization endpoint
    this.app.post('/api/v1/sync/batch', async (req, res) => {
      // Apply configured delay
      await this.applyDelay('batchSync');
      
      // Apply configured error
      this.applyError('batchSync', res);
      
      const { employeeIds, locationIds, policyTypes } = req.body;
      const balances = this.database.getAllBalances();
      
      const filteredBalances = balances.filter(b => {
        const matchesEmployee = !employeeIds || employeeIds.includes(b.employeeId);
        const matchesLocation = !locationIds || locationIds.includes(b.locationId);
        const matchesPolicy = !policyTypes || policyTypes.includes(b.policyType);
        return matchesEmployee && matchesLocation && matchesPolicy;
      });
      
      res.json({
        requestId: `hcm_batch_${randomBytes(8).toString('hex')}`,
        status: 'completed',
        totalEmployees: filteredBalances.length,
        processedEmployees: filteredBalances.length,
        balances: filteredBalances.map(b => ({
          employeeId: b.employeeId,
          locationId: b.locationId,
          policyType: b.policyType,
          currentBalance: b.currentBalance,
          version: b.version,
          lastUpdated: b.lastUpdated.toISOString(),
        })),
      });
    });

    // Update balance (for external system simulation)
    this.app.post('/api/v1/balances/:employeeId/:locationId/:policyType/update', async (req, res) => {
      const { employeeId, locationId, policyType } = req.params;
      const { newBalance, reason } = req.body;
      
      // Apply configured delay
      await this.applyDelay('updateBalance');
      
      // Apply configured error
      this.applyError('updateBalance', res);
      
      this.database.updateBalance(employeeId, locationId, policyType, newBalance);
      
      res.json({
        employeeId,
        locationId,
        policyType,
        previousBalance: this.database.getBalance(employeeId, locationId, policyType)?.currentBalance || 0,
        newBalance,
        reason,
        updatedAt: new Date().toISOString(),
      });
    });

    // Configuration endpoint for testing
    this.app.post('/api/v1/config', (req, res) => {
      this.config = { ...this.config, ...req.body };
      
      // Start/stop external updates based on config
      this.database.stopExternalUpdates();
      this.database.simulateExternalUpdates(this.config);
      
      res.json({
        message: 'Configuration updated',
        config: this.config,
      });
    });

    // Get current configuration
    this.app.get('/api/v1/config', (req, res) => {
      res.json(this.config);
    });

    // Reset database
    this.app.post('/api/v1/reset', (req, res) => {
      this.database = new MockHCMDatabase();
      this.database.simulateExternalUpdates(this.config);
      
      res.json({
        message: 'Database reset',
        timestamp: new Date().toISOString(),
      });
    });
  }

  private async applyDelay(operation: string): Promise<void> {
    const delay = this.config.delays[operation];
    if (delay) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  private applyError(operation: string, res: express.Response): void {
    if (this.config.errors[operation]) {
      const errors = {
        getBalance: { status: 500, message: 'HCM balance service unavailable' },
        validate: { status: 500, message: 'HCM validation service error' },
        createRequest: { status: 500, message: 'HCM request creation failed' },
        batchSync: { status: 500, message: 'HCM batch sync error' },
        updateBalance: { status: 500, message: 'HCM balance update failed' },
      };
      
      const error = errors[operation];
      if (error) {
        res.status(error.status).json({ error: error.message });
        return;
      }
    }
  }

  start(port: number = 3001): void {
    this.server = this.app.listen(port, () => {
      console.log(`[HCM Mock] Server running on port ${port}`);
      console.log(`[HCM Mock] Available endpoints:`);
      console.log(`  GET  /health - Health check`);
      console.log(`  GET  /api/v1/balances/:employeeId/:locationId/:policyType - Get balance`);
      console.log(`  POST /api/v1/validate - Validate time-off request`);
      console.log(`  POST /api/v1/requests - Create time-off request`);
      console.log(`  POST /api/v1/sync/batch - Batch sync endpoint`);
      console.log(`  POST /api/v1/config - Configure mock behavior`);
      console.log(`  GET  /api/v1/config - Get current configuration`);
      console.log(`  POST /api/v1/reset - Reset database`);
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.database.stopExternalUpdates();
      console.log('[HCM Mock] Server stopped');
    }
  }
}

// CLI interface
if (require.main === module) {
  const port = process.argv[2] ? parseInt(process.argv[2]) : 3001;
  const mockServer = new MockHCMService();
  
  mockServer.start(port);
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[HCM Mock] Shutting down gracefully...');
    mockServer.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n[HCM Mock] Shutting down gracefully...');
    mockServer.stop();
    process.exit(0);
  });
}

export { MockHCMService, MockHCMDatabase };
