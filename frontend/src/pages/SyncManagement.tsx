import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  LinearProgress,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText
} from '@mui/material';
import {
  Sync as SyncIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import apiService from '../services/api';
import { SyncOperation } from '../types';

const SyncManagement: React.FC = () => {
  const [openDialog, setOpenDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: syncs, isLoading } = useQuery<SyncOperation[]>(
    'syncs',
    () => apiService.getAllSyncs().then(res => res.data),
    { refetchInterval: 5000 }
  );

  const startSyncMutation = useMutation(
    (data: any) => apiService.startBatchSync(data.employeeIds, data.locationIds, data.policyTypes, data.forceSync),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('syncs');
        setOpenDialog(false);
      }
    }
  );

  const cancelSyncMutation = useMutation(
    (syncId: string) => apiService.cancelSync(syncId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('syncs');
      }
    }
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'running': return 'info';
      case 'failed': return 'error';
      case 'started': return 'warning';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <SyncIcon sx={{ animation: 'spin 2s linear infinite' }} />;
      case 'completed': return <RefreshIcon />;
      case 'failed': return <StopIcon />;
      default: return <SyncIcon />;
    }
  };

  if (isLoading) return <LinearProgress />;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Synchronization Management</Typography>
        <Button
          variant="contained"
          startIcon={<StartIcon />}
          onClick={() => setOpenDialog(true)}
        >
          Start New Sync
        </Button>
      </Box>

      <Box display="flex" flexDirection="column" gap={2}>
        {syncs?.map((sync) => (
          <Card key={sync.syncId}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  {getStatusIcon(sync.status)}
                  <Typography variant="h6">
                    {sync.type.charAt(0).toUpperCase() + sync.type.slice(1)} Sync
                  </Typography>
                  <Chip
                    label={sync.status.toUpperCase()}
                    color={getStatusColor(sync.status) as any}
                    size="small"
                  />
                </Box>
                
                {sync.status === 'running' && (
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<StopIcon />}
                    onClick={() => cancelSyncMutation.mutate(sync.syncId)}
                  >
                    Cancel
                  </Button>
                )}
              </Box>

              <Typography variant="body2" color="textSecondary" gutterBottom>
                Sync ID: {sync.syncId}
              </Typography>

              <Typography variant="body2" gutterBottom>
                Progress: {sync.employeesProcessed} / {sync.totalEmployees} employees
              </Typography>

              {sync.status === 'running' && (
                <LinearProgress
                  variant="determinate"
                  value={(sync.employeesProcessed / sync.totalEmployees) * 100}
                  sx={{ mb: 2 }}
                />
              )}

              <Typography variant="body2" color="textSecondary">
                Started: {new Date(sync.startTime).toLocaleString()}
              </Typography>

              {sync.endTime && (
                <Typography variant="body2" color="textSecondary">
                  Completed: {new Date(sync.endTime).toLocaleString()}
                </Typography>
              )}

              {sync.errors && sync.errors.length > 0 && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  Errors: {sync.errors.join(', ')}
                </Alert>
              )}
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Start Sync Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Start Synchronization</DialogTitle>
        <DialogContent>
          <SyncForm onSubmit={(data) => startSyncMutation.mutate(data)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const SyncForm: React.FC<{ onSubmit: (data: any) => void }> = ({ onSubmit }) => {
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>(['EMP001', 'EMP002']);
  const [selectedLocations, setSelectedLocations] = useState<string[]>(['NYC']);
  const [selectedPolicies, setSelectedPolicies] = useState<string[]>(['vacation', 'sick']);

  const employees = ['EMP001', 'EMP002', 'EMP003'];
  const locations = ['NYC', 'LAX', 'CHI'];
  const policies = ['vacation', 'sick', 'personal'];

  const handleSubmit = () => {
    onSubmit({
      employeeIds: selectedEmployees,
      locationIds: selectedLocations,
      policyTypes: selectedPolicies
    });
  };

  return (
    <Box>
      <Typography variant="body2" color="textSecondary" gutterBottom>
        Select employees, locations, and policies to synchronize:
      </Typography>

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Employees</InputLabel>
        <Select
          multiple
          value={selectedEmployees}
          onChange={(e) => setSelectedEmployees(e.target.value as string[])}
          renderValue={(selected) => (selected as string[]).join(', ')}
        >
          {employees.map((emp) => (
            <MenuItem key={emp} value={emp}>
              <Checkbox checked={selectedEmployees.indexOf(emp) > -1} />
              <ListItemText primary={emp} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Locations</InputLabel>
        <Select
          multiple
          value={selectedLocations}
          onChange={(e) => setSelectedLocations(e.target.value as string[])}
          renderValue={(selected) => (selected as string[]).join(', ')}
        >
          {locations.map((loc) => (
            <MenuItem key={loc} value={loc}>
              <Checkbox checked={selectedLocations.indexOf(loc) > -1} />
              <ListItemText primary={loc} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Policy Types</InputLabel>
        <Select
          multiple
          value={selectedPolicies}
          onChange={(e) => setSelectedPolicies(e.target.value as string[])}
          renderValue={(selected) => (selected as string[]).join(', ')}
        >
          {policies.map((policy) => (
            <MenuItem key={policy} value={policy}>
              <Checkbox checked={selectedPolicies.indexOf(policy) > -1} />
              <ListItemText primary={policy.charAt(0).toUpperCase() + policy.slice(1)} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Button variant="contained" onClick={handleSubmit} fullWidth>
        Start Sync
      </Button>
    </Box>
  );
};

export default SyncManagement;
