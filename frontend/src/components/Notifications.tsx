import React from 'react';
import { Snackbar, Alert, AlertTitle } from '@mui/material';

const Notifications: React.FC = () => {
  return (
    <Snackbar open={false} autoHideDuration={6000}>
      <Alert severity="info">
        <AlertTitle>Notification</AlertTitle>
        System notifications will appear here
      </Alert>
    </Snackbar>
  );
};

export default Notifications;
