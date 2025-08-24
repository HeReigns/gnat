import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  AttachFile as AttachFileIcon,
  Download as DownloadIcon,
  Grade as GradeIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { format } from 'date-fns';

const GradingForm = ({ submission, assignment, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [expandedRubric, setExpandedRubric] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue
  } = useForm({
    defaultValues: {
      score: submission?.score || 0,
      feedback: submission?.feedback || '',
      rubricScores: submission?.rubricScores || assignment?.rubric?.map(item => ({
        criterion: item.criterion,
        points: 0,
        maxPoints: item.points,
        feedback: ''
      })) || []
    }
  });

  const score = watch('score');
  const rubricScores = watch('rubricScores');

  const downloadAttachment = (attachment) => {
    const link = document.createElement('a');
    link.href = `/uploads/assignments/${attachment.filename}`;
    link.download = attachment.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateRubricScore = (index, field, value) => {
    const updatedScores = [...rubricScores];
    updatedScores[index][field] = value;
    setValue('rubricScores', updatedScores);
  };

  const calculateTotalRubricScore = () => {
    return rubricScores.reduce((total, item) => total + (item.points || 0), 0);
  };

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const response = await axios.post(`/api/assignments/submissions/${submission._id}/grade`, {
        score: data.score,
        feedback: data.feedback,
        rubricScores: data.rubricScores
      });

      toast.success('Submission graded successfully');
      onSuccess(response.data.submission);
    } catch (error) {
      console.error('Error grading submission:', error);
      toast.error(error.response?.data?.message || 'Error grading submission');
    } finally {
      setLoading(false);
    }
  };

  const isLate = submission.isLate;
  const finalScore = isLate ? Math.max(0, score - (score * submission.latePenalty / 100)) : score;
  const finalPercentage = assignment ? (finalScore / assignment.totalPoints) * 100 : 0;

  const getGrade = (percentage) => {
    if (percentage >= 97) return 'A+';
    if (percentage >= 93) return 'A';
    if (percentage >= 90) return 'A-';
    if (percentage >= 87) return 'B+';
    if (percentage >= 83) return 'B';
    if (percentage >= 80) return 'B-';
    if (percentage >= 77) return 'C+';
    if (percentage >= 73) return 'C';
    if (percentage >= 70) return 'C-';
    if (percentage >= 67) return 'D+';
    if (percentage >= 63) return 'D';
    if (percentage >= 60) return 'D-';
    return 'F';
  };

  return (
    <Box>
      {/* Student Information */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Student Submission
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {submission.student.firstName} {submission.student.lastName} ({submission.student.email})
              </Typography>
            </Box>
            <Chip
              label={isLate ? 'Late Submission' : 'On Time'}
              color={isLate ? 'error' : 'success'}
              icon={isLate ? <WarningIcon /> : <CheckCircleIcon />}
            />
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <ScheduleIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="body2">
                  Submitted: {format(new Date(submission.submittedAt), 'PPP p')}
                </Typography>
              </Box>
              {isLate && (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <WarningIcon sx={{ mr: 1, color: 'error.main' }} />
                  <Typography variant="body2" color="error">
                    Late Penalty: {submission.latePenalty}%
                  </Typography>
                </Box>
              )}
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">
                Attempt: {submission.attemptNumber}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Assignment: {assignment.title}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Submission Content */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Submission Content
        </Typography>

        {/* Text Submission */}
        {submission.submissionText && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Text Submission:
            </Typography>
            <Paper sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="body2" whiteSpace="pre-wrap">
                {submission.submissionText}
              </Typography>
            </Paper>
          </Box>
        )}

        {/* File Attachments */}
        {submission.attachments && submission.attachments.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Submitted Files:
            </Typography>
            <List dense>
              {submission.attachments.map((attachment, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <AttachFileIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={attachment.originalName}
                    secondary={`${(attachment.size / 1024 / 1024).toFixed(2)} MB`}
                  />
                  <Button
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={() => downloadAttachment(attachment)}
                  >
                    Download
                  </Button>
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Comments */}
        {submission.comments && submission.comments.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Student Comments:
            </Typography>
            {submission.comments.map((comment, index) => (
              <Paper key={index} sx={{ p: 2, mb: 1, bgcolor: 'grey.50' }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {comment.text}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {format(new Date(comment.createdAt), 'PPP p')}
                </Typography>
              </Paper>
            ))}
          </Box>
        )}
      </Paper>

      {/* Grading Form */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Grade Submission
        </Typography>

        <Box component="form" onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={3}>
            {/* Score Input */}
            <Grid item xs={12} md={6}>
              <Controller
                name="score"
                control={control}
                rules={{ 
                  required: 'Score is required',
                  min: { value: 0, message: 'Score cannot be negative' },
                  max: { value: assignment.totalPoints, message: `Score cannot exceed ${assignment.totalPoints}` }
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Score"
                    type="number"
                    fullWidth
                    error={!!errors.score}
                    helperText={errors.score?.message}
                    inputProps={{ min: 0, max: assignment.totalPoints }}
                  />
                )}
              />
            </Grid>

            {/* Score Display */}
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" gutterBottom>
                  Final Score: {finalScore.toFixed(1)} / {assignment.totalPoints}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  Percentage: {finalPercentage.toFixed(1)}%
                </Typography>
                <Typography variant="body2">
                  Grade: {getGrade(finalPercentage)}
                </Typography>
                {isLate && (
                  <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                    Late penalty applied: -{submission.latePenalty}%
                  </Typography>
                )}
              </Box>
            </Grid>

            {/* Rubric Grading */}
            {assignment.rubric && assignment.rubric.length > 0 && (
              <Grid item xs={12}>
                <Accordion 
                  expanded={expandedRubric} 
                  onChange={() => setExpandedRubric(!expandedRubric)}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle1">
                      Rubric Grading (Optional)
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Total Rubric Score: {calculateTotalRubricScore()} / {assignment.rubric.reduce((sum, item) => sum + item.points, 0)}
                      </Typography>
                    </Box>
                    
                    {assignment.rubric.map((criterion, index) => (
                      <Box key={index} sx={{ mb: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          {criterion.criterion} (Max: {criterion.points} points)
                        </Typography>
                        {criterion.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {criterion.description}
                          </Typography>
                        )}
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={6}>
                            <TextField
                              label="Points Awarded"
                              type="number"
                              value={rubricScores[index]?.points || 0}
                              onChange={(e) => updateRubricScore(index, 'points', parseInt(e.target.value) || 0)}
                              fullWidth
                              inputProps={{ min: 0, max: criterion.points }}
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <TextField
                              label="Feedback (Optional)"
                              value={rubricScores[index]?.feedback || ''}
                              onChange={(e) => updateRubricScore(index, 'feedback', e.target.value)}
                              fullWidth
                              multiline
                              rows={2}
                            />
                          </Grid>
                        </Grid>
                      </Box>
                    ))}
                  </AccordionDetails>
                </Accordion>
              </Grid>
            )}

            {/* Feedback */}
            <Grid item xs={12}>
              <Controller
                name="feedback"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Feedback for Student"
                    fullWidth
                    multiline
                    rows={4}
                    placeholder="Provide constructive feedback for the student..."
                  />
                )}
              />
            </Grid>

            {/* Action Buttons */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <GradeIcon />}
                >
                  {loading ? 'Grading...' : 'Grade Submission'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Box>
  );
};

export default GradingForm;
