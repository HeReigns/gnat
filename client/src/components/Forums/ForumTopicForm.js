import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Button,
  Grid,
  Typography,
  Divider,
  FormControlLabel,
  Switch,
  Autocomplete
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'react-hot-toast';

const ForumTopicForm = ({ topic, category, courses, onSubmit, onCancel }) => {
  const [tags, setTags] = useState([]);
  const [inputTag, setInputTag] = useState('');

  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm({
    defaultValues: {
      title: topic?.title || '',
      content: topic?.content || '',
      type: topic?.type || 'discussion',
      course: topic?.course?._id || '',
      tags: topic?.tags || [],
      isSticky: topic?.isSticky || false,
      isLocked: topic?.isLocked || false
    }
  });

  const watchedType = watch('type');

  useEffect(() => {
    if (topic) {
      setTags(topic.tags || []);
    }
  }, [topic]);

  const handleFormSubmit = (data) => {
    const formData = {
      ...data,
      tags: tags
    };
    onSubmit(formData);
  };

  const handleAddTag = (event) => {
    event.preventDefault();
    if (inputTag.trim() && !tags.includes(inputTag.trim())) {
      setTags([...tags, inputTag.trim()]);
      setInputTag('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddTag(event);
    }
  };

  const typeOptions = [
    { value: 'discussion', label: 'Discussion' },
    { value: 'question', label: 'Question' },
    { value: 'announcement', label: 'Announcement' },
    { value: 'poll', label: 'Poll' }
  ];

  const availableCourses = courses.filter(course => {
    // Filter courses based on user's role and enrollment
    return true; // You can add more filtering logic here
  });

  return (
    <Box component="form" onSubmit={handleSubmit(handleFormSubmit)} sx={{ mt: 2 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Controller
            name="title"
            control={control}
            rules={{ 
              required: 'Topic title is required',
              minLength: { value: 5, message: 'Title must be at least 5 characters' },
              maxLength: { value: 200, message: 'Title cannot exceed 200 characters' }
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Topic Title"
                fullWidth
                error={!!errors.title}
                helperText={errors.title?.message}
              />
            )}
          />
        </Grid>

        <Grid item xs={12}>
          <Controller
            name="content"
            control={control}
            rules={{ 
              required: 'Content is required',
              minLength: { value: 10, message: 'Content must be at least 10 characters' }
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Content"
                fullWidth
                multiline
                rows={8}
                error={!!errors.content}
                helperText={errors.content?.message}
                placeholder="Share your thoughts, ask questions, or start a discussion..."
              />
            )}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel>Topic Type</InputLabel>
                <Select {...field} label="Topic Type">
                  {typeOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <Controller
            name="course"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel>Related Course (Optional)</InputLabel>
                <Select {...field} label="Related Course (Optional)">
                  <MenuItem value="">No specific course</MenuItem>
                  {availableCourses.map((course) => (
                    <MenuItem key={course._id} value={course._id}>
                      {course.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
        </Grid>

        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Tags
          </Typography>
          <Box display="flex" gap={1} mb={2} flexWrap="wrap">
            {tags.map((tag, index) => (
              <Chip
                key={index}
                label={tag}
                onDelete={() => handleRemoveTag(tag)}
                color="primary"
                variant="outlined"
              />
            ))}
          </Box>
          <Box display="flex" gap={1}>
            <TextField
              value={inputTag}
              onChange={(e) => setInputTag(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Add a tag..."
              size="small"
              sx={{ flexGrow: 1 }}
            />
            <Button
              variant="outlined"
              onClick={handleAddTag}
              disabled={!inputTag.trim() || tags.includes(inputTag.trim())}
            >
              Add
            </Button>
          </Box>
        </Grid>

        {(category?.moderators?.includes(user?.id) || user?.role === 'admin') && (
          <>
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Moderation Options
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Controller
                    name="isSticky"
                    control={control}
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                }
                label="Sticky Topic"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Controller
                    name="isLocked"
                    control={control}
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                }
                label="Lock Topic"
              />
            </Grid>
          </>
        )}

        <Grid item xs={12}>
          <Box display="flex" gap={2} justifyContent="flex-end">
            <Button variant="outlined" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="contained">
              {topic ? 'Update Topic' : 'Create Topic'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ForumTopicForm;

