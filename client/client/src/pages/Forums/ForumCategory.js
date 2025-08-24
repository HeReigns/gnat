import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Box,
  Fab,
  Dialog,
  TextField,
  InputAdornment,
  Pagination,
  Avatar,
  IconButton,
  Tooltip,
  Breadcrumbs,
  Link
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Pin as PinIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  Comment as CommentIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  QuestionAnswer as QuestionAnswerIcon,
  Announcement as AnnouncementIcon,
  Poll as PollIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { format } from 'date-fns';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import ForumTopicForm from '../../components/Forums/ForumTopicForm';

const ForumCategory = () => {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState(null);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [openTopicForm, setOpenTopicForm] = useState(false);
  const [editingTopic, setEditingTopic] = useState(null);
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    fetchCategory();
    fetchCourses();
  }, [slug]);

  useEffect(() => {
    if (category) {
      fetchTopics();
    }
  }, [category, currentPage, searchQuery]);

  const fetchCategory = async () => {
    try {
      const response = await axios.get(`/api/forums/categories/${slug}`);
      setCategory(response.data);
    } catch (error) {
      console.error('Error fetching category:', error);
      toast.error('Failed to load forum category');
      navigate('/forums');
    }
  };

  const fetchTopics = async () => {
    try {
      const params = {
        page: currentPage,
        limit: 20
      };
      
      let response;
      if (searchQuery) {
        response = await axios.get('/api/forums/topics/search', {
          params: {
            ...params,
            q: searchQuery,
            category: category._id
          }
        });
      } else {
        response = await axios.get(`/api/forums/categories/${category._id}/topics`, {
          params
        });
      }
      
      setTopics(response.data.topics);
      setTotalPages(response.data.pagination.pages);
    } catch (error) {
      console.error('Error fetching topics:', error);
      toast.error('Failed to load topics');
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const response = await axios.get('/api/courses');
      setCourses(response.data);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const handleCreateTopic = async (topicData) => {
    try {
      await axios.post('/api/forums/topics', {
        ...topicData,
        category: category._id
      });
      toast.success('Topic created successfully');
      setOpenTopicForm(false);
      fetchTopics();
    } catch (error) {
      console.error('Error creating topic:', error);
      toast.error(error.response?.data?.message || 'Failed to create topic');
    }
  };

  const handleUpdateTopic = async (topicData) => {
    try {
      await axios.put(`/api/forums/topics/${editingTopic._id}`, topicData);
      toast.success('Topic updated successfully');
      setOpenTopicForm(false);
      setEditingTopic(null);
      fetchTopics();
    } catch (error) {
      console.error('Error updating topic:', error);
      toast.error(error.response?.data?.message || 'Failed to update topic');
    }
  };

  const handleDeleteTopic = async (topicId) => {
    if (!window.confirm('Are you sure you want to delete this topic?')) {
      return;
    }

    try {
      await axios.delete(`/api/forums/topics/${topicId}`);
      toast.success('Topic deleted successfully');
      fetchTopics();
    } catch (error) {
      console.error('Error deleting topic:', error);
      toast.error(error.response?.data?.message || 'Failed to delete topic');
    }
  };

  const handleEditTopic = (topic) => {
    setEditingTopic(topic);
    setOpenTopicForm(true);
  };

  const handleOpenTopicForm = () => {
    setEditingTopic(null);
    setOpenTopicForm(true);
  };

  const handleCloseTopicForm = () => {
    setOpenTopicForm(false);
    setEditingTopic(null);
  };

  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (event, page) => {
    setCurrentPage(page);
  };

  const getTopicIcon = (type) => {
    const iconMap = {
      discussion: <CommentIcon />,
      question: <QuestionAnswerIcon />,
      announcement: <AnnouncementIcon />,
      poll: <PollIcon />
    };
    return iconMap[type] || <CommentIcon />;
  };

  const getTopicColor = (type) => {
    const colorMap = {
      discussion: 'primary',
      question: 'secondary',
      announcement: 'warning',
      poll: 'info'
    };
    return colorMap[type] || 'default';
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Loading topics...
        </Typography>
      </Container>
    );
  }

  if (!category) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Category not found
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link component={RouterLink} to="/forums" color="inherit">
          Forums
        </Link>
        <Typography color="text.primary">{category.name}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {category.name}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {category.description}
          </Typography>
        </Box>
        {category.allowedRoles.includes(user.role) && (
          <Fab
            color="primary"
            aria-label="add topic"
            onClick={handleOpenTopicForm}
          >
            <AddIcon />
          </Fab>
        )}
      </Box>

      {/* Search */}
      <Box mb={3}>
        <TextField
          fullWidth
          placeholder="Search topics..."
          value={searchQuery}
          onChange={handleSearch}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Topics */}
      <Grid container spacing={2}>
        {topics.map((topic) => (
          <Grid item xs={12} key={topic._id}>
            <Card 
              sx={{ 
                cursor: 'pointer',
                '&:hover': {
                  boxShadow: 6,
                  transform: 'translateY(-1px)',
                  transition: 'all 0.2s ease-in-out'
                }
              }}
              onClick={() => navigate(`/forums/topic/${topic.slug}`)}
            >
              <CardContent>
                <Box display="flex" alignItems="flex-start" gap={2}>
                  <Avatar sx={{ bgcolor: 'primary.main', mt: 0.5 }}>
                    {topic.author.avatar ? (
                      <img src={topic.author.avatar} alt="avatar" />
                    ) : (
                      topic.author.firstName?.charAt(0) || 'U'
                    )}
                  </Avatar>
                  
                  <Box flexGrow={1}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      {topic.isSticky && (
                        <PinIcon color="warning" fontSize="small" />
                      )}
                      {topic.isLocked && (
                        <LockIcon color="error" fontSize="small" />
                      )}
                      <Typography variant="h6" component="h2">
                        {topic.title}
                      </Typography>
                    </Box>
                    
                    <Box display="flex" alignItems="center" gap={2} mb={1}>
                      <Chip
                        icon={getTopicIcon(topic.type)}
                        label={topic.type}
                        size="small"
                        color={getTopicColor(topic.type)}
                        variant="outlined"
                      />
                      <Typography variant="body2" color="text.secondary">
                        by {topic.author.firstName} {topic.author.lastName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {format(new Date(topic.createdAt), 'MMM dd, yyyy')}
                      </Typography>
                    </Box>

                    {topic.tags && topic.tags.length > 0 && (
                      <Box display="flex" gap={1} mb={1} flexWrap="wrap">
                        {topic.tags.map((tag, index) => (
                          <Chip
                            key={index}
                            label={tag}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    )}

                    <Typography variant="body2" color="text.secondary" noWrap>
                      {topic.excerpt}
                    </Typography>
                  </Box>

                  <Box display="flex" flexDirection="column" alignItems="center" gap={1}>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <VisibilityIcon fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {topic.statistics.views}
                      </Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <CommentIcon fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {topic.statistics.replies}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </CardContent>

              {(user.role === 'admin' || topic.author._id === user.id) && (
                <CardActions sx={{ justifyContent: 'flex-end', p: 1 }}>
                  <Tooltip title="Edit Topic">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTopic(topic);
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete Topic">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTopic(topic._id);
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              )}
            </Card>
          </Grid>
        ))}
      </Grid>

      {topics.length === 0 && (
        <Box textAlign="center" py={4}>
          <CommentIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {searchQuery ? 'No topics found' : 'No topics yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchQuery 
              ? 'Try adjusting your search terms'
              : category.allowedRoles.includes(user.role)
                ? 'Be the first to start a discussion!'
                : 'Check back later for new topics.'
            }
          </Typography>
        </Box>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={4}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={handlePageChange}
            color="primary"
          />
        </Box>
      )}

      <Dialog
        open={openTopicForm}
        onClose={handleCloseTopicForm}
        maxWidth="md"
        fullWidth
      >
        <ForumTopicForm
          topic={editingTopic}
          category={category}
          courses={courses}
          onSubmit={editingTopic ? handleUpdateTopic : handleCreateTopic}
          onCancel={handleCloseTopicForm}
        />
      </Dialog>
    </Container>
  );
};

export default ForumCategory;

