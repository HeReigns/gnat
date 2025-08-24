import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  FormHelperText,
  Button,
  Grid,
  FormControlLabel,
  Switch,
  Typography,
  Divider
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'react-hot-toast';

const ForumCategoryForm = ({ category, courses, onSubmit, onCancel }) => {
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedModerators, setSelectedModerators] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);

  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm({
    defaultValues: {
      name: category?.name || '',
      description: category?.description || '',
      icon: category?.icon || 'forum',
      color: category?.color || '#1976d2',
      order: category?.order || 0,
      isPublic: category?.isPublic ?? true,
      course: category?.course?._id || '',
      allowedRoles: category?.allowedRoles || ['student', 'teacher', 'admin'],
      moderators: category?.moderators || []
    }
  });

  const watchedCourse = watch('course');

  useEffect(() => {
    if (category) {
      setSelectedRoles(category.allowedRoles || []);
      setSelectedModerators(category.moderators || []);
    }
  }, [category]);

  useEffect(() => {
    if (watchedCourse) {
      fetchCourseUsers(watchedCourse);
    }
  }, [watchedCourse]);

  const fetchCourseUsers = async (courseId) => {
    try {
      const response = await fetch(`/api/courses/${courseId}/users`);
      const data = await response.json();
      setAvailableUsers(data);
    } catch (error) {
      console.error('Error fetching course users:', error);
    }
  };

  const handleFormSubmit = (data) => {
    const formData = {
      ...data,
      allowedRoles: selectedRoles,
      moderators: selectedModerators
    };
    onSubmit(formData);
  };

  const handleRoleToggle = (role) => {
    setSelectedRoles(prev => 
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleModeratorToggle = (userId) => {
    setSelectedModerators(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const iconOptions = [
    { value: 'forum', label: 'Forum' },
    { value: 'school', label: 'School' },
    { value: 'group', label: 'Group' },
    { value: 'trending', label: 'Trending' },
    { value: 'schedule', label: 'Schedule' }
  ];

  const roleOptions = [
    { value: 'student', label: 'Student' },
    { value: 'teacher', label: 'Teacher' },
    { value: 'admin', label: 'Admin' }
  ];

  return (
    <Box component="form" onSubmit={handleSubmit(handleFormSubmit)} sx={{ mt: 2 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Controller
            name="name"
            control={control}
            rules={{ 
              required: 'Category name is required',
              minLength: { value: 3, message: 'Name must be at least 3 characters' },
              maxLength: { value: 100, message: 'Name cannot exceed 100 characters' }
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Category Name"
                fullWidth
                error={!!errors.name}
                helperText={errors.name?.message}
              />
            )}
          />
        </Grid>

        <Grid item xs={12}>
          <Controller
            name="description"
            control={control}
            rules={{ 
              required: 'Description is required',
              minLength: { value: 10, message: 'Description must be at least 10 characters' },
              maxLength: { value: 500, message: 'Description cannot exceed 500 characters' }
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Description"
                fullWidth
                multiline
                rows={3}
                error={!!errors.description}
                helperText={errors.description?.message}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <Controller
            name="icon"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel>Icon</InputLabel>
                <Select {...field} label="Icon">
                  {iconOptions.map((option) => (
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
            name="color"
            control={control}
            rules={{ 
              pattern: { 
                value: /^#[0-9A-F]{6}$/i, 
                message: 'Please enter a valid hex color (e.g., #1976d2)' 
              }
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Color"
                fullWidth
                placeholder="#1976d2"
                error={!!errors.color}
                helperText={errors.color?.message}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <Controller
            name="order"
            control={control}
            rules={{ min: { value: 0, message: 'Order must be 0 or greater' } }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Display Order"
                type="number"
                fullWidth
                error={!!errors.order}
                helperText={errors.order?.message}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <Controller
            name="course"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel>Course (Optional)</InputLabel>
                <Select {...field} label="Course (Optional)">
                  <MenuItem value="">No specific course</MenuItem>
                  {courses.map((course) => (
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
          <FormControlLabel
            control={
              <Controller
                name="isPublic"
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            }
            label="Public Category"
          />
        </Grid>

        <Grid item xs={12}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>
            Allowed Roles
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            {roleOptions.map((role) => (
              <Chip
                key={role.value}
                label={role.label}
                onClick={() => handleRoleToggle(role.value)}
                color={selectedRoles.includes(role.value) ? 'primary' : 'default'}
                variant={selectedRoles.includes(role.value) ? 'filled' : 'outlined'}
                clickable
              />
            ))}
          </Box>
          {selectedRoles.length === 0 && (
            <FormHelperText error>
              At least one role must be selected
            </FormHelperText>
          )}
        </Grid>

        {watchedCourse && (
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Moderators
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              {availableUsers.map((user) => (
                <Chip
                  key={user._id}
                  label={`${user.firstName} ${user.lastName}`}
                  onClick={() => handleModeratorToggle(user._id)}
                  color={selectedModerators.includes(user._id) ? 'secondary' : 'default'}
                  variant={selectedModerators.includes(user._id) ? 'filled' : 'outlined'}
                  clickable
                />
              ))}
            </Box>
            {availableUsers.length === 0 && (
              <FormHelperText>
                No users available for this course
              </FormHelperText>
            )}
          </Grid>
        )}

        <Grid item xs={12}>
          <Box display="flex" gap={2} justifyContent="flex-end">
            <Button variant="outlined" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="contained"
              disabled={selectedRoles.length === 0}
            >
              {category ? 'Update Category' : 'Create Category'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ForumCategoryForm;

