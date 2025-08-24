const express = require('express');
const { body, validationResult } = require('express-validator');
const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const { auth, requireTeacher } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/lessons/course/:courseId
// @desc    Get all lessons for a course
// @access  Public (for published courses)
router.get('/course/:courseId', async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course || !course.isPublished) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const lessons = await Lesson.find({ 
      course: req.params.courseId,
      isPublished: true 
    }).sort({ order: 1 });

    res.json({ lessons });
  } catch (error) {
    console.error('Get lessons error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/lessons/:id
// @desc    Get lesson by ID
// @access  Public (for published lessons)
router.get('/:id', async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id)
      .populate('course', 'title instructor isPublished');

    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    // Check if lesson and course are published
    if (!lesson.isPublished || !lesson.course.isPublished) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    res.json({ lesson });
  } catch (error) {
    console.error('Get lesson error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/lessons
// @desc    Create a new lesson
// @access  Private (Teacher/Admin only)
router.post('/', [
  auth,
  requireTeacher,
  body('title').trim().isLength({ min: 3, max: 100 }).withMessage('Title must be between 3 and 100 characters'),
  body('description').trim().isLength({ min: 10, max: 500 }).withMessage('Description must be between 10 and 500 characters'),
  body('course').isMongoId().withMessage('Valid course ID is required'),
  body('order').isInt({ min: 1 }).withMessage('Order must be a positive integer'),
  body('content.type').isIn(['text', 'video', 'document', 'quiz', 'assignment', 'mixed']).withMessage('Invalid content type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if course exists and user is the instructor
    const course = await Course.findById(req.body.course);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to add lessons to this course' });
    }

    const lesson = new Lesson({
      ...req.body,
      course: req.body.course
    });

    await lesson.save();

    res.status(201).json({
      message: 'Lesson created successfully',
      lesson
    });

  } catch (error) {
    console.error('Create lesson error:', error);
    res.status(500).json({ message: 'Server error during lesson creation' });
  }
});

// @route   PUT /api/lessons/:id
// @desc    Update a lesson
// @access  Private (Course instructor or admin only)
router.put('/:id', [
  auth,
  requireTeacher,
  body('title').optional().trim().isLength({ min: 3, max: 100 }),
  body('description').optional().trim().isLength({ min: 10, max: 500 }),
  body('order').optional().isInt({ min: 1 }),
  body('content.type').optional().isIn(['text', 'video', 'document', 'quiz', 'assignment', 'mixed'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const lesson = await Lesson.findById(req.params.id).populate('course');
    
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    // Check if user is the course instructor or admin
    if (lesson.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this lesson' });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        lesson[key] = req.body[key];
      }
    });

    await lesson.save();

    res.json({
      message: 'Lesson updated successfully',
      lesson
    });

  } catch (error) {
    console.error('Update lesson error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    res.status(500).json({ message: 'Server error during lesson update' });
  }
});

// @route   DELETE /api/lessons/:id
// @desc    Delete a lesson
// @access  Private (Course instructor or admin only)
router.delete('/:id', [auth, requireTeacher], async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id).populate('course');
    
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    // Check if user is the course instructor or admin
    if (lesson.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this lesson' });
    }

    await Lesson.findByIdAndDelete(req.params.id);

    res.json({ message: 'Lesson deleted successfully' });

  } catch (error) {
    console.error('Delete lesson error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    res.status(500).json({ message: 'Server error during lesson deletion' });
  }
});

module.exports = router;
