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
  Avatar,
  IconButton,
  Tooltip,
  Breadcrumbs,
  Link,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Collapse
} from '@mui/material';
import {
  Reply as ReplyIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  Flag as FlagIcon,
  CheckCircle as CheckCircleIcon,
  Pin as PinIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  Comment as CommentIcon,
  Schedule as ScheduleIcon,
  MoreVert as MoreVertIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { format } from 'date-fns';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';

const ForumTopic = () => {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [topic, setTopic] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [openReplyDialog, setOpenReplyDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openReportDialog, setOpenReportDialog] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [editContent, setEditContent] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [showReplies, setShowReplies] = useState({});

  useEffect(() => {
    fetchTopic();
  }, [slug]);

  useEffect(() => {
    if (topic) {
      fetchPosts();
    }
  }, [topic, currentPage]);

  const fetchTopic = async () => {
    try {
      const response = await axios.get(`/api/forums/topics/${slug}`);
      setTopic(response.data);
    } catch (error) {
      console.error('Error fetching topic:', error);
      toast.error('Failed to load topic');
      navigate('/forums');
    }
  };

  const fetchPosts = async () => {
    try {
      const response = await axios.get(`/api/forums/topics/${topic._id}/posts`, {
        params: {
          page: currentPage,
          limit: 20
        }
      });
      setPosts(response.data.posts);
      setTotalPages(response.data.pagination.pages);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReply = async () => {
    if (!replyContent.trim()) {
      toast.error('Reply content is required');
      return;
    }

    try {
      const postData = {
        content: replyContent,
        topic: topic._id,
        parentPost: selectedPost?._id || null
      };

      await axios.post('/api/forums/posts', postData);
      toast.success('Reply posted successfully');
      setOpenReplyDialog(false);
      setReplyContent('');
      setSelectedPost(null);
      fetchPosts();
    } catch (error) {
      console.error('Error creating reply:', error);
      toast.error(error.response?.data?.message || 'Failed to post reply');
    }
  };

  const handleEditPost = async () => {
    if (!editContent.trim()) {
      toast.error('Post content is required');
      return;
    }

    try {
      await axios.put(`/api/forums/posts/${selectedPost._id}`, {
        content: editContent
      });
      toast.success('Post updated successfully');
      setOpenEditDialog(false);
      setEditContent('');
      setSelectedPost(null);
      fetchPosts();
    } catch (error) {
      console.error('Error updating post:', error);
      toast.error(error.response?.data?.message || 'Failed to update post');
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) {
      return;
    }

    try {
      await axios.delete(`/api/forums/posts/${postId}`);
      toast.success('Post deleted successfully');
      fetchPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error(error.response?.data?.message || 'Failed to delete post');
    }
  };

  const handleToggleLike = async (postId) => {
    try {
      await axios.post(`/api/forums/posts/${postId}/like`);
      fetchPosts();
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to like post');
    }
  };

  const handleToggleDislike = async (postId) => {
    try {
      await axios.post(`/api/forums/posts/${postId}/dislike`);
      fetchPosts();
    } catch (error) {
      console.error('Error toggling dislike:', error);
      toast.error('Failed to dislike post');
    }
  };

  const handleReportPost = async () => {
    if (!reportReason) {
      toast.error('Please select a reason for reporting');
      return;
    }

    try {
      await axios.post(`/api/forums/posts/${selectedPost._id}/report`, {
        reason: reportReason,
        description: reportDescription
      });
      toast.success('Post reported successfully');
      setOpenReportDialog(false);
      setReportReason('');
      setReportDescription('');
      setSelectedPost(null);
    } catch (error) {
      console.error('Error reporting post:', error);
      toast.error(error.response?.data?.message || 'Failed to report post');
    }
  };

  const handleMarkAsSolution = async (postId) => {
    try {
      await axios.post(`/api/forums/posts/${postId}/solution`);
      toast.success('Post marked as solution');
      fetchPosts();
    } catch (error) {
      console.error('Error marking solution:', error);
      toast.error('Failed to mark as solution');
    }
  };

  const handleOpenReplyDialog = (post = null) => {
    setSelectedPost(post);
    setOpenReplyDialog(true);
  };

  const handleOpenEditDialog = (post) => {
    setSelectedPost(post);
    setEditContent(post.content);
    setOpenEditDialog(true);
  };

  const handleOpenReportDialog = (post) => {
    setSelectedPost(post);
    setOpenReportDialog(true);
  };

  const handlePageChange = (event, page) => {
    setCurrentPage(page);
  };

  const toggleReplies = (postId) => {
    setShowReplies(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };

  const canEditPost = (post) => {
    return user && (user.role === 'admin' || post.author._id === user.id);
  };

  const canDeletePost = (post) => {
    return user && (user.role === 'admin' || post.author._id === user.id);
  };

  const canMarkSolution = (post) => {
    return user && (user.role === 'admin' || topic.author._id === user.id);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Loading topic...
        </Typography>
      </Container>
    );
  }

  if (!topic) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Topic not found
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
        <Link component={RouterLink} to={`/forums/category/${topic.category.slug}`} color="inherit">
          {topic.category.name}
        </Link>
        <Typography color="text.primary">{topic.title}</Typography>
      </Breadcrumbs>

      {/* Topic Header */}
      <Card sx={{ mb: 3 }}>
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
                {topic.isSticky && <PinIcon color="warning" fontSize="small" />}
                {topic.isLocked && <LockIcon color="error" fontSize="small" />}
                <Typography variant="h5" component="h1">
                  {topic.title}
                </Typography>
              </Box>
              
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Typography variant="body2" color="text.secondary">
                  by {topic.author.firstName} {topic.author.lastName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {format(new Date(topic.createdAt), 'MMM dd, yyyy HH:mm')}
                </Typography>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <VisibilityIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {topic.statistics.views} views
                  </Typography>
                </Box>
              </Box>

              {topic.tags && topic.tags.length > 0 && (
                <Box display="flex" gap={1} mb={2} flexWrap="wrap">
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

              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {topic.content}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Posts */}
      <Box mb={3}>
        <Typography variant="h6" gutterBottom>
          Replies ({topic.statistics.replies})
        </Typography>
      </Box>

      {posts.map((post) => (
        <Card key={post._id} sx={{ mb: 2, ml: post.parentPost ? 4 : 0 }}>
          <CardContent>
            <Box display="flex" alignItems="flex-start" gap={2}>
              <Avatar sx={{ bgcolor: 'secondary.main', mt: 0.5 }}>
                {post.author.avatar ? (
                  <img src={post.author.avatar} alt="avatar" />
                ) : (
                  post.author.firstName?.charAt(0) || 'U'
                )}
              </Avatar>
              
              <Box flexGrow={1}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  {post.isSolution && (
                    <CheckCircleIcon color="success" fontSize="small" />
                  )}
                  <Typography variant="subtitle1" fontWeight="bold">
                    {post.author.firstName} {post.author.lastName}
                  </Typography>
                  <Chip
                    label={post.author.role}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  <Typography variant="body2" color="text.secondary">
                    {format(new Date(post.createdAt), 'MMM dd, yyyy HH:mm')}
                  </Typography>
                  {post.isEdited && (
                    <Typography variant="caption" color="text.secondary">
                      (edited)
                    </Typography>
                  )}
                </Box>

                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>
                  {post.content}
                </Typography>

                <Box display="flex" alignItems="center" gap={1}>
                  <IconButton
                    size="small"
                    onClick={() => handleToggleLike(post._id)}
                    color={post.likes.includes(user?.id) ? 'primary' : 'default'}
                  >
                    <ThumbUpIcon fontSize="small" />
                  </IconButton>
                  <Typography variant="body2" color="text.secondary">
                    {post.likes.length}
                  </Typography>

                  <IconButton
                    size="small"
                    onClick={() => handleToggleDislike(post._id)}
                    color={post.dislikes.includes(user?.id) ? 'error' : 'default'}
                  >
                    <ThumbDownIcon fontSize="small" />
                  </IconButton>
                  <Typography variant="body2" color="text.secondary">
                    {post.dislikes.length}
                  </Typography>

                  <Button
                    size="small"
                    startIcon={<ReplyIcon />}
                    onClick={() => handleOpenReplyDialog(post)}
                    disabled={topic.isLocked}
                  >
                    Reply
                  </Button>

                  {canEditPost(post) && (
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => handleOpenEditDialog(post)}
                    >
                      Edit
                    </Button>
                  )}

                  {canDeletePost(post) && (
                    <Button
                      size="small"
                      startIcon={<DeleteIcon />}
                      color="error"
                      onClick={() => handleDeletePost(post._id)}
                    >
                      Delete
                    </Button>
                  )}

                  {canMarkSolution(post) && !post.isSolution && (
                    <Button
                      size="small"
                      startIcon={<CheckCircleIcon />}
                      color="success"
                      onClick={() => handleMarkAsSolution(post._id)}
                    >
                      Mark Solution
                    </Button>
                  )}

                  <IconButton
                    size="small"
                    onClick={() => handleOpenReportDialog(post)}
                  >
                    <FlagIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>
      ))}

      {posts.length === 0 && (
        <Box textAlign="center" py={4}>
          <CommentIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No replies yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Be the first to reply to this topic!
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

      {/* Reply Dialog */}
      <Dialog
        open={openReplyDialog}
        onClose={() => setOpenReplyDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Reply to {selectedPost ? `${selectedPost.author.firstName} ${selectedPost.author.lastName}` : 'Topic'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={6}
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write your reply..."
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenReplyDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateReply} variant="contained">
            Post Reply
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={openEditDialog}
        onClose={() => setOpenEditDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Post</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={6}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleEditPost} variant="contained">
            Update Post
          </Button>
        </DialogActions>
      </Dialog>

      {/* Report Dialog */}
      <Dialog
        open={openReportDialog}
        onClose={() => setOpenReportDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Report Post</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
            <InputLabel>Reason</InputLabel>
            <Select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              label="Reason"
            >
              <MenuItem value="spam">Spam</MenuItem>
              <MenuItem value="inappropriate">Inappropriate Content</MenuItem>
              <MenuItem value="offensive">Offensive</MenuItem>
              <MenuItem value="duplicate">Duplicate</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            multiline
            rows={3}
            value={reportDescription}
            onChange={(e) => setReportDescription(e.target.value)}
            placeholder="Additional details (optional)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenReportDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleReportPost} variant="contained" color="error">
            Report
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ForumTopic;
