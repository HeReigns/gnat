import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Pagination,
  Skeleton,
  Alert,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Quiz as QuizIcon,
  Schedule as ScheduleIcon,
  Grade as GradeIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  PlayArrow as PlayArrowIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { format } from 'date-fns';
import QuizForm from './QuizForm';
import QuizAttempt from './QuizAttempt';

const QuizList = ({ courseId }) => {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showAttempt, setShowAttempt] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedQuizForMenu, setSelectedQuizForMenu] = useState(null);

  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';

  useEffect(() => {
    fetchQuizzes();
  }, [courseId, page, statusFilter, searchTerm]);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page,
        limit: 10,
        ...(statusFilter && { status: statusFilter }),
        ...(searchTerm && { search: searchTerm })
      });

      const response = await axios.get(`/api/quizzes/course/${courseId}?${params}`);
      setQuizzes(response.data.quizzes);
      setTotalPages(response.data.pagination.pages);
    } catch (error) {
      console.error('Error fetching quizzes:', error);
      setError('Failed to load quizzes');
      toast.error('Failed to load quizzes');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (quizId) => {
    if (!window.confirm('Are you sure you want to delete this quiz?')) {
      return;
    }

    try {
      await axios.delete(`/api/quizzes/${quizId}`);
      toast.success('Quiz deleted successfully');
      fetchQuizzes();
    } catch (error) {
      console.error('Error deleting quiz:', error);
      toast.error(error.response?.data?.message || 'Error deleting quiz');
    }
  };

  const handleMenuOpen = (event, quiz) => {
    setAnchorEl(event.currentTarget);
    setSelectedQuizForMenu(quiz);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedQuizForMenu(null);
  };

  const handleEdit = (quiz) => {
    setSelectedQuiz(quiz);
    setShowForm(true);
    handleMenuClose();
  };

  const handleViewAttempts = (quiz) => {
    setSelectedQuiz(quiz);
    // Navigate to attempts view or open attempts dialog
    handleMenuClose();
  };

  const handleStartQuiz = async (quiz) => {
    try {
      const response = await axios.post(`/api/quizzes/${quiz._id}/start`);
      setSelectedQuiz(quiz);
      setShowAttempt(true);
      toast.success('Quiz started successfully');
    } catch (error) {
      console.error('Error starting quiz:', error);
      toast.error(error.response?.data?.message || 'Error starting quiz');
    }
  };

  const handleQuizSuccess = () => {
    setShowForm(false);
    setSelectedQuiz(null);
    fetchQuizzes();
  };

  const handleAttemptSuccess = () => {
    setShowAttempt(false);
    setSelectedQuiz(null);
    fetchQuizzes();
  };

  const getStatusColor = (quiz) => {
    const now = new Date();
    const startDate = new Date(quiz.startDate);
    const endDate = new Date(quiz.endDate);
    
    if (!quiz.isPublished) return 'default';
    if (!quiz.isActive) return 'default';
    if (now < startDate) return 'info';
    if (now > endDate) return 'error';
    return 'success';
  };

  const getStatusText = (quiz) => {
    const now = new Date();
    const startDate = new Date(quiz.startDate);
    const endDate = new Date(quiz.endDate);
    
    if (!quiz.isPublished) return 'Draft';
    if (!quiz.isActive) return 'Inactive';
    if (now < startDate) return 'Scheduled';
    if (now > endDate) return 'Expired';
    return 'Active';
  };

  const isAvailable = (quiz) => {
    const now = new Date();
    const startDate = new Date(quiz.startDate);
    const endDate = new Date(quiz.endDate);
    return quiz.isPublished && quiz.isActive && now >= startDate && now <= endDate;
  };

  const formatTimeLimit = (minutes) => {
    if (minutes === 0) return 'No time limit';
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours} hours`;
  };

  if (loading) {
    return (
      <Box>
        <Grid container spacing={3}>
          {[...Array(6)].map((_, index) => (
            <Grid item xs={12} md={6} key={index}>
              <Skeleton variant="rectangular" height={200} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header and Filters */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">
          Quizzes ({quizzes.length})
        </Typography>
        
        {isTeacher && (
          <Fab
            color="primary"
            aria-label="add quiz"
            onClick={() => setShowForm(true)}
          >
            <AddIcon />
          </Fab>
        )}
      </Box>

      {/* Filters */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          label="Search quizzes"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{ minWidth: 200 }}
        />
        
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            label="Status"
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="scheduled">Scheduled</MenuItem>
            <MenuItem value="expired">Expired</MenuItem>
            {isTeacher && <MenuItem value="draft">Draft</MenuItem>}
          </Select>
        </FormControl>
      </Box>

      {/* Quizzes Grid */}
      <Grid container spacing={3}>
        {quizzes.map((quiz) => (
          <Grid item xs={12} md={6} key={quiz._id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" gutterBottom>
                      {quiz.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {quiz.description}
                    </Typography>
                  </Box>
                  
                  {isTeacher && (
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, quiz)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  )}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Chip
                    label={getStatusText(quiz)}
                    color={getStatusColor(quiz)}
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  <Chip
                    label={`${quiz.totalPoints} pts`}
                    variant="outlined"
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  {quiz.timeLimit > 0 && (
                    <Chip
                      label={formatTimeLimit(quiz.timeLimit)}
                      variant="outlined"
                      size="small"
                    />
                  )}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <ScheduleIcon sx={{ mr: 1, fontSize: 'small', color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    {format(new Date(quiz.startDate), 'PPP p')} - {format(new Date(quiz.endDate), 'PPP p')}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <QuizIcon sx={{ mr: 1, fontSize: 'small', color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    {quiz.questions.length} questions • {quiz.passingScore}% to pass
                  </Typography>
                </Box>

                {quiz.lesson && (
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Related to: {quiz.lesson.title}
                    </Typography>
                  </Box>
                )}

                {/* Action Buttons */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {isStudent && isAvailable(quiz) && (
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<PlayArrowIcon />}
                      onClick={() => handleStartQuiz(quiz)}
                    >
                      Start Quiz
                    </Button>
                  )}
                  
                  {isStudent && !isAvailable(quiz) && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<VisibilityIcon />}
                      disabled
                    >
                      {getStatusText(quiz)}
                    </Button>
                  )}
                  
                  {isTeacher && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<GradeIcon />}
                      onClick={() => handleViewAttempts(quiz)}
                    >
                      View Attempts
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(e, value) => setPage(value)}
            color="primary"
          />
        </Box>
      )}

      {/* Quiz Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleEdit(selectedQuizForMenu)}>
          <EditIcon sx={{ mr: 1 }} />
          Edit Quiz
        </MenuItem>
        <MenuItem onClick={() => handleViewAttempts(selectedQuizForMenu)}>
          <GradeIcon sx={{ mr: 1 }} />
          View Attempts
        </MenuItem>
        <MenuItem 
          onClick={() => handleDelete(selectedQuizForMenu._id)}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} />
          Delete Quiz
        </MenuItem>
      </Menu>

      {/* Quiz Form Dialog */}
      <Dialog
        open={showForm}
        onClose={() => setShowForm(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          {selectedQuiz ? 'Edit Quiz' : 'Create New Quiz'}
        </DialogTitle>
        <DialogContent>
          <QuizForm
            courseId={courseId}
            quiz={selectedQuiz}
            onSuccess={handleQuizSuccess}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Quiz Attempt Dialog */}
      <Dialog
        open={showAttempt}
        onClose={() => setShowAttempt(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          {selectedQuiz?.title}
        </DialogTitle>
        <DialogContent>
          <QuizAttempt
            quiz={selectedQuiz}
            onSuccess={handleAttemptSuccess}
            onCancel={() => setShowAttempt(false)}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default QuizList;
