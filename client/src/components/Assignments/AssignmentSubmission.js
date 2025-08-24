import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Chip,
  IconButton,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  CardActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Delete as DeleteIcon,
  AttachFile as AttachFileIcon,
  Download as DownloadIcon,
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
  Grade as GradeIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { format } from 'date-fns';

const AssignmentSubmission = ({ assignment, submission, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch
  } = useForm({
    defaultValues: {
      submissionText: submission?.submissionText || '',
      comment: ''
    }
  });

  const submissionText = watch('submissionText');

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    const newAttachments = files.map(file => ({
      file,
      originalName: file.name,
      size: file.size,
      id: Date.now() + Math.random()
    }));
    setAttachments([...attachments, ...newAttachments]);
  };

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const downloadAttachment = (attachment) => {
    const link = document.createElement('a');
    link.href = `/uploads/assignments/${attachment.filename}`;
    link.download = attachment.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('submissionText', data.submissionText);
      if (data.comment) {
        formData.append('comment', data.comment);
      }

      // Add attachments
      attachments.forEach(attachment => {
        formData.append('attachments', attachment.file);
      });

      const response = await axios.post(`/api/assignments/${assignment._id}/submit`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success('Assignment submitted successfully');
      onSuccess(response.data.submission);
    } catch (error) {
      console.error('Error submitting assignment:', error);
      toast.error(error.response?.data?.message || 'Error submitting assignment');
    } finally {
      setLoading(false);
    }
  };

  const isOverdue = new Date() > new Date(assignment.dueDate);
  const canSubmit = assignment.isPublished && (!isOverdue || assignment.allowLateSubmission);
  const hasSubmitted = submission !== null;

  const getStatusColor = () => {
    if (hasSubmitted) {
      if (submission.isGraded) return 'success';
      return 'info';
    }
    if (isOverdue) return 'error';
    return 'warning';
  };

  const getStatusText = () => {
    if (hasSubmitted) {
      if (submission.isGraded) return 'Graded';
      return 'Submitted';
    }
    if (isOverdue) return 'Overdue';
    return 'Due Soon';
  };

  return (
    <Box>
      {/* Assignment Details */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="h5" gutterBottom>
                {assignment.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {assignment.description}
              </Typography>
            </Box>
            <Chip
              label={getStatusText()}
              color={getStatusColor()}
              icon={hasSubmitted ? <CheckCircleIcon /> : <AssignmentIcon />}
            />
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <ScheduleIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="body2">
                  Due: {format(new Date(assignment.dueDate), 'PPP p')}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <GradeIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="body2">
                  Points: {assignment.totalPoints}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">
                Submission Type: {assignment.submissionType.charAt(0).toUpperCase() + assignment.submissionType.slice(1)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Max Submissions: {assignment.maxSubmissions}
              </Typography>
              {assignment.allowLateSubmission && (
                <Typography variant="body2" color="text.secondary">
                  Late Penalty: {assignment.latePenalty}%
                </Typography>
              )}
            </Grid>
          </Grid>

          {assignment.instructions && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Instructions:
              </Typography>
              <Typography variant="body2" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                {assignment.instructions}
              </Typography>
            </Box>
          )}

          {/* Assignment Attachments */}
          {assignment.attachments && assignment.attachments.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Assignment Files:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {assignment.attachments.map((attachment, index) => (
                  <Chip
                    key={index}
                    label={attachment.originalName}
                    onClick={() => downloadAttachment(attachment)}
                    icon={<DownloadIcon />}
                    variant="outlined"
                    clickable
                  />
                ))}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Submission Status */}
      {hasSubmitted && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            You have submitted this assignment on {format(new Date(submission.submittedAt), 'PPP p')}
            {submission.isLate && ' (Late submission)'}
          </Typography>
          {submission.isGraded && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                Grade: {submission.grade} ({submission.percentage}%)
              </Typography>
              {submission.feedback && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Feedback: {submission.feedback}
                </Typography>
              )}
            </Box>
          )}
        </Alert>
      )}

      {/* Submission Form */}
      {canSubmit && !hasSubmitted && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Submit Assignment
          </Typography>

          {isOverdue && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              This assignment is overdue. Late submissions are allowed with a penalty.
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            {/* Text Submission */}
            {(assignment.submissionType === 'text' || assignment.submissionType === 'both') && (
              <Box sx={{ mb: 3 }}>
                <Controller
                  name="submissionText"
                  control={control}
                  rules={{ 
                    required: assignment.submissionType === 'text' || assignment.submissionType === 'both' 
                      ? 'Text submission is required' 
                      : false 
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Your Submission"
                      fullWidth
                      multiline
                      rows={6}
                      error={!!errors.submissionText}
                      helperText={errors.submissionText?.message}
                      placeholder="Enter your assignment submission here..."
                    />
                  )}
                />
              </Box>
            )}

            {/* File Submission */}
            {(assignment.submissionType === 'file' || assignment.submissionType === 'both') && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Upload Files
                </Typography>
                <input
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.zip,.rar"
                  style={{ display: 'none' }}
                  id="submission-attachments"
                  multiple
                  type="file"
                  onChange={handleFileUpload}
                />
                <label htmlFor="submission-attachments">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<AttachFileIcon />}
                    sx={{ mb: 2 }}
                  >
                    Add Files
                  </Button>
                </label>

                {attachments.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    {attachments.map((attachment, index) => (
                      <Chip
                        key={attachment.id}
                        label={attachment.originalName}
                        onDelete={() => removeAttachment(index)}
                        deleteIcon={<DeleteIcon />}
                        sx={{ m: 0.5 }}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            )}

            {/* Comment */}
            <Box sx={{ mb: 3 }}>
              <Controller
                name="comment"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Additional Comments (Optional)"
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="Add any additional comments for your instructor..."
                  />
                )}
              />
            </Box>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={() => setShowPreview(true)}
                disabled={!submissionText && attachments.length === 0}
              >
                Preview
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : null}
              >
                {loading ? 'Submitting...' : 'Submit Assignment'}
              </Button>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Preview Dialog */}
      <Dialog
        open={showPreview}
        onClose={() => setShowPreview(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Submission Preview</DialogTitle>
        <DialogContent>
          <Typography variant="h6" gutterBottom>
            {assignment.title}
          </Typography>
          
          {submissionText && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Text Submission:
              </Typography>
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="body2" whiteSpace="pre-wrap">
                  {submissionText}
                </Typography>
              </Paper>
            </Box>
          )}

          {attachments.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Attachments:
              </Typography>
              <List dense>
                {attachments.map((attachment, index) => (
                  <ListItem key={attachment.id}>
                    <ListItemIcon>
                      <AttachFileIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={attachment.originalName}
                      secondary={`${(attachment.size / 1024 / 1024).toFixed(2)} MB`}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AssignmentSubmission;
