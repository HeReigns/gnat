const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Assignment = require('../models/Assignment');
const AssignmentSubmission = require('../models/AssignmentSubmission');
const Course = require('../models/Course');
const { auth, requireTeacher, requireStudent } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/assignments');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'zip', 'rar'];
    const fileExt = path.extname(file.originalname).toLowerCase().substring(1);
    if (allowedTypes.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Get all assignments for a course (students and teachers)
router.get('/course/:courseId', [
  param('courseId').isMongoId().withMessage('Invalid course ID'),
  query('status').optional().isIn(['draft', 'active', 'overdue']).withMessage('Invalid status'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { courseId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Check if user is enrolled in the course or is the instructor
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const isInstructor = course.instructor.toString() === req.user.id;
    const isEnrolled = req.user.enrolledCourses && req.user.enrolledCourses.includes(courseId);

    if (!isInstructor && !isEnrolled) {
      return res.status(403).json({ message: 'Access denied. You must be enrolled in this course.' });
    }

    // Build query
    let query = { course: courseId };
    
    if (status === 'draft') {
      query.isPublished = false;
    } else if (status === 'active') {
      query.isPublished = true;
      query.dueDate = { $gt: new Date() };
    } else if (status === 'overdue') {
      query.isPublished = true;
      query.dueDate = { $lt: new Date() };
    } else {
      query.isPublished = true;
    }

    // Students can only see published assignments
    if (!isInstructor) {
      query.isPublished = true;
    }

    const assignments = await Assignment.find(query)
      .populate('instructor', 'firstName lastName email')
      .populate('lesson', 'title')
      .sort({ dueDate: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Assignment.countDocuments(query);

    res.json({
      assignments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single assignment details
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid assignment ID')
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const assignment = await Assignment.findById(req.params.id)
      .populate('instructor', 'firstName lastName email')
      .populate('course', 'title')
      .populate('lesson', 'title');

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Check access permissions
    const isInstructor = assignment.instructor._id.toString() === req.user.id;
    const isEnrolled = req.user.enrolledCourses && req.user.enrolledCourses.includes(assignment.course._id.toString());

    if (!isInstructor && !isEnrolled) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // For students, check if they have submitted
    let submission = null;
    if (req.user.role === 'student') {
      submission = await AssignmentSubmission.findOne({
        assignment: assignment._id,
        student: req.user.id
      });
    }

    res.json({
      assignment,
      submission,
      canSubmit: req.user.role === 'student' && assignment.isPublished
    });
  } catch (error) {
    console.error('Error fetching assignment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new assignment (teachers only)
router.post('/', [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required and must be less than 200 characters'),
  body('description').trim().isLength({ min: 1 }).withMessage('Description is required'),
  body('courseId').isMongoId().withMessage('Invalid course ID'),
  body('lessonId').optional().isMongoId().withMessage('Invalid lesson ID'),
  body('dueDate').isISO8601().withMessage('Invalid due date'),
  body('totalPoints').isInt({ min: 1, max: 1000 }).withMessage('Total points must be between 1 and 1000'),
  body('instructions').optional().trim(),
  body('submissionType').optional().isIn(['text', 'file', 'both']).withMessage('Invalid submission type'),
  body('maxSubmissions').optional().isInt({ min: 1 }).withMessage('Max submissions must be at least 1'),
  body('allowLateSubmission').optional().isBoolean().withMessage('Allow late submission must be boolean'),
  body('latePenalty').optional().isFloat({ min: 0, max: 100 }).withMessage('Late penalty must be between 0 and 100'),
  body('isPublished').optional().isBoolean().withMessage('Is published must be boolean')
], auth, requireTeacher, upload.array('attachments', 5), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      courseId,
      lessonId,
      dueDate,
      totalPoints,
      instructions,
      submissionType = 'text',
      maxSubmissions = 1,
      allowLateSubmission = false,
      latePenalty = 0,
      isPublished = false,
      rubric
    } = req.body;

    // Check if course exists and user is the instructor
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (course.instructor.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only create assignments for your own courses' });
    }

    // Process uploaded files
    const attachments = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        attachments.push({
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          size: file.size
        });
      });
    }

    const assignment = new Assignment({
      title,
      description,
      course: courseId,
      lesson: lessonId,
      instructor: req.user.id,
      dueDate,
      totalPoints,
      instructions,
      attachments,
      submissionType,
      maxSubmissions,
      allowLateSubmission,
      latePenalty,
      isPublished,
      rubric: rubric ? JSON.parse(rubric) : []
    });

    await assignment.save();

    res.status(201).json({
      message: 'Assignment created successfully',
      assignment
    });
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update assignment (teachers only)
router.put('/:id', [
  param('id').isMongoId().withMessage('Invalid assignment ID'),
  body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Title must be less than 200 characters'),
  body('description').optional().trim().isLength({ min: 1 }).withMessage('Description is required'),
  body('dueDate').optional().isISO8601().withMessage('Invalid due date'),
  body('totalPoints').optional().isInt({ min: 1, max: 1000 }).withMessage('Total points must be between 1 and 1000'),
  body('instructions').optional().trim(),
  body('submissionType').optional().isIn(['text', 'file', 'both']).withMessage('Invalid submission type'),
  body('maxSubmissions').optional().isInt({ min: 1 }).withMessage('Max submissions must be at least 1'),
  body('allowLateSubmission').optional().isBoolean().withMessage('Allow late submission must be boolean'),
  body('latePenalty').optional().isFloat({ min: 0, max: 100 }).withMessage('Late penalty must be between 0 and 100'),
  body('isPublished').optional().isBoolean().withMessage('Is published must be boolean')
], auth, requireTeacher, upload.array('attachments', 5), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Check if user is the instructor
    if (assignment.instructor.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only update your own assignments' });
    }

    // Process uploaded files
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        assignment.attachments.push({
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          size: file.size
        });
      });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (key !== 'attachments' && key !== 'rubric') {
        assignment[key] = req.body[key];
      }
    });

    if (req.body.rubric) {
      assignment.rubric = JSON.parse(req.body.rubric);
    }

    await assignment.save();

    res.json({
      message: 'Assignment updated successfully',
      assignment
    });
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete assignment (teachers only)
router.delete('/:id', [
  param('id').isMongoId().withMessage('Invalid assignment ID')
], auth, requireTeacher, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Check if user is the instructor
    if (assignment.instructor.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete your own assignments' });
    }

    // Check if there are any submissions
    const submissionCount = await AssignmentSubmission.countDocuments({ assignment: assignment._id });
    if (submissionCount > 0) {
      return res.status(400).json({ message: 'Cannot delete assignment with existing submissions' });
    }

    await Assignment.findByIdAndDelete(req.params.id);

    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit assignment (students only)
router.post('/:id/submit', [
  param('id').isMongoId().withMessage('Invalid assignment ID'),
  body('submissionText').optional().trim(),
  body('comment').optional().trim()
], auth, requireStudent, upload.array('attachments', 5), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (!assignment.isPublished) {
      return res.status(400).json({ message: 'Assignment is not published' });
    }

    // Check if student is enrolled in the course
    const isEnrolled = req.user.enrolledCourses && req.user.enrolledCourses.includes(assignment.course.toString());
    if (!isEnrolled) {
      return res.status(403).json({ message: 'You must be enrolled in this course to submit assignments' });
    }

    // Check if assignment is still open
    if (new Date() > assignment.dueDate && !assignment.allowLateSubmission) {
      return res.status(400).json({ message: 'Assignment submission is closed' });
    }

    // Check if student has already submitted the maximum number of times
    const existingSubmissions = await AssignmentSubmission.countDocuments({
      assignment: assignment._id,
      student: req.user.id
    });

    if (existingSubmissions >= assignment.maxSubmissions) {
      return res.status(400).json({ message: 'Maximum number of submissions reached' });
    }

    // Process uploaded files
    const attachments = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        attachments.push({
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          size: file.size
        });
      });
    }

    // Validate submission type
    if (assignment.submissionType === 'text' && !req.body.submissionText) {
      return res.status(400).json({ message: 'Text submission is required' });
    }

    if (assignment.submissionType === 'file' && attachments.length === 0) {
      return res.status(400).json({ message: 'File submission is required' });
    }

    if (assignment.submissionType === 'both' && (!req.body.submissionText || attachments.length === 0)) {
      return res.status(400).json({ message: 'Both text and file submissions are required' });
    }

    const submission = new AssignmentSubmission({
      assignment: assignment._id,
      student: req.user.id,
      course: assignment.course,
      submissionText: req.body.submissionText,
      attachments,
      attemptNumber: existingSubmissions + 1
    });

    await submission.save();

    res.status(201).json({
      message: 'Assignment submitted successfully',
      submission
    });
  } catch (error) {
    console.error('Error submitting assignment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get submissions for an assignment (teachers only)
router.get('/:id/submissions', [
  param('id').isMongoId().withMessage('Invalid assignment ID'),
  query('status').optional().isIn(['submitted', 'graded', 'returned']).withMessage('Invalid status'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], auth, requireTeacher, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Check if user is the instructor
    if (assignment.instructor.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only view submissions for your own assignments' });
    }

    const { status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    let query = { assignment: assignment._id };
    if (status) {
      query.status = status;
    }

    const submissions = await AssignmentSubmission.find(query)
      .populate('student', 'firstName lastName email')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AssignmentSubmission.countDocuments(query);

    res.json({
      submissions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Grade a submission (teachers only)
router.post('/submissions/:submissionId/grade', [
  param('submissionId').isMongoId().withMessage('Invalid submission ID'),
  body('score').isFloat({ min: 0 }).withMessage('Score must be a positive number'),
  body('feedback').optional().trim(),
  body('rubricScores').optional().isArray().withMessage('Rubric scores must be an array')
], auth, requireTeacher, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const submission = await AssignmentSubmission.findById(req.params.submissionId)
      .populate('assignment')
      .populate('student', 'firstName lastName email');

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    // Check if user is the instructor
    if (submission.assignment.instructor.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only grade submissions for your own assignments' });
    }

    const { score, feedback, rubricScores } = req.body;

    // Validate score against assignment total points
    if (score > submission.assignment.totalPoints) {
      return res.status(400).json({ message: 'Score cannot exceed assignment total points' });
    }

    submission.score = score;
    submission.feedback = feedback;
    submission.rubricScores = rubricScores || [];
    submission.isGraded = true;
    submission.gradedBy = req.user.id;
    submission.gradedAt = new Date();
    submission.status = 'graded';

    await submission.save();

    res.json({
      message: 'Submission graded successfully',
      submission
    });
  } catch (error) {
    console.error('Error grading submission:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get student's submissions
router.get('/student/submissions', [
  query('courseId').optional().isMongoId().withMessage('Invalid course ID'),
  query('status').optional().isIn(['submitted', 'graded', 'returned']).withMessage('Invalid status'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], auth, requireStudent, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { courseId, status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    let query = { student: req.user.id };
    if (courseId) {
      query.course = courseId;
    }
    if (status) {
      query.status = status;
    }

    const submissions = await AssignmentSubmission.find(query)
      .populate('assignment', 'title dueDate totalPoints')
      .populate('course', 'title')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AssignmentSubmission.countDocuments(query);

    res.json({
      submissions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching student submissions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
