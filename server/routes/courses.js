const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Course = require('../models/Course');
const { auth, requireTeacher } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/courses
// @desc    Get all published courses with filtering and pagination
// @access  Public
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('category').optional().isIn(['mathematics', 'science', 'english', 'social-studies', 'arts', 'physical-education', 'technology', 'other']),
  query('level').optional().isIn(['beginner', 'intermediate', 'advanced']),
  query('search').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = { isPublished: true };
    
    if (req.query.category) {
      filter.category = req.query.category;
    }
    
    if (req.query.level) {
      filter.level = req.query.level;
    }
    
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } },
        { tags: { $in: [new RegExp(req.query.search, 'i')] } }
      ];
    }

    // Get courses with instructor information
    const courses = await Course.find(filter)
      .populate('instructor', 'firstName lastName email profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const total = await Course.countDocuments(filter);

    res.json({
      courses,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/courses/featured
// @desc    Get featured courses
// @access  Public
router.get('/featured', async (req, res) => {
  try {
    const courses = await Course.find({ 
      isPublished: true, 
      isFeatured: true 
    })
    .populate('instructor', 'firstName lastName email profilePicture')
    .sort({ createdAt: -1 })
    .limit(6);

    res.json({ courses });
  } catch (error) {
    console.error('Get featured courses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/courses/:id
// @desc    Get course by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('instructor', 'firstName lastName email profilePicture bio')
      .populate({
        path: 'lessons',
        match: { isPublished: true },
        options: { sort: { order: 1 } }
      });

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Only return published courses to public
    if (!course.isPublished) {
      return res.status(404).json({ message: 'Course not found' });
    }

    res.json({ course });
  } catch (error) {
    console.error('Get course error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Course not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/courses
// @desc    Create a new course
// @access  Private (Teacher/Admin only)
router.post('/', [
  auth,
  requireTeacher,
  body('title').trim().isLength({ min: 3, max: 100 }).withMessage('Title must be between 3 and 100 characters'),
  body('description').trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
  body('category').isIn(['mathematics', 'science', 'english', 'social-studies', 'arts', 'physical-education', 'technology', 'other']).withMessage('Invalid category'),
  body('level').isIn(['beginner', 'intermediate', 'advanced']).withMessage('Invalid level'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),
  body('maxStudents').optional().isInt({ min: 0 }).withMessage('Max students must be a non-negative integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      category,
      level,
      price = 0,
      maxStudents = 0,
      prerequisites = [],
      learningObjectives = [],
      tags = [],
      startDate,
      endDate
    } = req.body;

    const course = new Course({
      title,
      description,
      instructor: req.user.id,
      category,
      level,
      price,
      maxStudents,
      prerequisites,
      learningObjectives,
      tags,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });

    await course.save();

    const populatedCourse = await Course.findById(course._id)
      .populate('instructor', 'firstName lastName email profilePicture');

    res.status(201).json({
      message: 'Course created successfully',
      course: populatedCourse
    });

  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ message: 'Server error during course creation' });
  }
});

// @route   PUT /api/courses/:id
// @desc    Update a course
// @access  Private (Course instructor or admin only)
router.put('/:id', [
  auth,
  requireTeacher,
  body('title').optional().trim().isLength({ min: 3, max: 100 }),
  body('description').optional().trim().isLength({ min: 10, max: 1000 }),
  body('category').optional().isIn(['mathematics', 'science', 'english', 'social-studies', 'arts', 'physical-education', 'technology', 'other']),
  body('level').optional().isIn(['beginner', 'intermediate', 'advanced']),
  body('price').optional().isFloat({ min: 0 }),
  body('maxStudents').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Check if user is the instructor or admin
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this course' });
    }

    // Update fields
    const updateFields = ['title', 'description', 'category', 'level', 'price', 'maxStudents', 
                         'prerequisites', 'learningObjectives', 'tags', 'startDate', 'endDate'];
    
    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'startDate' || field === 'endDate') {
          course[field] = req.body[field] ? new Date(req.body[field]) : undefined;
        } else {
          course[field] = req.body[field];
        }
      }
    });

    await course.save();

    const updatedCourse = await Course.findById(course._id)
      .populate('instructor', 'firstName lastName email profilePicture');

    res.json({
      message: 'Course updated successfully',
      course: updatedCourse
    });

  } catch (error) {
    console.error('Update course error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Course not found' });
    }
    res.status(500).json({ message: 'Server error during course update' });
  }
});

// @route   DELETE /api/courses/:id
// @desc    Delete a course
// @access  Private (Course instructor or admin only)
router.delete('/:id', [auth, requireTeacher], async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Check if user is the instructor or admin
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this course' });
    }

    await Course.findByIdAndDelete(req.params.id);

    res.json({ message: 'Course deleted successfully' });

  } catch (error) {
    console.error('Delete course error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Course not found' });
    }
    res.status(500).json({ message: 'Server error during course deletion' });
  }
});

// @route   PUT /api/courses/:id/publish
// @desc    Publish/unpublish a course
// @access  Private (Course instructor or admin only)
router.put('/:id/publish', [auth, requireTeacher], async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Check if user is the instructor or admin
    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to publish this course' });
    }

    course.isPublished = !course.isPublished;
    await course.save();

    res.json({
      message: `Course ${course.isPublished ? 'published' : 'unpublished'} successfully`,
      isPublished: course.isPublished
    });

  } catch (error) {
    console.error('Publish course error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Course not found' });
    }
    res.status(500).json({ message: 'Server error during course publication' });
  }
});

module.exports = router;
