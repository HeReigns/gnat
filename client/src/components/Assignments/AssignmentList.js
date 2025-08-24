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
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
  Grade as GradeIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  FilterList as FilterListIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { format } from 'date-fns';
import AssignmentForm from './AssignmentForm';
import AssignmentSubmission from './AssignmentSubmission';
import GradingForm from './GradingForm';

const AssignmentList = ({ courseId }) => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showSubmission, setShowSubmission] = useState(false);
  const [showGrading, setShowGrading] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedAssignmentForMenu, setSelectedAssignmentForMenu] = useState(null);

  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';

  useEffect(() => {
    fetchAssignments();
  }, [courseId, page, statusFilter, searchTerm]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page,
        limit: 10,
        ...(statusFilter && { status: statusFilter }),
        ...(searchTerm && { search: searchTerm })
      });

      const response = await axios.get(`/api/assignments/course/${courseId}?${params}`);
      setAssignments(response.data.assignments);
      setTotalPages(response.data.pagination.pages);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      setError('Failed to load assignments');
      toast.error('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (assignmentId) => {
    if (!window.confirm('Are you sure you want to delete this assignment?')) {
      return;
    }

    try {
      await axios.delete(`/api/assignments/${assignmentId}`);
      toast.success('Assignment deleted successfully');
      fetchAssignments();
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast.error(error.response?.data?.message || 'Error deleting assignment');
    }
  };

  const handleMenuOpen = (event, assignment) => {
    setAnchorEl(event.currentTarget);
    setSelectedAssignmentForMenu(assignment);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedAssignmentForMenu(null);
  };

  const handleEdit = (assignment) => {
    setSelectedAssignment(assignment);
    setShowForm(true);
    handleMenuClose();
  };

  const handleViewSubmissions = async (assignment) => {
    try {
      const response = await axios.get(`/api/assignments/${assignment._id}/submissions`);
      if (response.data.submissions.length > 0) {
        setSelectedSubmission(response.data.submissions[0]);
        setSelectedAssignment(assignment);
        setShowGrading(true);
      } else {
        toast.info('No submissions found for this assignment');
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
      toast.error('Error fetching submissions');
    }
    handleMenuClose();
  };

  const handleAssignmentSuccess = () => {
    setShowForm(false);
    setSelectedAssignment(null);
    fetchAssignments();
  };

  const handleSubmissionSuccess = () => {
    setShowSubmission(false);
    fetchAssignments();
  };

  const handleGradingSuccess = () => {
    setShowGrading(false);
    setSelectedSubmission(null);
    setSelectedAssignment(null);
    fetchAssignments();
  };

  const getStatusColor = (assignment) => {
    const now = new Date();
    const dueDate = new Date(assignment.dueDate);
    
    if (!assignment.isPublished) return 'default';
    if (now > dueDate) return 'error';
    return 'success';
  };

  const getStatusText = (assignment) => {
    const now = new Date();
    const dueDate = new Date(assignment.dueDate);
    
    if (!assignment.isPublished) return 'Draft';
    if (now > dueDate) return 'Overdue';
    return 'Active';
  };

  const isOverdue = (assignment) => {
    return new Date() > new Date(assignment.dueDate);
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
          Assignments ({assignments.length})
        </Typography>
        
        {isTeacher && (
          <Fab
            color="primary"
            aria-label="add assignment"
            onClick={() => setShowForm(true)}
          >
            <AddIcon />
          </Fab>
        )}
      </Box>

      {/* Filters */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          label="Search assignments"
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
            <MenuItem value="overdue">Overdue</MenuItem>
            {isTeacher && <MenuItem value="draft">Draft</MenuItem>}
          </Select>
        </FormControl>
      </Box>

      {/* Assignments Grid */}
      <Grid container spacing={3}>
        {assignments.map((assignment) => (
          <Grid item xs={12} md={6} key={assignment._id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" gutterBottom>
                      {assignment.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {assignment.description}
                    </Typography>
                  </Box>
                  
                  {isTeacher && (
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, assignment)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  )}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Chip
                    label={getStatusText(assignment)}
                    color={getStatusColor(assignment)}
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  <Chip
                    label={`${assignment.totalPoints} pts`}
                    variant="outlined"
                    size="small"
                  />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <ScheduleIcon sx={{ mr: 1, fontSize: 'small', color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    Due: {format(new Date(assignment.dueDate), 'PPP p')}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <AssignmentIcon sx={{ mr: 1, fontSize: 'small', color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    {assignment.submissionType.charAt(0).toUpperCase() + assignment.submissionType.slice(1)} submission
                  </Typography>
                </Box>

                {isOverdue(assignment) && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    This assignment is overdue
                  </Alert>
                )}

                {/* Action Buttons */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {isStudent && assignment.isPublished && (
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => {
                        setSelectedAssignment(assignment);
                        setShowSubmission(true);
                      }}
                    >
                      {assignment.submission ? 'View Submission' : 'Submit Assignment'}
                    </Button>
                  )}
                  
                  {isTeacher && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleViewSubmissions(assignment)}
                    >
                      View Submissions
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

      {/* Assignment Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleEdit(selectedAssignmentForMenu)}>
          <EditIcon sx={{ mr: 1 }} />
          Edit Assignment
        </MenuItem>
        <MenuItem onClick={() => handleViewSubmissions(selectedAssignmentForMenu)}>
          <GradeIcon sx={{ mr: 1 }} />
          View Submissions
        </MenuItem>
        <MenuItem 
          onClick={() => handleDelete(selectedAssignmentForMenu._id)}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} />
          Delete Assignment
        </MenuItem>
      </Menu>

      {/* Assignment Form Dialog */}
      <Dialog
        open={showForm}
        onClose={() => setShowForm(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedAssignment ? 'Edit Assignment' : 'Create New Assignment'}
        </DialogTitle>
        <DialogContent>
          <AssignmentForm
            courseId={courseId}
            assignment={selectedAssignment}
            onSuccess={handleAssignmentSuccess}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Assignment Submission Dialog */}
      <Dialog
        open={showSubmission}
        onClose={() => setShowSubmission(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedAssignment?.title}
        </DialogTitle>
        <DialogContent>
          <AssignmentSubmission
            assignment={selectedAssignment}
            submission={selectedAssignment?.submission}
            onSuccess={handleSubmissionSuccess}
          />
        </DialogContent>
      </Dialog>

      {/* Grading Dialog */}
      <Dialog
        open={showGrading}
        onClose={() => setShowGrading(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Grade Submission - {selectedAssignment?.title}
        </DialogTitle>
        <DialogContent>
          <GradingForm
            submission={selectedSubmission}
            assignment={selectedAssignment}
            onSuccess={handleGradingSuccess}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default AssignmentList;
