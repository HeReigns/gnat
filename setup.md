# GNAT South Tongu LMS Setup Guide

## Prerequisites

Before setting up the LMS, ensure you have the following installed:

- **Node.js** (v16 or higher)
- **npm** (v8 or higher)
- **MongoDB** (v5 or higher)
- **Git**

## Quick Setup

### 1. Clone and Install Dependencies

```bash
# Install all dependencies (root, server, and client)
npm run install-all
```

### 2. Database Setup

1. **Install MongoDB** (if not already installed):
   - Download from [MongoDB Official Site](https://www.mongodb.com/try/download/community)
   - Or use Docker: `docker run -d -p 27017:27017 --name mongodb mongo:latest`

2. **Start MongoDB**:
   ```bash
   # On Windows
   net start MongoDB
   
   # On macOS/Linux
   sudo systemctl start mongod
   ```

### 3. Environment Configuration

1. **Copy environment file**:
   ```bash
   cd server
   cp env.example .env
   ```

2. **Edit `.env` file** with your configuration:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # Database Configuration
   MONGODB_URI=mongodb://localhost:27017/gnat_lms
   
   # JWT Configuration
   JWT_SECRET=your_very_secure_jwt_secret_key_here
   JWT_EXPIRE=7d
   
   # File Upload Configuration
   MAX_FILE_SIZE=10485760
   UPLOAD_PATH=./uploads
   ```

### 4. Start the Application

```bash
# Start both frontend and backend in development mode
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

## Manual Setup (Alternative)

If you prefer to set up each part separately:

### Backend Setup

```bash
cd server
npm install
cp env.example .env
# Edit .env file
npm run dev
```

### Frontend Setup

```bash
cd client
npm install
npm start
```

## Initial Setup

### 1. Create Admin User

Once the application is running, you can create an admin user through the registration page or directly in the database:

```javascript
// In MongoDB shell or MongoDB Compass
use gnat_lms
db.users.insertOne({
  firstName: "Admin",
  lastName: "User",
  email: "admin@gnat-south-tongu.com",
  password: "$2a$12$hashedpassword", // Use bcrypt to hash
  role: "admin",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
})
```

### 2. Sample Data

You can add sample courses and content through the admin interface once logged in.

## Production Deployment

### 1. Build the Application

```bash
# Build the React frontend
npm run build
```

### 2. Environment Variables

Set production environment variables:

```env
NODE_ENV=production
MONGODB_URI=your_production_mongodb_uri
JWT_SECRET=your_production_jwt_secret
```

### 3. Process Management

Use PM2 or similar process manager:

```bash
npm install -g pm2
pm2 start server/index.js --name "gnat-lms"
pm2 startup
pm2 save
```

## Features Overview

### For Students
- Browse and search courses
- Enroll in courses (free and paid)
- Access course content and lessons
- Submit assignments with text and file uploads
- View assignment grades and feedback
- Take quizzes with multiple question types (multiple choice, true/false, short answer, essay, matching, fill-in-the-blank)
- View quiz results and feedback
- Track learning progress and analytics
- Participate in discussion forums
- Create and reply to forum topics
- Like/dislike posts
- Report inappropriate content
- Search forum topics and posts
- Upload and manage files
- Receive email notifications for important events
- Make payments for course enrollments
- View payment history and receipts

### For Teachers
- Create and manage courses
- Upload course content and files
- Create assignments with various submission types (text, file, both)
- Set due dates, late penalties, and grading rubrics
- Grade student submissions with detailed feedback
- Create quizzes with multiple question types and settings
- Set time limits, passing scores, and attempt limits
- Auto-grade objective questions and manually grade subjective questions
- View quiz statistics and student performance
- Monitor student progress and analytics
- Generate progress reports and analytics
- Create and manage forum categories
- Moderate forum discussions
- Pin and lock forum topics
- Mark solutions for question topics
- Manage forum content and users
- Upload and manage course files
- Set course pricing and payment options
- View course revenue and payment analytics
- Send email notifications to students

### For Administrators
- User management
- Course approval and management
- System configuration
- Comprehensive analytics and reporting
- Progress tracking and analytics
- Payment management and refunds
- Revenue analytics and reporting
- File management and storage
- Email notification management
- System-wide statistics and trends

## API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/password` - Change password

### Course Endpoints
- `GET /api/courses` - Get all courses (with filtering)
- `GET /api/courses/featured` - Get featured courses
- `GET /api/courses/:id` - Get course details
- `POST /api/courses` - Create new course (Teacher/Admin)
- `PUT /api/courses/:id` - Update course (Teacher/Admin)
- `DELETE /api/courses/:id` - Delete course (Teacher/Admin)

### User Endpoints
- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id` - Update user (Admin only)
- `DELETE /api/users/:id` - Delete user (Admin only)

### Assignment Endpoints
- `GET /api/assignments/course/:courseId` - Get assignments for a course
- `GET /api/assignments/:id` - Get assignment details
- `POST /api/assignments` - Create new assignment (Teacher only)
- `PUT /api/assignments/:id` - Update assignment (Teacher only)
- `DELETE /api/assignments/:id` - Delete assignment (Teacher only)
- `POST /api/assignments/:id/submit` - Submit assignment (Student only)
- `GET /api/assignments/:id/submissions` - Get submissions for assignment (Teacher only)
- `POST /api/assignments/submissions/:submissionId/grade` - Grade submission (Teacher only)
- `GET /api/assignments/student/submissions` - Get student's submissions

### Quiz Endpoints
- `GET /api/quizzes/course/:courseId` - Get quizzes for a course
- `GET /api/quizzes/:id` - Get quiz details
- `POST /api/quizzes` - Create new quiz (Teacher only)
- `PUT /api/quizzes/:id` - Update quiz (Teacher only)
- `DELETE /api/quizzes/:id` - Delete quiz (Teacher only)
- `POST /api/quizzes/:id/start` - Start quiz attempt (Student only)
- `POST /api/quizzes/attempts/:attemptId/submit` - Submit quiz answers (Student only)
- `GET /api/quizzes/:id/attempts` - Get quiz attempts (Teacher only)
- `POST /api/quizzes/attempts/:attemptId/grade` - Grade quiz attempt (Teacher only)
- `GET /api/quizzes/student/attempts` - Get student's quiz attempts

### Forum Endpoints
- `GET /api/forums/categories` - Get forum categories
- `GET /api/forums/categories/:id` - Get category details
- `POST /api/forums/categories` - Create category (Teacher/Admin only)
- `PUT /api/forums/categories/:id` - Update category (Teacher/Admin only)
- `DELETE /api/forums/categories/:id` - Delete category (Admin only)
- `GET /api/forums/categories/:categoryId/topics` - Get topics in category
- `GET /api/forums/topics/search` - Search topics
- `GET /api/forums/topics/:id` - Get topic details
- `POST /api/forums/topics` - Create topic
- `PUT /api/forums/topics/:id` - Update topic
- `DELETE /api/forums/topics/:id` - Delete topic
- `POST /api/forums/topics/:id/subscribe` - Subscribe to topic
- `GET /api/forums/topics/:topicId/posts` - Get posts for topic
- `GET /api/forums/posts/:postId/replies` - Get replies for post
- `POST /api/forums/posts` - Create post/reply
- `PUT /api/forums/posts/:id` - Update post
- `DELETE /api/forums/posts/:id` - Delete post
- `POST /api/forums/posts/:id/like` - Like post
- `POST /api/forums/posts/:id/dislike` - Dislike post
- `POST /api/forums/posts/:id/report` - Report post
- `POST /api/forums/posts/:id/solution` - Mark post as solution

### File Management Endpoints
- `POST /api/files/upload` - Upload single file
- `POST /api/files/upload-multiple` - Upload multiple files
- `GET /api/files` - Get all files (with filtering)
- `GET /api/files/by-type/:type` - Get files by type
- `GET /api/files/:id` - Get single file
- `GET /api/files/:id/download` - Download file
- `GET /api/files/:id/thumbnail` - Get file thumbnail
- `PUT /api/files/:id` - Update file metadata
- `DELETE /api/files/:id` - Delete file
- `GET /api/files/search` - Search files

### Progress Tracking Endpoints
- `GET /api/progress/course/:courseId` - Get student progress for a course
- `GET /api/progress/student` - Get student's overall progress
- `PUT /api/progress/:id` - Update progress for a specific item
- `POST /api/progress/record` - Record progress update
- `POST /api/progress/complete` - Complete an item
- `GET /api/progress/analytics/course/:courseId` - Get course analytics (Teacher/Admin)
- `GET /api/progress/analytics/student/:studentId` - Get student analytics (Teacher/Admin)
- `GET /api/progress/analytics/system` - Get system-wide analytics (Admin only)
- `GET /api/progress/analytics/trends` - Get progress trends over time
- `GET /api/progress/reports/progress/:courseId` - Generate progress report

### Payment Endpoints
- `POST /api/payments/initialize` - Initialize payment
- `POST /api/payments/callback/:provider` - Process payment callback
- `GET /api/payments/verify/:paymentId` - Verify payment status
- `GET /api/payments/user` - Get user payments
- `GET /api/payments/:paymentId` - Get payment details
- `POST /api/payments/:paymentId/cancel` - Cancel payment
- `POST /api/payments/:paymentId/refund` - Request refund (Admin only)
- `GET /api/payments/analytics/stats` - Get payment statistics (Admin only)
- `GET /api/payments/analytics/revenue` - Get revenue analytics (Admin only)
- `GET /api/payments/analytics/course/:courseId` - Get course payment analytics (Teacher/Admin)

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check connection string in `.env`
   - Verify network connectivity

2. **Port Already in Use**
   - Change port in `.env` file
   - Kill existing processes using the port

3. **JWT Token Issues**
   - Ensure JWT_SECRET is set in `.env`
   - Check token expiration settings

4. **File Upload Issues**
   - Ensure upload directory exists
   - Check file size limits
   - Verify permissions

### Logs

Check application logs for detailed error information:

```bash
# Backend logs
cd server
npm run dev

# Frontend logs
cd client
npm start
```

## Support

For technical support or questions about the GNAT South Tongu LMS:

- Check the documentation
- Review the code comments
- Contact the development team

## License

This project is licensed under the MIT License - see the LICENSE file for details.
