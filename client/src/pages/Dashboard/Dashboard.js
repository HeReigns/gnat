import React from 'react';
import { Container, Typography, Box } from '@mui/material';

const Dashboard = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary">
        User dashboard - to be implemented
      </Typography>
    </Container>
  );
};

export default Dashboard;
