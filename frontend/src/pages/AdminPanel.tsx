import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Alert
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Security as SecurityIcon,
  Assessment as AnalyticsIcon,
  People as PeopleIcon
} from '@mui/icons-material';

const AdminPanel: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Admin Panel
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Administrative functions and system settings
      </Alert>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <PeopleIcon color="primary" />
                <Typography variant="h6">User Management</Typography>
              </Box>
              <Typography variant="body2" color="textSecondary">
                Manage users, roles, and permissions
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <SecurityIcon color="primary" />
                <Typography variant="h6">Security Settings</Typography>
              </Box>
              <Typography variant="body2" color="textSecondary">
                Configure authentication and authorization
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <AnalyticsIcon color="primary" />
                <Typography variant="h6">Analytics</Typography>
              </Box>
              <Typography variant="body2" color="textSecondary">
                View system analytics and reports
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <SettingsIcon color="primary" />
                <Typography variant="h6">System Settings</Typography>
              </Box>
              <Typography variant="body2" color="textSecondary">
                Configure system-wide settings
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AdminPanel;
