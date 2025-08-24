# GNAT LMS Deployment Guide for Render

## Prerequisites

1. **GitHub Repository**: Ensure your project is pushed to a GitHub repository
2. **MongoDB Atlas**: Set up a MongoDB Atlas cluster (free tier available)
3. **Email Service**: Set up an email service (Gmail, SendGrid, etc.)
4. **Payment Providers**: Set up Stripe and/or PayPal accounts (optional)

## Step 1: Prepare Your Repository

1. **Push to GitHub**: Make sure all your code is committed and pushed to GitHub
2. **Verify Files**: Ensure these files are in your repository:
   - `render.yaml` (deployment configuration)
   - `server/package.json` (backend dependencies)
   - `client/package.json` (frontend dependencies)
   - `client/public/_redirects` (for React Router)

## Step 2: Set Up MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free account and cluster
3. Create a database user with read/write permissions
4. Get your connection string
5. Add your IP address to the whitelist (or use 0.0.0.0/0 for all IPs)

## Step 3: Deploy to Render

### Option A: Using render.yaml (Recommended)

1. **Connect Repository**:
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Render will automatically detect the `render.yaml` file

2. **Configure Environment Variables**:
   After the services are created, go to each service and add these environment variables:

   **For Backend Service (`gnat-lms-backend`)**:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/gnat-lms
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_EXPIRE=30d
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   STRIPE_SECRET_KEY=sk_test_...
   PAYPAL_CLIENT_ID=your-paypal-client-id
   PAYPAL_CLIENT_SECRET=your-paypal-secret
   ```

       **For Frontend Service (`gnatlms`)**:
    ```
    REACT_APP_API_URL=https://gnat-lms-backend.onrender.com
    ```

### Option B: Manual Deployment

1. **Deploy Backend**:
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name**: `gnat-lms-backend`
     - **Environment**: `Node`
     - **Build Command**: `cd server && npm install`
     - **Start Command**: `cd server && npm start`
     - **Plan**: Free

2. **Deploy Frontend**:
   - Click "New" → "Static Site"
   - Connect your GitHub repository
   - Configure:
     - **Name**: `gnatlms`
     - **Build Command**: `cd client && npm install && npm run build`
     - **Publish Directory**: `client/build`

## Step 4: Configure Environment Variables

### Backend Environment Variables

1. Go to your backend service dashboard
2. Click "Environment" tab
3. Add these variables:

```bash
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/gnat-lms
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRE=30d
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
STRIPE_SECRET_KEY=sk_test_...
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-secret
```

### Frontend Environment Variables

1. Go to your frontend service dashboard
2. Click "Environment" tab
3. Add this variable:

```bash
REACT_APP_API_URL=https://gnat-lms-backend.onrender.com
```

## Step 5: Create Admin User

After deployment, you need to create an admin user. You can do this by:

1. **Using the API directly**:
   ```bash
   curl -X POST https://gnat-lms-backend.onrender.com/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Admin User",
       "email": "hereignsjacobs@gmail.com",
       "password": "Jeff@1993",
       "role": "admin"
     }'
   ```

2. **Or modify the registration temporarily** to allow admin creation

## Step 6: Test Your Deployment

1. **Backend Health Check**: Visit `https://gnat-lms-backend.onrender.com/api/health`
2. **Frontend**: Visit your frontend URL
3. **Login**: Use the admin credentials you provided

## Important Notes

### Free Tier Limitations

- **Backend**: Services sleep after 15 minutes of inactivity
- **Frontend**: No sleep time, always available
- **Build Time**: Limited to 500 minutes per month
- **Bandwidth**: 100GB per month

### Production Considerations

1. **Database**: Consider upgrading to a paid MongoDB Atlas plan for better performance
2. **Email**: Use a production email service like SendGrid
3. **File Storage**: Consider using AWS S3 or similar for file uploads
4. **SSL**: Render provides free SSL certificates
5. **Custom Domain**: You can add a custom domain in Render settings

### Troubleshooting

1. **Build Failures**: Check the build logs in Render dashboard
2. **Environment Variables**: Ensure all required variables are set
3. **Database Connection**: Verify MongoDB URI and network access
4. **CORS Issues**: Backend is configured to allow all origins in production

## URLs After Deployment

- **Backend API**: `https://gnat-lms-backend.onrender.com`
- **Frontend**: `https://gnatlms.onrender.com`
- **Health Check**: `https://gnat-lms-backend.onrender.com/api/health`

## Next Steps

1. Set up your MongoDB Atlas database
2. Configure email service credentials
3. Set up payment providers (if needed)
4. Deploy using the steps above
5. Create your admin user
6. Test all features thoroughly

Your GNAT LMS will be fully functional on Render with all the features you've implemented!
