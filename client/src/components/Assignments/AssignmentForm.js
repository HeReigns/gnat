import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Chip,
  IconButton,
  Grid,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Delete as DeleteIcon, Add as AddIcon, AttachFile as AttachFileIcon } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import axios from 'axios';

const AssignmentForm = ({ courseId, assignment = null, onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [lessons, setLessons] = useState([]);
  const [attachments, setAttachments] = useState(assignment?.attachments || []);
  const [rubric, setRubric] = useState(assignment?.rubric || []);

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue
  } = useForm({
    defaultValues: {
      title: assignment?.title || '',
      description: assignment?.description || '',
      lessonId: assignment?.lesson || '',
      dueDate: assignment?.dueDate ? new Date(assignment.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      totalPoints: assignment?.totalPoints || 100,
      instructions: assignment?.instructions || '',
      submissionType: assignment?.submissionType || 'text',
      maxSubmissions: assignment?.maxSubmissions || 1,
      allowLateSubmission: assignment?.allowLateSubmission || false,
      latePenalty: assignment?.latePenalty || 0,
      isPublished: assignment?.isPublished || false
    }
  });

  const submissionType = watch('submissionType');
  const allowLateSubmission = watch('allowLateSubmission');

  useEffect(() => {
    fetchLessons();
  }, [courseId]);

  const fetchLessons = async () => {
    try {
      const response = await axios.get(`/api/lessons/course/${courseId}`);
      setLessons(response.data.lessons);
    } catch (error) {
      console.error('Error fetching lessons:', error);
    }
  };

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

  const addRubricItem = () => {
    setRubric([...rubric, { criterion: '', points: 0, description: '' }]);
  };

  const updateRubricItem = (index, field, value) => {
    const updatedRubric = [...rubric];
    updatedRubric[index][field] = value;
    setRubric(updatedRubric);
  };

  const removeRubricItem = (index) => {
    setRubric(rubric.filter((_, i) => i !== index));
  };

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const formData = new FormData();
      
      // Add form fields
      Object.keys(data).forEach(key => {
        if (key === 'dueDate') {
          formData.append(key, data[key].toISOString());
        } else {
          formData.append(key, data[key]);
        }
      });

      // Add attachments
      attachments.forEach(attachment => {
        if (attachment.file) {
          formData.append('attachments', attachment.file);
        }
      });

      // Add rubric
      formData.append('rubric', JSON.stringify(rubric));

      let response;
      if (assignment) {
        response = await axios.put(`/api/assignments/${assignment._id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Assignment updated successfully');
      } else {
        formData.append('courseId', courseId);
        response = await axios.post('/api/assignments', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Assignment created successfully');
      }

      onSuccess(response.data.assignment);
    } catch (error) {
      console.error('Error saving assignment:', error);
      toast.error(error.response?.data?.message || 'Error saving assignment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Paper sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
        <Typography variant="h5" gutterBottom>
          {assignment ? 'Edit Assignment' : 'Create New Assignment'}
        </Typography>

        <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 2 }}>
          <Grid container spacing={3}>
            {/* Basic Information */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="title"
                control={control}
                rules={{ required: 'Title is required' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Assignment Title"
                    fullWidth
                    error={!!errors.title}
                    helperText={errors.title?.message}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="description"
                control={control}
                rules={{ required: 'Description is required' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Description"
                    fullWidth
                    multiline
                    rows={4}
                    error={!!errors.description}
                    helperText={errors.description?.message}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="lessonId"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Related Lesson (Optional)</InputLabel>
                    <Select {...field} label="Related Lesson (Optional)">
                      <MenuItem value="">
                        <em>No specific lesson</em>
                      </MenuItem>
                      {lessons.map((lesson) => (
                        <MenuItem key={lesson._id} value={lesson._id}>
                          {lesson.title}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="totalPoints"
                control={control}
                rules={{ required: 'Total points is required', min: { value: 1, message: 'Must be at least 1' } }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Total Points"
                    type="number"
                    fullWidth
                    error={!!errors.totalPoints}
                    helperText={errors.totalPoints?.message}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="dueDate"
                control={control}
                rules={{ required: 'Due date is required' }}
                render={({ field }) => (
                  <DateTimePicker
                    {...field}
                    label="Due Date"
                    renderInput={(params) => (
                      <TextField {...params} fullWidth error={!!errors.dueDate} helperText={errors.dueDate?.message} />
                    )}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="instructions"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Instructions for Students"
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="Provide clear instructions for students..."
                  />
                )}
              />
            </Grid>

            {/* Submission Settings */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Submission Settings
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="submissionType"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Submission Type</InputLabel>
                    <Select {...field} label="Submission Type">
                      <MenuItem value="text">Text Only</MenuItem>
                      <MenuItem value="file">File Only</MenuItem>
                      <MenuItem value="both">Text and File</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="maxSubmissions"
                control={control}
                rules={{ required: 'Max submissions is required', min: { value: 1, message: 'Must be at least 1' } }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Maximum Submissions"
                    type="number"
                    fullWidth
                    error={!!errors.maxSubmissions}
                    helperText={errors.maxSubmissions?.message}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="allowLateSubmission"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} />}
                    label="Allow Late Submissions"
                  />
                )}
              />
            </Grid>

            {allowLateSubmission && (
              <Grid item xs={12} md={6}>
                <Controller
                  name="latePenalty"
                  control={control}
                  rules={{ min: { value: 0, message: 'Must be 0 or greater' } }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Late Penalty (%)"
                      type="number"
                      fullWidth
                      error={!!errors.latePenalty}
                      helperText={errors.latePenalty?.message || 'Percentage penalty per day late'}
                    />
                  )}
                />
              </Grid>
            )}

            {/* Attachments */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Assignment Attachments
              </Typography>
              <input
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.zip,.rar"
                style={{ display: 'none' }}
                id="assignment-attachments"
                multiple
                type="file"
                onChange={handleFileUpload}
              />
              <label htmlFor="assignment-attachments">
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
                      key={attachment.id || index}
                      label={attachment.originalName}
                      onDelete={() => removeAttachment(index)}
                      deleteIcon={<DeleteIcon />}
                      sx={{ m: 0.5 }}
                    />
                  ))}
                </Box>
              )}
            </Grid>

            {/* Rubric */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Grading Rubric</Typography>
                <Button
                  startIcon={<AddIcon />}
                  onClick={addRubricItem}
                  variant="outlined"
                  size="small"
                >
                  Add Criterion
                </Button>
              </Box>

              {rubric.map((item, index) => (
                <Box key={index} sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={4}>
                      <TextField
                        label="Criterion"
                        value={item.criterion}
                        onChange={(e) => updateRubricItem(index, 'criterion', e.target.value)}
                        fullWidth
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        label="Points"
                        type="number"
                        value={item.points}
                        onChange={(e) => updateRubricItem(index, 'points', parseInt(e.target.value) || 0)}
                        fullWidth
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} md={5}>
                      <TextField
                        label="Description"
                        value={item.description}
                        onChange={(e) => updateRubricItem(index, 'description', e.target.value)}
                        fullWidth
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} md={1}>
                      <IconButton
                        onClick={() => removeRubricItem(index)}
                        color="error"
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Grid>
                  </Grid>
                </Box>
              ))}
            </Grid>

            {/* Publish Settings */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Controller
                name="isPublished"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} />}
                    label="Publish Assignment Immediately"
                  />
                )}
              />
            </Grid>

            {/* Action Buttons */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={onCancel}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : null}
                >
                  {loading ? 'Saving...' : (assignment ? 'Update Assignment' : 'Create Assignment')}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </LocalizationProvider>
  );
};

export default AssignmentForm;
