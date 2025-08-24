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
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Forum as ForumIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  School as SchoolIcon,
  Group as GroupIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import ForumCategoryForm from '../../components/Forums/ForumCategoryForm';

const Forums = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openCategoryForm, setOpenCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    fetchCategories();
    if (user.role === 'teacher' || user.role === 'admin') {
      fetchCourses();
    }
  }, [user.role]);

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`/api/forums/categories?role=${user.role}`);
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load forum categories');
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

  const handleCreateCategory = async (categoryData) => {
    try {
      await axios.post('/api/forums/categories', categoryData);
      toast.success('Category created successfully');
      setOpenCategoryForm(false);
      fetchCategories();
    } catch (error) {
      console.error('Error creating category:', error);
      toast.error(error.response?.data?.message || 'Failed to create category');
    }
  };

  const handleUpdateCategory = async (categoryData) => {
    try {
      await axios.put(`/api/forums/categories/${editingCategory._id}`, categoryData);
      toast.success('Category updated successfully');
      setOpenCategoryForm(false);
      setEditingCategory(null);
      fetchCategories();
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error(error.response?.data?.message || 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm('Are you sure you want to delete this category?')) {
      return;
    }

    try {
      await axios.delete(`/api/forums/categories/${categoryId}`);
      toast.success('Category deleted successfully');
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error(error.response?.data?.message || 'Failed to delete category');
    }
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setOpenCategoryForm(true);
  };

  const handleOpenCategoryForm = () => {
    setEditingCategory(null);
    setOpenCategoryForm(true);
  };

  const handleCloseCategoryForm = () => {
    setOpenCategoryForm(false);
    setEditingCategory(null);
  };

  const getCategoryIcon = (icon) => {
    const iconMap = {
      forum: <ForumIcon />,
      school: <SchoolIcon />,
      group: <GroupIcon />,
      trending: <TrendingUpIcon />,
      schedule: <ScheduleIcon />
    };
    return iconMap[icon] || <ForumIcon />;
  };

  const getRoleColor = (role) => {
    const colorMap = {
      student: 'primary',
      teacher: 'secondary',
      admin: 'error'
    };
    return colorMap[role] || 'default';
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Loading forums...
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          Discussion Forums
        </Typography>
        {(user.role === 'teacher' || user.role === 'admin') && (
          <Fab
            color="primary"
            aria-label="add category"
            onClick={handleOpenCategoryForm}
          >
            <AddIcon />
          </Fab>
        )}
      </Box>

      <Grid container spacing={3}>
        {categories.map((category) => (
          <Grid item xs={12} md={6} lg={4} key={category._id}>
            <Card 
              sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                cursor: 'pointer',
                '&:hover': {
                  boxShadow: 6,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.2s ease-in-out'
                }
              }}
              onClick={() => navigate(`/forums/category/${category.slug}`)}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Box display="flex" alignItems="center" mb={2}>
                  <Box
                    sx={{
                      backgroundColor: category.color,
                      borderRadius: '50%',
                      p: 1,
                      mr: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {getCategoryIcon(category.icon)}
                  </Box>
                  <Typography variant="h6" component="h2">
                    {category.name}
                  </Typography>
                </Box>

                <Typography variant="body2" color="text.secondary" mb={2}>
                  {category.description}
                </Typography>

                {category.course && (
                  <Chip
                    label={category.course.title}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ mb: 1 }}
                  />
                )}

                <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                  {category.allowedRoles.map((role) => (
                    <Chip
                      key={role}
                      label={role}
                      size="small"
                      color={getRoleColor(role)}
                      variant="outlined"
                    />
                  ))}
                </Box>

                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {category.statistics.topicsCount} topics
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {category.statistics.postsCount} posts
                    </Typography>
                  </Box>
                  {category.statistics.lastActivity && (
                    <Typography variant="caption" color="text.secondary">
                      {format(new Date(category.statistics.lastActivity), 'MMM dd, yyyy')}
                    </Typography>
                  )}
                </Box>
              </CardContent>

              {(user.role === 'teacher' || user.role === 'admin') && (
                <CardActions sx={{ justifyContent: 'flex-end', p: 1 }}>
                  <Tooltip title="Edit Category">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditCategory(category);
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  {user.role === 'admin' && (
                    <Tooltip title="Delete Category">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCategory(category._id);
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </CardActions>
              )}
            </Card>
          </Grid>
        ))}
      </Grid>

      {categories.length === 0 && (
        <Box textAlign="center" py={4}>
          <ForumIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No forum categories available
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {(user.role === 'teacher' || user.role === 'admin') 
              ? 'Create the first category to get started!'
              : 'Check back later for new discussion topics.'
            }
          </Typography>
        </Box>
      )}

      <Dialog
        open={openCategoryForm}
        onClose={handleCloseCategoryForm}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingCategory ? 'Edit Category' : 'Create New Category'}
        </DialogTitle>
        <DialogContent>
          <ForumCategoryForm
            category={editingCategory}
            courses={courses}
            onSubmit={editingCategory ? handleUpdateCategory : handleCreateCategory}
            onCancel={handleCloseCategoryForm}
          />
        </DialogContent>
      </Dialog>
    </Container>
  );
};

export default Forums;

