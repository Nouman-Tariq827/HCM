import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  AccountBalance as BalanceIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import apiService from '../services/api';
import { Balance } from '../types';

const schema = yup.object().shape({
  employeeId: yup.string().required('Employee ID is required'),
  locationId: yup.string().required('Location is required'),
  policyType: yup.string().required('Policy type is required'),
  days: yup.number().positive('Days must be positive').required('Days is required'),
  reason: yup.string().required('Reason is required')
});

const BalanceManagement: React.FC = () => {
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogType, setDialogType] = useState<'add' | 'deduct'>('add');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const queryClient = useQueryClient();

  const { data: balances, isLoading } = useQuery<Balance[]>(
    'balances',
    async () => {
      // For demo, get some sample balances
      const sampleBalances: Balance[] = [
        {
          employeeId: 'EMP001',
          locationId: 'NYC',
          policyType: 'vacation',
          currentBalance: 15.5,
          lastSyncAt: new Date().toISOString(),
          syncVersion: 42,
          staleness: 'fresh'
        },
        {
          employeeId: 'EMP002',
          locationId: 'NYC',
          policyType: 'sick',
          currentBalance: 8.0,
          lastSyncAt: new Date().toISOString(),
          syncVersion: 38,
          staleness: 'fresh'
        }
      ];
      return sampleBalances;
    },
    { refetchInterval: 30000 }
  );

  const addMutation = useMutation(
    (data: any) => apiService.addBalance(data.employeeId, data.locationId, data.policyType, data.days, data.reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('balances');
        setOpenDialog(false);
      }
    }
  );

  const deductMutation = useMutation(
    (data: any) => apiService.deductBalance(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('balances');
        setOpenDialog(false);
      }
    }
  );

  const { control, handleSubmit, reset } = useForm({
    resolver: yupResolver(schema)
  });

  const handleBalanceAction = (type: 'add' | 'deduct', employeeId: string) => {
    setDialogType(type);
    setSelectedEmployee(employeeId);
    setOpenDialog(true);
  };

  const getStalenessColor = (staleness: string) => {
    switch (staleness) {
      case 'fresh': return 'success';
      case 'stale': return 'warning';
      case 'critical': return 'error';
      default: return 'default';
    }
  };

  if (isLoading) return <LinearProgress />;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Balance Management
      </Typography>

      <Grid container spacing={3}>
        {balances?.map((balance, index) => (
          <Grid item xs={12} md={6} lg={4} key={index}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                  <Typography variant="h6">
                    {balance.employeeId}
                  </Typography>
                  <Chip
                    label={balance.staleness}
                    color={getStalenessColor(balance.staleness) as any}
                    size="small"
                  />
                </Box>
                
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {balance.policyType} • {balance.locationId}
                </Typography>
                
                <Typography variant="h4" color="primary" gutterBottom>
                  {balance.currentBalance} days
                </Typography>
                
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Last Sync: {new Date(balance.lastSyncAt).toLocaleString()}
                </Typography>
                
                <Typography variant="body2" color="textSecondary">
                  Version: {balance.syncVersion}
                </Typography>
              </CardContent>
              
              <Box display="flex" gap={1} p={2}>
                <Button
                  size="small"
                  variant="outlined"
                  color="success"
                  startIcon={<AddIcon />}
                  onClick={() => handleBalanceAction('add', balance.employeeId)}
                >
                  Add
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<RemoveIcon />}
                  onClick={() => handleBalanceAction('deduct', balance.employeeId)}
                >
                  Deduct
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<HistoryIcon />}
                >
                  History
                </Button>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Balance Action Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogType === 'add' ? 'Add Balance' : 'Deduct Balance'}
        </DialogTitle>
        <form onSubmit={handleSubmit((data) => {
          if (dialogType === 'add') {
            addMutation.mutate(data);
          } else {
            deductMutation.mutate(data);
          }
        })}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Controller
                  name="employeeId"
                  control={control}
                  defaultValue={selectedEmployee}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Employee ID"
                      fullWidth
                      disabled
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="locationId"
                  control={control}
                  defaultValue="NYC"
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Location"
                      fullWidth
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="policyType"
                  control={control}
                  defaultValue="vacation"
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Policy Type</InputLabel>
                      <Select {...field}>
                        <MenuItem value="vacation">Vacation</MenuItem>
                        <MenuItem value="sick">Sick</MenuItem>
                        <MenuItem value="personal">Personal</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="days"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Days"
                      type="number"
                      fullWidth
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="reason"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Reason"
                      fullWidth
                      multiline
                      rows={3}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained">
              {dialogType === 'add' ? 'Add Balance' : 'Deduct Balance'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default BalanceManagement;
