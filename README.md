# GNAT South Tongu Learning Management System

A comprehensive Learning Management System designed specifically for GNAT South Tongu to facilitate online learning, course management, and educational content delivery.

## Features

- **User Management**: Student, Teacher, and Admin roles
- **Course Management**: Create, edit, and organize courses
- **Content Delivery**: Support for various content types (videos, documents, quizzes)
- **Assessment Tools**: Quizzes, assignments, and grading system
- **Progress Tracking**: Monitor student progress and performance
- **Communication**: Discussion forums and messaging
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Technology Stack

- **Frontend**: React.js with Material-UI
- **Backend**: Node.js with Express
- **Database**: MongoDB
- **Authentication**: JWT tokens
- **File Storage**: Local storage with cloud integration ready

## Quick Start

1. **Install Dependencies**
   ```bash
   npm run install-all
   ```

2. **Set up Environment Variables**
   - Copy `.env.example` to `.env` in the server directory
   - Update the variables with your configuration

3. **Start Development Servers**
   ```bash
   npm run dev
   ```

4. **Access the Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## Project Structure

```
gnat-south-tongu-lms/
├── client/                 # React frontend
├── server/                 # Node.js backend
├── docs/                   # Documentation
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details
