const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { requireTeacher, requireAdmin } = require('../middleware/auth');
const ForumCategory = require('../models/ForumCategory');
const ForumTopic = require('../models/ForumTopic');
const ForumPost = require('../models/ForumPost');
const Course = require('../models/Course');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ==================== FORUM CATEGORIES ====================

// Get all forum categories
router.get('/categories', async (req, res) => {
  try {
    const { role = 'student' } = req.query;
    const categories = await ForumCategory.getCategoriesWithStats(role);
    res.json(categories);
  } catch (error) {
    console.error('Error fetching forum categories:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single category
router.get('/categories/:id', [
  param('id').isMongoId().withMessage('Invalid category ID')
], handleValidationErrors, async (req, res) => {
  try {
    const category = await ForumCategory.findById(req.params.id)
      .populate('course', 'title')
      .populate('createdBy', 'firstName lastName')
      .populate('moderators', 'firstName lastName');
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json(category);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create category (Admin/Teacher only)
router.post('/categories', [
  auth,
  requireTeacher,
  body('name').trim().isLength({ min: 3, max: 100 }).withMessage('Name must be 3-100 characters'),
  body('description').trim().isLength({ min: 10, max: 500 }).withMessage('Description must be 10-500 characters'),
  body('icon').optional().isString(),
  body('color').optional().isHexColor().withMessage('Invalid color format'),
  body('order').optional().isInt({ min: 0 }),
  body('isPublic').optional().isBoolean(),
  body('allowedRoles').optional().isArray(),
  body('course').optional().isMongoId().withMessage('Invalid course ID'),
  body('moderators').optional().isArray()
], handleValidationErrors, async (req, res) => {
  try {
    const categoryData = {
      ...req.body,
      createdBy: req.user.id
    };
    
    const category = new ForumCategory(categoryData);
    await category.save();
    
    await category.populate('course', 'title');
    await category.populate('createdBy', 'firstName lastName');
    
    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Category with this name already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Update category (Admin/Teacher only)
router.put('/categories/:id', [
  auth,
  requireTeacher,
  param('id').isMongoId().withMessage('Invalid category ID'),
  body('name').optional().trim().isLength({ min: 3, max: 100 }),
  body('description').optional().trim().isLength({ min: 10, max: 500 }),
  body('icon').optional().isString(),
  body('color').optional().isHexColor(),
  body('order').optional().isInt({ min: 0 }),
  body('isPublic').optional().isBoolean(),
  body('allowedRoles').optional().isArray(),
  body('course').optional().isMongoId(),
  body('moderators').optional().isArray()
], handleValidationErrors, async (req, res) => {
  try {
    const category = await ForumCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    // Check if user is admin or moderator
    if (req.user.role !== 'admin' && !category.moderators.includes(req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to edit this category' });
    }
    
    Object.assign(category, req.body);
    await category.save();
    
    await category.populate('course', 'title');
    await category.populate('createdBy', 'firstName lastName');
    
    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete category (Admin only)
router.delete('/categories/:id', [
  auth,
  requireAdmin,
  param('id').isMongoId().withMessage('Invalid category ID')
], handleValidationErrors, async (req, res) => {
  try {
    const category = await ForumCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    // Check if category has topics
    const topicCount = await ForumTopic.countDocuments({ category: req.params.id });
    if (topicCount > 0) {
      return res.status(400).json({ message: 'Cannot delete category with existing topics' });
    }
    
    await category.remove();
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== FORUM TOPICS ====================

// Get topics for a category
router.get('/categories/:categoryId/topics', [
  param('categoryId').isMongoId().withMessage('Invalid category ID'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], handleValidationErrors, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await ForumTopic.getTopics(req.params.categoryId, page, limit);
    res.json(result);
  } catch (error) {
    console.error('Error fetching topics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search topics
router.get('/topics/search', [
  query('q').trim().isLength({ min: 2 }).withMessage('Search query must be at least 2 characters'),
  query('category').optional().isMongoId(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], handleValidationErrors, async (req, res) => {
  try {
    const { q, category, page = 1, limit = 20 } = req.query;
    const result = await ForumTopic.searchTopics(q, category, page, limit);
    res.json(result);
  } catch (error) {
    console.error('Error searching topics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single topic
router.get('/topics/:id', [
  param('id').isMongoId().withMessage('Invalid topic ID')
], handleValidationErrors, async (req, res) => {
  try {
    const topic = await ForumTopic.findById(req.params.id)
      .populate('author', 'firstName lastName avatar role')
      .populate('category', 'name slug')
      .populate('course', 'title')
      .populate('lastPoster', 'firstName lastName')
      .populate('subscribers', 'firstName lastName');
    
    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }
    
    // Increment view count
    await topic.incrementViews();
    
    res.json(topic);
  } catch (error) {
    console.error('Error fetching topic:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create topic
router.post('/topics', [
  auth,
  body('title').trim().isLength({ min: 5, max: 200 }).withMessage('Title must be 5-200 characters'),
  body('content').trim().isLength({ min: 10 }).withMessage('Content must be at least 10 characters'),
  body('category').isMongoId().withMessage('Invalid category ID'),
  body('course').optional().isMongoId().withMessage('Invalid course ID'),
  body('tags').optional().isArray(),
  body('type').optional().isIn(['discussion', 'question', 'announcement', 'poll']),
  body('attachments').optional().isArray()
], handleValidationErrors, async (req, res) => {
  try {
    // Check if category exists and user has access
    const category = await ForumCategory.findById(req.body.category);
    if (!category || !category.isActive) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    if (!category.allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized to post in this category' });
    }
    
    // If course is specified, verify user has access to it
    if (req.body.course) {
      const course = await Course.findById(req.body.course);
      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }
      
      // Check if user is enrolled (student) or instructor (teacher)
      if (req.user.role === 'student' && !course.students.includes(req.user.id)) {
        return res.status(403).json({ message: 'Not enrolled in this course' });
      }
      if (req.user.role === 'teacher' && course.instructor.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not the instructor of this course' });
      }
    }
    
    const topicData = {
      ...req.body,
      author: req.user.id
    };
    
    const topic = new ForumTopic(topicData);
    await topic.save();
    
    await topic.populate('author', 'firstName lastName avatar role');
    await topic.populate('category', 'name slug');
    
    res.status(201).json(topic);
  } catch (error) {
    console.error('Error creating topic:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update topic
router.put('/topics/:id', [
  auth,
  param('id').isMongoId().withMessage('Invalid topic ID'),
  body('title').optional().trim().isLength({ min: 5, max: 200 }),
  body('content').optional().trim().isLength({ min: 10 }),
  body('tags').optional().isArray(),
  body('type').optional().isIn(['discussion', 'question', 'announcement', 'poll'])
], handleValidationErrors, async (req, res) => {
  try {
    const topic = await ForumTopic.findById(req.params.id);
    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }
    
    // Check if user is author, admin, or moderator
    const category = await ForumCategory.findById(topic.category);
    const isModerator = category.moderators.includes(req.user.id);
    
    if (topic.author.toString() !== req.user.id && req.user.role !== 'admin' && !isModerator) {
      return res.status(403).json({ message: 'Not authorized to edit this topic' });
    }
    
    Object.assign(topic, req.body);
    await topic.save();
    
    await topic.populate('author', 'firstName lastName avatar role');
    await topic.populate('category', 'name slug');
    
    res.json(topic);
  } catch (error) {
    console.error('Error updating topic:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete topic
router.delete('/topics/:id', [
  auth,
  param('id').isMongoId().withMessage('Invalid topic ID')
], handleValidationErrors, async (req, res) => {
  try {
    const topic = await ForumTopic.findById(req.params.id);
    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }
    
    // Check if user is author, admin, or moderator
    const category = await ForumCategory.findById(topic.category);
    const isModerator = category.moderators.includes(req.user.id);
    
    if (topic.author.toString() !== req.user.id && req.user.role !== 'admin' && !isModerator) {
      return res.status(403).json({ message: 'Not authorized to delete this topic' });
    }
    
    await topic.remove();
    res.json({ message: 'Topic deleted successfully' });
  } catch (error) {
    console.error('Error deleting topic:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle topic subscription
router.post('/topics/:id/subscribe', [
  auth,
  param('id').isMongoId().withMessage('Invalid topic ID')
], handleValidationErrors, async (req, res) => {
  try {
    const topic = await ForumTopic.findById(req.params.id);
    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }
    
    await topic.toggleSubscription(req.user.id);
    res.json({ message: 'Subscription toggled successfully' });
  } catch (error) {
    console.error('Error toggling subscription:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== FORUM POSTS ====================

// Get posts for a topic
router.get('/topics/:topicId/posts', [
  param('topicId').isMongoId().withMessage('Invalid topic ID'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], handleValidationErrors, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await ForumPost.getPostsForTopic(req.params.topicId, page, limit);
    res.json(result);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get replies for a post
router.get('/posts/:postId/replies', [
  param('postId').isMongoId().withMessage('Invalid post ID')
], handleValidationErrors, async (req, res) => {
  try {
    const replies = await ForumPost.getReplies(req.params.postId);
    res.json(replies);
  } catch (error) {
    console.error('Error fetching replies:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create post
router.post('/posts', [
  auth,
  body('content').trim().isLength({ min: 1 }).withMessage('Content is required'),
  body('topic').isMongoId().withMessage('Invalid topic ID'),
  body('parentPost').optional().isMongoId().withMessage('Invalid parent post ID')
], handleValidationErrors, async (req, res) => {
  try {
    const topic = await ForumTopic.findById(req.body.topic);
    if (!topic || !topic.isActive) {
      return res.status(404).json({ message: 'Topic not found' });
    }
    
    if (topic.isLocked && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Topic is locked' });
    }
    
    // If replying to a post, verify it exists
    if (req.body.parentPost) {
      const parentPost = await ForumPost.findById(req.body.parentPost);
      if (!parentPost || !parentPost.isActive) {
        return res.status(404).json({ message: 'Parent post not found' });
      }
    }
    
    const postData = {
      ...req.body,
      author: req.user.id,
      category: topic.category,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };
    
    const post = new ForumPost(postData);
    await post.save();
    
    await post.populate('author', 'firstName lastName avatar role');
    await post.populate('parentPost', 'content author');
    
    res.status(201).json(post);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update post
router.put('/posts/:id', [
  auth,
  param('id').isMongoId().withMessage('Invalid post ID'),
  body('content').trim().isLength({ min: 1 }).withMessage('Content is required')
], handleValidationErrors, async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.id);
    if (!post || !post.isActive) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Check if user is author, admin, or moderator
    const topic = await ForumTopic.findById(post.topic);
    const category = await ForumCategory.findById(post.category);
    const isModerator = category.moderators.includes(req.user.id);
    
    if (post.author.toString() !== req.user.id && req.user.role !== 'admin' && !isModerator) {
      return res.status(403).json({ message: 'Not authorized to edit this post' });
    }
    
    await post.edit(req.body.content, req.user.id, req.body.reason);
    await post.populate('author', 'firstName lastName avatar role');
    
    res.json(post);
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete post
router.delete('/posts/:id', [
  auth,
  param('id').isMongoId().withMessage('Invalid post ID')
], handleValidationErrors, async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.id);
    if (!post || !post.isActive) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Check if user is author, admin, or moderator
    const category = await ForumCategory.findById(post.category);
    const isModerator = category.moderators.includes(req.user.id);
    
    if (post.author.toString() !== req.user.id && req.user.role !== 'admin' && !isModerator) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }
    
    post.isActive = false;
    await post.save();
    
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle like on post
router.post('/posts/:id/like', [
  auth,
  param('id').isMongoId().withMessage('Invalid post ID')
], handleValidationErrors, async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.id);
    if (!post || !post.isActive) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    await post.toggleLike(req.user.id);
    res.json({ message: 'Like toggled successfully' });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle dislike on post
router.post('/posts/:id/dislike', [
  auth,
  param('id').isMongoId().withMessage('Invalid post ID')
], handleValidationErrors, async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.id);
    if (!post || !post.isActive) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    await post.toggleDislike(req.user.id);
    res.json({ message: 'Dislike toggled successfully' });
  } catch (error) {
    console.error('Error toggling dislike:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Report post
router.post('/posts/:id/report', [
  auth,
  param('id').isMongoId().withMessage('Invalid post ID'),
  body('reason').isIn(['spam', 'inappropriate', 'offensive', 'duplicate', 'other']).withMessage('Invalid reason'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description too long')
], handleValidationErrors, async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.id);
    if (!post || !post.isActive) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    await post.report(req.user.id, req.body.reason, req.body.description);
    res.json({ message: 'Post reported successfully' });
  } catch (error) {
    console.error('Error reporting post:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark post as solution (topic author or moderator only)
router.post('/posts/:id/solution', [
  auth,
  param('id').isMongoId().withMessage('Invalid post ID')
], handleValidationErrors, async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.id);
    if (!post || !post.isActive) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    const topic = await ForumTopic.findById(post.topic);
    const category = await ForumCategory.findById(post.category);
    const isModerator = category.moderators.includes(req.user.id);
    
    if (topic.author.toString() !== req.user.id && req.user.role !== 'admin' && !isModerator) {
      return res.status(403).json({ message: 'Not authorized to mark solution' });
    }
    
    await post.markAsSolution();
    res.json({ message: 'Post marked as solution' });
  } catch (error) {
    console.error('Error marking solution:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

