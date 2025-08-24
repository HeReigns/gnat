const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_URL || 'https://gnat-lms-backend.onrender.com';
const ADMIN_EMAIL = 'hereignsjacobs@gmail.com';
const ADMIN_PASSWORD = 'Jeff@1993';
const ADMIN_NAME = 'Admin User';

async function createAdminUser() {
  try {
    console.log('Creating admin user...');
    console.log(`API URL: ${API_BASE_URL}`);
    
    const response = await axios.post(`${API_BASE_URL}/api/auth/register`, {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: 'admin'
    });

    console.log('✅ Admin user created successfully!');
    console.log('User details:', response.data.user);
    console.log('\nYou can now login with:');
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Password: ${ADMIN_PASSWORD}`);
    
  } catch (error) {
    console.error('❌ Error creating admin user:');
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Status:', error.response.status);
    } else {
      console.error('Error message:', error.message);
    }
    
    console.log('\nAlternative: You can create the admin user manually by:');
    console.log('1. Going to your frontend URL');
    console.log('2. Registering a new account');
    console.log('3. Then manually updating the user role to "admin" in your database');
  }
}

// Run the script
createAdminUser();
