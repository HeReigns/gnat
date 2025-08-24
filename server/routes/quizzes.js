const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Course = require('../models/Course');
const { auth, requireTeacher, requireStudent } = require('../middleware/auth');

const router = express.Router();

// Get all quizzes for a course
router.get('/course/:courseId', [
  param('courseId').isMongoId().withMessage('Invalid course ID'),
  query('status').optional().isIn(['draft', 'active', 'scheduled', 'expired']).withMessage('Invalid status'),
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
      query.isActive = true;
      query.startDate = { $lte: new Date() };
      query.endDate = { $gte: new Date() };
    } else if (status === 'scheduled') {
      query.isPublished = true;
      query.startDate = { $gt: new Date() };
    } else if (status === 'expired') {
      query.isPublished = true;
      query.endDate = { $lt: new Date() };
    } else {
      query.isPublished = true;
    }

    // Students can only see published quizzes
    if (!isInstructor) {
      query.isPublished = true;
    }

    const quizzes = await Quiz.find(query)
      .populate('instructor', 'firstName lastName email')
      .populate('lesson', 'title')
      .sort({ startDate: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Quiz.countDocuments(query);

    res.json({
      quizzes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single quiz details
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid quiz ID')
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const quiz = await Quiz.findById(req.params.id)
      .populate('instructor', 'firstName lastName email')
      .populate('course', 'title')
      .populate('lesson', 'title');

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Check access permissions
    const isInstructor = quiz.instructor._id.toString() === req.user.id;
    const isEnrolled = req.user.enrolledCourses && req.user.enrolledCourses.includes(quiz.course._id.toString());

    if (!isInstructor && !isEnrolled) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // For students, check if they have attempted
    let attempts = [];
    if (req.user.role === 'student') {
      attempts = await QuizAttempt.find({
        quiz: quiz._id,
        student: req.user.id
      }).sort({ startedAt: -1 });
    }

    res.json({
      quiz,
      attempts,
      canTake: req.user.role === 'student' && quiz.isAvailable()
    });
  } catch (error) {
    console.error('Error fetching quiz:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new quiz (teachers only)
router.post('/', [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required and must be less than 200 characters'),
  body('description').trim().isLength({ min: 1 }).withMessage('Description is required'),
  body('courseId').isMongoId().withMessage('Invalid course ID'),
  body('lessonId').optional().isMongoId().withMessage('Invalid lesson ID'),
  body('startDate').isISO8601().withMessage('Invalid start date'),
  body('endDate').isISO8601().withMessage('Invalid end date'),
  body('timeLimit').optional().isInt({ min: 0 }).withMessage('Time limit must be a non-negative integer'),
  body('passingScore').optional().isFloat({ min: 0, max: 100 }).withMessage('Passing score must be between 0 and 100'),
  body('maxAttempts').optional().isInt({ min: 1 }).withMessage('Max attempts must be at least 1'),
  body('questions').isArray({ min: 1 }).withMessage('At least one question is required'),
  body('questions.*.questionText').trim().isLength({ min: 1 }).withMessage('Question text is required'),
  body('questions.*.questionType').isIn(['multiple-choice', 'true-false', 'short-answer', 'essay', 'matching', 'fill-blank']).withMessage('Invalid question type'),
  body('questions.*.points').isInt({ min: 1 }).withMessage('Points must be at least 1')
], auth, requireTeacher, async (req, res) => {
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
      startDate,
      endDate,
      timeLimit = 0,
      passingScore = 60,
      maxAttempts = 1,
      questions,
      shuffleQuestions = false,
      shuffleOptions = false,
      showCorrectAnswers = true,
      showExplanations = true,
      allowReview = true,
      isPublished = false,
      settings = {}
    } = req.body;

    // Check if course exists and user is the instructor
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (course.instructor.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only create quizzes for your own courses' });
    }

    // Validate questions based on type
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      
      switch (question.questionType) {
        case 'multiple-choice':
          if (!question.options || question.options.length < 2) {
            return res.status(400).json({ message: `Question ${i + 1}: Multiple choice questions must have at least 2 options` });
          }
          if (!question.options.some(opt => opt.isCorrect)) {
            return res.status(400).json({ message: `Question ${i + 1}: Multiple choice questions must have at least one correct answer` });
          }
          break;
        case 'true-false':
          if (!question.options || question.options.length !== 2) {
            return res.status(400).json({ message: `Question ${i + 1}: True/false questions must have exactly 2 options` });
          }
          if (!question.options.some(opt => opt.isCorrect)) {
            return res.status(400).json({ message: `Question ${i + 1}: True/false questions must have one correct answer` });
          }
          break;
        case 'matching':
          if (!question.matchingPairs || question.matchingPairs.length < 2) {
            return res.status(400).json({ message: `Question ${i + 1}: Matching questions must have at least 2 pairs` });
          }
          break;
        case 'fill-blank':
          if (!question.fillBlanks || question.fillBlanks.length < 1) {
            return res.status(400).json({ message: `Question ${i + 1}: Fill-in-the-blank questions must have at least one blank` });
          }
          break;
      }
    }

    const quiz = new Quiz({
      title,
      description,
      course: courseId,
      lesson: lessonId,
      instructor: req.user.id,
      questions,
      timeLimit,
      passingScore,
      maxAttempts,
      shuffleQuestions,
      shuffleOptions,
      showCorrectAnswers,
      showExplanations,
      allowReview,
      startDate,
      endDate,
      isPublished,
      settings
    });

    await quiz.save();

    res.status(201).json({
      message: 'Quiz created successfully',
      quiz
    });
  } catch (error) {
    console.error('Error creating quiz:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update quiz (teachers only)
router.put('/:id', [
  param('id').isMongoId().withMessage('Invalid quiz ID'),
  body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Title must be less than 200 characters'),
  body('description').optional().trim().isLength({ min: 1 }).withMessage('Description is required'),
  body('startDate').optional().isISO8601().withMessage('Invalid start date'),
  body('endDate').optional().isISO8601().withMessage('Invalid end date'),
  body('timeLimit').optional().isInt({ min: 0 }).withMessage('Time limit must be a non-negative integer'),
  body('passingScore').optional().isFloat({ min: 0, max: 100 }).withMessage('Passing score must be between 0 and 100'),
  body('maxAttempts').optional().isInt({ min: 1 }).withMessage('Max attempts must be at least 1')
], auth, requireTeacher, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Check if user is the instructor
    if (quiz.instructor.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only update your own quizzes' });
    }

    // Check if quiz has attempts (prevent updates if students have taken it)
    const attemptCount = await QuizAttempt.countDocuments({ quiz: quiz._id });
    if (attemptCount > 0) {
      return res.status(400).json({ message: 'Cannot update quiz that has been attempted by students' });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (key !== 'questions') { // Don't allow question updates after creation
        quiz[key] = req.body[key];
      }
    });

    await quiz.save();

    res.json({
      message: 'Quiz updated successfully',
      quiz
    });
  } catch (error) {
    console.error('Error updating quiz:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete quiz (teachers only)
router.delete('/:id', [
  param('id').isMongoId().withMessage('Invalid quiz ID')
], auth, requireTeacher, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Check if user is the instructor
    if (quiz.instructor.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete your own quizzes' });
    }

    // Check if there are any attempts
    const attemptCount = await QuizAttempt.countDocuments({ quiz: quiz._id });
    if (attemptCount > 0) {
      return res.status(400).json({ message: 'Cannot delete quiz with existing attempts' });
    }

    await Quiz.findByIdAndDelete(req.params.id);

    res.json({ message: 'Quiz deleted successfully' });
  } catch (error) {
    console.error('Error deleting quiz:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Start quiz attempt (students only)
router.post('/:id/start', [
  param('id').isMongoId().withMessage('Invalid quiz ID'),
  body('password').optional().trim()
], auth, requireStudent, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Check if quiz is available
    if (!quiz.isAvailable()) {
      return res.status(400).json({ message: 'Quiz is not available' });
    }

    // Check if student is enrolled in the course
    const isEnrolled = req.user.enrolledCourses && req.user.enrolledCourses.includes(quiz.course.toString());
    if (!isEnrolled) {
      return res.status(403).json({ message: 'You must be enrolled in this course to take the quiz' });
    }

    // Check password if required
    if (quiz.settings.requirePassword && quiz.settings.password !== req.body.password) {
      return res.status(400).json({ message: 'Incorrect password' });
    }

    // Check if student has exceeded max attempts
    const attemptCount = await QuizAttempt.countDocuments({
      quiz: quiz._id,
      student: req.user.id
    });

    if (attemptCount >= quiz.maxAttempts) {
      return res.status(400).json({ message: 'Maximum attempts reached for this quiz' });
    }

    // Create new attempt
    const attempt = new QuizAttempt({
      quiz: quiz._id,
      student: req.user.id,
      course: quiz.course,
      attemptNumber: attemptCount + 1,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    await attempt.save();

    res.status(201).json({
      message: 'Quiz attempt started',
      attempt
    });
  } catch (error) {
    console.error('Error starting quiz attempt:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit quiz answers (students only)
router.post('/attempts/:attemptId/submit', [
  param('attemptId').isMongoId().withMessage('Invalid attempt ID'),
  body('answers').isArray().withMessage('Answers must be an array'),
  body('timeSpent').optional().isInt({ min: 0 }).withMessage('Time spent must be a non-negative integer')
], auth, requireStudent, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const attempt = await QuizAttempt.findById(req.params.attemptId)
      .populate('quiz');

    if (!attempt) {
      return res.status(404).json({ message: 'Attempt not found' });
    }

    // Check if attempt belongs to the student
    if (attempt.student.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if attempt is in progress
    if (!attempt.isInProgress()) {
      return res.status(400).json({ message: 'Attempt is not in progress' });
    }

    const { answers, timeSpent } = req.body;

    // Update attempt with answers
    attempt.answers = answers;
    attempt.timeSpent = timeSpent || 0;
    attempt.status = 'completed';
    attempt.completedAt = new Date();

    // Auto-grade objective questions
    attempt.autoGrade();

    await attempt.save();

    res.json({
      message: 'Quiz submitted successfully',
      attempt
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get quiz attempts for a quiz (teachers only)
router.get('/:id/attempts', [
  param('id').isMongoId().withMessage('Invalid quiz ID'),
  query('status').optional().isIn(['in-progress', 'completed', 'abandoned', 'timeout']).withMessage('Invalid status'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], auth, requireTeacher, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Check if user is the instructor
    if (quiz.instructor.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only view attempts for your own quizzes' });
    }

    const { status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    let query = { quiz: quiz._id };
    if (status) {
      query.status = status;
    }

    const attempts = await QuizAttempt.find(query)
      .populate('student', 'firstName lastName email')
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await QuizAttempt.countDocuments(query);

    res.json({
      attempts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching attempts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Grade quiz attempt (teachers only)
router.post('/attempts/:attemptId/grade', [
  param('attemptId').isMongoId().withMessage('Invalid attempt ID'),
  body('answers').isArray().withMessage('Answers must be an array')
], auth, requireTeacher, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const attempt = await QuizAttempt.findById(req.params.attemptId)
      .populate('quiz');

    if (!attempt) {
      return res.status(404).json({ message: 'Attempt not found' });
    }

    // Check if user is the instructor
    if (attempt.quiz.instructor.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only grade attempts for your own quizzes' });
    }

    const { answers } = req.body;

    // Update answers with grading
    attempt.answers = answers;
    attempt.isGraded = true;
    attempt.gradedBy = req.user.id;
    attempt.gradedAt = new Date();

    // Recalculate score
    const scoreData = attempt.calculateScore();
    attempt.totalScore = scoreData.score;
    attempt.percentage = scoreData.percentage;
    attempt.grade = attempt.calculateGrade();
    attempt.isPassed = attempt.checkIfPassed();

    await attempt.save();

    res.json({
      message: 'Attempt graded successfully',
      attempt
    });
  } catch (error) {
    console.error('Error grading attempt:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get student's quiz attempts
router.get('/student/attempts', [
  query('courseId').optional().isMongoId().withMessage('Invalid course ID'),
  query('status').optional().isIn(['in-progress', 'completed', 'abandoned', 'timeout']).withMessage('Invalid status'),
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

    const attempts = await QuizAttempt.find(query)
      .populate('quiz', 'title description totalPoints passingScore')
      .populate('course', 'title')
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await QuizAttempt.countDocuments(query);

    res.json({
      attempts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching student attempts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
