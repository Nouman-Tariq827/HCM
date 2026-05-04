import React, { useMemo, useCallback } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Alert,
  Chip,
  Skeleton
} from '@mui/material';
import {
  Event as TimeOffIcon,
  AccountBalance as BalanceIcon,
  Sync as SyncIcon,
  CheckCircle as CheckIcon,
  Pending as PendingIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import apiService from '../services/api';
import { DashboardStats } from '../types';

const Dashboard: React.FC = () => {
  const { data: stats, isLoading, error } = useQuery<DashboardStats>(
    'dashboardStats',
    () => apiService.getDashboardStats().then(res => res.data),
    { 
      refetchInterval: 30000,
      staleTime: 25000,
      cacheTime: 300000
    }
  );

  const { data: health } = useQuery(
    'healthStatus',
    () => apiService.getHealthStatus().then(res => res.data),
    { 
      refetchInterval: 10000,
      staleTime: 8000,
      cacheTime: 120000
    }
  );

  const getHealthColor = useCallback((status: string) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'degraded': return 'warning';
      case 'unhealthy': return 'error';
      default: return 'default';
    }
  }, []);

  const statCards = useMemo(() => [
    {
      title: 'Total Requests',
      value: stats?.totalRequests || 0,
      icon: <TimeOffIcon />,
      color: '#1976d2'
    },
    {
      title: 'Pending Requests',
      value: stats?.pendingRequests || 0,
      icon: <PendingIcon />,
      color: '#ff9800'
    },
    {
      title: 'Approved Requests',
      value: stats?.approvedRequests || 0,
      icon: <CheckIcon />,
      color: '#4caf50'
    },
    {
      title: 'Total Employees',
      value: stats?.totalEmployees || 0,
      icon: <BalanceIcon />,
      color: '#9c27b0'
    }
  ], [stats]);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        {/* Health Status */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Health
              </Typography>
              <Box display="flex" alignItems="center" gap={2}>
                <Chip
                  label={`Status: ${health?.status?.toUpperCase() || 'UNKNOWN'}`}
                  color={getHealthColor(health?.status || 'default') as any}
                  variant="outlined"
                />
                <Typography variant="body2" color="textSecondary">
                  Database: {health?.database === 'connected' ? '✅ Connected' : '❌ Disconnected'}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  HCM: {health?.hcm === 'connected' ? '✅ Connected' : health?.hcm === 'degraded' ? '⚠️ Degraded' : '❌ Disconnected'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Stat Cards */}
        {statCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="overline">
                      {card.title}
                    </Typography>
                    <Typography variant="h4" component="div">
                      {card.value}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      backgroundColor: card.color,
                      color: 'white',
                      borderRadius: 1,
                      p: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {card.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}

        {/* Sync Status */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Synchronization Status
              </Typography>
              <Box display="flex" alignItems="center" gap={2}>
                <SyncIcon />
                <Box>
                  <Typography variant="body1">
                    Active Syncs: {stats?.activeSyncs || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Last Sync: {stats?.lastSyncTime ? new Date(stats.lastSyncTime).toLocaleString() : 'Never'}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box display="flex" flexDirection="column" gap={1}>
                <Typography variant="body2" color="textSecondary">
                  • Review pending time-off requests
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  • Check balance synchronization status
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  • Monitor system health metrics
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
