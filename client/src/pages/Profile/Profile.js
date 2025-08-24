import React from 'react';
import { Container, Typography, Box } from '@mui/material';

const Profile = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        Profile
      </Typography>
      <Typography variant="body1" color="text.secondary">
        User profile page - to be implemented
      </Typography>
    </Container>
  );
};

export default Profile;
