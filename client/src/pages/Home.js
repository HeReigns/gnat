import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Chip,
  Avatar,
  Rating,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  School as SchoolIcon,
  People as PeopleIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Home = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const [featuredCourses, setFeaturedCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeaturedCourses = async () => {
      try {
        const response = await axios.get('/api/courses/featured');
        setFeaturedCourses(response.data.courses);
      } catch (error) {
        console.error('Error fetching featured courses:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedCourses();
  }, []);

  const getCategoryColor = (category) => {
    const colors = {
      mathematics: '#2196f3',
      science: '#4caf50',
      english: '#ff9800',
      'social-studies': '#9c27b0',
      arts: '#f44336',
      'physical-education': '#795548',
      technology: '#607d8b',
      other: '#757575',
    };
    return colors[category] || colors.other;
  };

  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          py: { xs: 8, md: 12 },
          textAlign: 'center',
        }}
      >
        <Container maxWidth="lg">
          <Typography
            variant={isMobile ? 'h3' : 'h2'}
            component="h1"
            gutterBottom
            sx={{ fontWeight: 700, mb: 3 }}
          >
            Welcome to GNAT South Tongu LMS
          </Typography>
          <Typography
            variant="h5"
            sx={{ mb: 4, opacity: 0.9, maxWidth: 800, mx: 'auto' }}
          >
            Empowering education through technology. Join our community of learners
            and educators in South Tongu.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/courses')}
              sx={{
                bgcolor: 'white',
                color: 'primary.main',
                '&:hover': { bgcolor: 'grey.100' },
              }}
            >
              Explore Courses
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/register')}
              sx={{
                borderColor: 'white',
                color: 'white',
                '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            >
              Get Started
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Stats Section */}
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Grid container spacing={4} justifyContent="center">
          <Grid item xs={12} sm={4} textAlign="center">
            <SchoolIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h4" component="div" gutterBottom>
              50+
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Courses Available
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4} textAlign="center">
            <PeopleIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h4" component="div" gutterBottom>
              1000+
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Active Students
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4} textAlign="center">
            <TimeIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h4" component="div" gutterBottom>
              24/7
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Learning Access
            </Typography>
          </Grid>
        </Grid>
      </Container>

      {/* Featured Courses Section */}
      <Box sx={{ bgcolor: 'grey.50', py: 6 }}>
        <Container maxWidth="lg">
          <Typography
            variant="h3"
            component="h2"
            textAlign="center"
            gutterBottom
            sx={{ mb: 6 }}
          >
            Featured Courses
          </Typography>

          {loading ? (
            <Grid container spacing={3}>
              {[1, 2, 3].map((item) => (
                <Grid item xs={12} sm={6} md={4} key={item}>
                  <Card sx={{ height: '100%' }}>
                    <Box sx={{ height: 200, bgcolor: 'grey.200' }} />
                    <CardContent>
                      <Box sx={{ height: 20, bgcolor: 'grey.200', mb: 1 }} />
                      <Box sx={{ height: 16, bgcolor: 'grey.200', width: '60%' }} />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Grid container spacing={3}>
              {featuredCourses.map((course) => (
                <Grid item xs={12} sm={6} md={4} key={course._id}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      cursor: 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: theme.shadows[8],
                      },
                    }}
                    onClick={() => navigate(`/courses/${course._id}`)}
                  >
                    <CardMedia
                      component="img"
                      height="200"
                      image={course.thumbnail || 'https://via.placeholder.com/400x200?text=Course+Image'}
                      alt={course.title}
                    />
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Chip
                          label={course.category.replace('-', ' ').toUpperCase()}
                          size="small"
                          sx={{
                            bgcolor: getCategoryColor(course.category),
                            color: 'white',
                            fontSize: '0.7rem',
                          }}
                        />
                        <Chip
                          label={course.level.toUpperCase()}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      </Box>
                      <Typography variant="h6" component="h3" gutterBottom sx={{ fontWeight: 600 }}>
                        {course.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {course.description}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Avatar
                          src={course.instructor?.profilePicture}
                          sx={{ width: 24, height: 24, mr: 1 }}
                        >
                          {course.instructor?.firstName?.charAt(0)}
                        </Avatar>
                        <Typography variant="body2" color="text.secondary">
                          {course.instructor?.firstName} {course.instructor?.lastName}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Rating value={course.rating?.average || 0} readOnly size="small" />
                          <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                            ({course.rating?.count || 0})
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {formatDuration(course.duration)}
                        </Typography>
                      </Box>
                    </CardContent>
                    <CardActions>
                      <Button
                        size="small"
                        startIcon={<PlayIcon />}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/courses/${course._id}`);
                        }}
                      >
                        View Course
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          {!loading && featuredCourses.length === 0 && (
            <Box textAlign="center" py={4}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No featured courses available
              </Typography>
              <Button
                variant="contained"
                onClick={() => navigate('/courses')}
                sx={{ mt: 2 }}
              >
                Browse All Courses
              </Button>
            </Box>
          )}
        </Container>
      </Box>

      {/* Call to Action */}
      <Box sx={{ py: 8, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography variant="h3" component="h2" gutterBottom>
            Ready to Start Learning?
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
            Join thousands of students and educators in South Tongu who are already
            benefiting from our learning platform.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/register')}
            sx={{ mr: 2, mb: { xs: 2, sm: 0 } }}
          >
            Get Started Today
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => navigate('/courses')}
          >
            Explore Courses
          </Button>
        </Container>
      </Box>
    </Box>
  );
};

export default Home;
