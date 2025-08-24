import React from 'react';
import { Container, Typography, Box } from '@mui/material';

const AdminDashboard = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        Admin Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Admin dashboard - to be implemented
      </Typography>
    </Container>
  );
};

export default AdminDashboard;
