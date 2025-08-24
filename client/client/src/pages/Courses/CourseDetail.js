import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  Avatar,
  Divider,
  Tabs,
  Tab,
  Skeleton,
  Alert,
  Paper
} from '@mui/material';
import {
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Grade as GradeIcon,
  Assignment as AssignmentIcon,
  Book as BookIcon,
  Group as GroupIcon,
  Quiz as QuizIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { format } from 'date-fns';
import AssignmentList from '../../components/Assignments/AssignmentList';
import QuizList from '../../components/Quizzes/QuizList';

const CourseDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    fetchCourse();
  }, [id]);

  const fetchCourse = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/courses/${id}`);
      setCourse(response.data.course);
    } catch (error) {
      console.error('Error fetching course:', error);
      setError('Failed to load course details');
      toast.error('Failed to load course details');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
        <Skeleton variant="text" height={40} sx={{ mb: 1 }} />
        <Skeleton variant="text" height={20} sx={{ mb: 3 }} />
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Skeleton variant="rectangular" height={400} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Skeleton variant="rectangular" height={300} />
          </Grid>
        </Grid>
      </Container>
    );
  }

  if (error || !course) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          {error || 'Course not found'}
        </Alert>
      </Container>
    );
  }

  const isInstructor = user?.role === 'teacher' && course.instructor._id === user.id;
  const isEnrolled = user?.enrolledCourses && user.enrolledCourses.includes(course._id);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Course Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Typography variant="h4" gutterBottom>
                {course.title}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                {course.description}
              </Typography>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                <Chip label={course.category} color="primary" />
                <Chip label={course.level} variant="outlined" />
                {course.isFeatured && <Chip label="Featured" color="secondary" />}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography variant="body2">
                    {course.instructor.firstName} {course.instructor.lastName}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <GroupIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography variant="body2">
                    {course.enrollmentCount} students enrolled
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <GradeIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography variant="body2">
                    {course.rating ? `${course.rating}/5` : 'No ratings yet'}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Avatar
                  sx={{ width: 80, height: 80, mx: 'auto', mb: 2 }}
                  src={course.instructor.profilePicture}
                >
                  {course.instructor.firstName[0]}{course.instructor.lastName[0]}
                </Avatar>
                <Typography variant="h6" gutterBottom>
                  {course.instructor.firstName} {course.instructor.lastName}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {course.instructor.email}
                </Typography>
                
                {!isInstructor && !isEnrolled && (
                  <Button variant="contained" fullWidth>
                    Enroll in Course
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Course Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Overview" icon={<BookIcon />} iconPosition="start" />
          <Tab label="Assignments" icon={<AssignmentIcon />} iconPosition="start" />
          <Tab label="Quizzes" icon={<QuizIcon />} iconPosition="start" />
          <Tab label="Lessons" icon={<BookIcon />} iconPosition="start" />
          <Tab label="Students" icon={<GroupIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <Box sx={{ mt: 3 }}>
        {activeTab === 0 && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Course Overview
                  </Typography>
                  
                  {course.shortDescription && (
                    <Typography variant="body1" sx={{ mb: 3 }}>
                      {course.shortDescription}
                    </Typography>
                  )}

                  {course.learningObjectives && course.learningObjectives.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="h6" gutterBottom>
                        Learning Objectives
                      </Typography>
                      <ul>
                        {course.learningObjectives.map((objective, index) => (
                          <li key={index}>
                            <Typography variant="body2">
                              {objective}
                            </Typography>
                          </li>
                        ))}
                      </ul>
                    </Box>
                  )}

                  {course.prerequisites && course.prerequisites.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="h6" gutterBottom>
                        Prerequisites
                      </Typography>
                      <ul>
                        {course.prerequisites.map((prerequisite, index) => (
                          <li key={index}>
                            <Typography variant="body2">
                              {prerequisite}
                            </Typography>
                          </li>
                        ))}
                      </ul>
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <ScheduleIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2">
                        Duration: {course.duration || 'Not specified'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <BookIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2">
                        {course.lessons?.length || 0} lessons
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Course Information
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Start Date
                    </Typography>
                    <Typography variant="body1">
                      {course.startDate ? format(new Date(course.startDate), 'PPP') : 'Not specified'}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      End Date
                    </Typography>
                    <Typography variant="body1">
                      {course.endDate ? format(new Date(course.endDate), 'PPP') : 'Not specified'}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Max Students
                    </Typography>
                    <Typography variant="body1">
                      {course.maxStudents || 'Unlimited'}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Price
                    </Typography>
                    <Typography variant="body1">
                      {course.price > 0 ? `$${course.price}` : 'Free'}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Status
                    </Typography>
                    <Chip 
                      label={course.isPublished ? 'Published' : 'Draft'} 
                      color={course.isPublished ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>

                  {course.certificate && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Certificate
                      </Typography>
                      <Typography variant="body1">
                        {course.certificate.available ? 'Available' : 'Not available'}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {activeTab === 1 && (
          <AssignmentList courseId={course._id} />
        )}

        {activeTab === 2 && (
          <QuizList courseId={course._id} />
        )}

        {activeTab === 3 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Course Lessons
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Lesson management functionality will be implemented here.
              </Typography>
            </CardContent>
          </Card>
        )}

        {activeTab === 4 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Enrolled Students
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Student management functionality will be implemented here.
              </Typography>
            </CardContent>
          </Card>
        )}
      </Box>
    </Container>
  );
};

export default CourseDetail;
