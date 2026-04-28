import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Alert,
  LinearProgress
} from '@mui/material';
import {
  Add as AddIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Event as TimeOffIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import apiService from '../services/api';
import { TimeOffRequest, CreateTimeOffRequest } from '../types';

const schema = yup.object().shape({
  employeeId: yup.string().required('Employee ID is required'),
  locationId: yup.string().required('Location is required'),
  policyType: yup.string().required('Policy type is required'),
  startDate: yup.string().required('Start date is required'),
  endDate: yup.string().required('End date is required'),
  requestedDays: yup.number().positive().required('Requested days is required'),
  reason: yup.string().required('Reason is required'),
  priority: yup.string().oneOf(['normal', 'urgent']).default('normal')
});

const TimeOffRequests: React.FC = () => {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery<TimeOffRequest[]>(
    'timeOffRequests',
    () => apiService.getTimeOffRequests().then(res => res.data),
    { refetchInterval: 30000 }
  );

  const createMutation = useMutation(
    (data: CreateTimeOffRequest) => apiService.createTimeOffRequest(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('timeOffRequests');
        setOpen(false);
      }
    }
  );

  const approveMutation = useMutation(
    (requestId: string) => apiService.approveTimeOffRequest(requestId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('timeOffRequests');
      }
    }
  );

  const rejectMutation = useMutation(
    ({ requestId, reason }: { requestId: string; reason: string }) => 
      apiService.rejectTimeOffRequest(requestId, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('timeOffRequests');
      }
    }
  );

  const { control, handleSubmit, reset, formState: { errors } } = useForm<CreateTimeOffRequest>({
    resolver: yupResolver(schema)
  });

  const handleCreateRequest = (data: CreateTimeOffRequest) => {
    createMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'pending': return 'warning';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    return priority === 'urgent' ? 'error' : 'default';
  };

  if (isLoading) return <LinearProgress />;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Time-Off Requests</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpen(true)}
        >
          New Request
        </Button>
      </Box>

      <Grid container spacing={3}>
        {requests?.map((request) => (
          <Grid item xs={12} md={6} lg={4} key={request.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                  <Typography variant="h6">
                    {request.employeeId}
                  </Typography>
                  <Box>
                    <Chip
                      label={request.status}
                      color={getStatusColor(request.status) as any}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    <Chip
                      label={request.priority}
                      color={getPriorityColor(request.priority) as any}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                </Box>
                
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {request.policyType} • {request.locationId}
                </Typography>
                
                <Typography variant="body2" gutterBottom>
                  <TimeOffIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                  {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                </Typography>
                
                <Typography variant="body2" gutterBottom>
                  Days: {request.requestedDays}
                </Typography>
                
                <Typography variant="body2" color="textSecondary">
                  {request.reason}
                </Typography>
                
                {request.warnings && request.warnings.length > 0 && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    {request.warnings.join(', ')}
                  </Alert>
                )}
              </CardContent>
              
              {request.status === 'pending' && (
                <CardActions>
                  <Button
                    size="small"
                    color="success"
                    startIcon={<ApproveIcon />}
                    onClick={() => approveMutation.mutate(request.id!)}
                    disabled={approveMutation.isLoading}
                  >
                    Approve
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<RejectIcon />}
                    onClick={() => {
                      const reason = prompt('Rejection reason:');
                      if (reason) {
                        rejectMutation.mutate({ requestId: request.id!, reason });
                      }
                    }}
                    disabled={rejectMutation.isLoading}
                  >
                    Reject
                  </Button>
                </CardActions>
              )}
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Create Request Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Time-Off Request</DialogTitle>
        <form onSubmit={handleSubmit(handleCreateRequest)}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="employeeId"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Employee ID"
                      fullWidth
                      error={!!errors.employeeId}
                      helperText={errors.employeeId?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="locationId"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Location"
                      fullWidth
                      error={!!errors.locationId}
                      helperText={errors.locationId?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="policyType"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.policyType}>
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
              <Grid item xs={12} sm={6}>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Priority</InputLabel>
                      <Select {...field}>
                        <MenuItem value="normal">Normal</MenuItem>
                        <MenuItem value="urgent">Urgent</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="startDate"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Start Date"
                      type="date"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      error={!!errors.startDate}
                      helperText={errors.startDate?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="endDate"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="End Date"
                      type="date"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      error={!!errors.endDate}
                      helperText={errors.endDate?.message}
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
                      error={!!errors.reason}
                      helperText={errors.reason?.message}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isLoading}>
              {createMutation.isLoading ? 'Creating...' : 'Create Request'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default TimeOffRequests;
