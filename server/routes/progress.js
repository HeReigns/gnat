const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { requireTeacher, requireAdmin } = require('../middleware/auth');
const Progress = require('../models/Progress');
const Course = require('../models/Course');
const User = require('../models/User');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ==================== PROGRESS TRACKING ====================

// Get student progress for a course
router.get('/course/:courseId', [
  auth,
  param('courseId').isMongoId().withMessage('Invalid course ID')
], handleValidationErrors, async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user.role === 'student' ? req.user.id : req.query.studentId;

    if (!studentId) {
      return res.status(400).json({ message: 'Student ID is required' });
    }

    // Check if student is enrolled in the course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (req.user.role === 'student' && !course.students.includes(studentId)) {
      return res.status(403).json({ message: 'Not enrolled in this course' });
    }

    if (req.user.role === 'teacher' && course.instructor.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not the instructor of this course' });
    }

    const progress = await Progress.getStudentCourseProgress(studentId, courseId);
    res.json(progress);
  } catch (error) {
    console.error('Error fetching course progress:', error);
    res.status(500).json({ message: 'Error fetching progress' });
  }
});

// Get student's overall progress
router.get('/student', [
  auth
], async (req, res) => {
  try {
    const studentId = req.user.role === 'student' ? req.user.id : req.query.studentId;

    if (!studentId) {
      return res.status(400).json({ message: 'Student ID is required' });
    }

    if (req.user.role === 'student' && req.user.id !== studentId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const analytics = await Progress.getStudentAnalytics(studentId);
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching student progress:', error);
    res.status(500).json({ message: 'Error fetching progress' });
  }
});

// Update progress for a specific item
router.put('/:id', [
  auth,
  param('id').isMongoId().withMessage('Invalid progress ID'),
  body('progress').optional().isFloat({ min: 0, max: 100 }),
  body('score').optional().isFloat({ min: 0, max: 100 }),
  body('timeSpent').optional().isInt({ min: 0 }),
  body('status').optional().isIn(['not_started', 'in_progress', 'completed', 'failed']),
  body('feedback').optional().isLength({ max: 1000 })
], handleValidationErrors, async (req, res) => {
  try {
    const progress = await Progress.findById(req.params.id);

    if (!progress) {
      return res.status(404).json({ message: 'Progress not found' });
    }

    // Check permissions
    if (req.user.role === 'student' && progress.student.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (req.user.role === 'teacher') {
      const course = await Course.findById(progress.course);
      if (!course || course.instructor.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Update fields
    if (req.body.progress !== undefined) progress.progress = req.body.progress;
    if (req.body.score !== undefined) progress.score = req.body.score;
    if (req.body.timeSpent !== undefined) progress.timeSpent += req.body.timeSpent;
    if (req.body.status !== undefined) progress.status = req.body.status;
    if (req.body.feedback !== undefined) progress.feedback = req.body.feedback;

    await progress.save();
    await progress.populate('lesson assignment quiz');

    res.json(progress);
  } catch (error) {
    console.error('Error updating progress:', error);
    res.status(500).json({ message: 'Error updating progress' });
  }
});

// Record progress update
router.post('/record', [
  auth,
  body('courseId').isMongoId().withMessage('Invalid course ID'),
  body('type').isIn(['lesson', 'assignment', 'quiz']).withMessage('Invalid type'),
  body('itemId').isMongoId().withMessage('Invalid item ID'),
  body('progress').isFloat({ min: 0, max: 100 }),
  body('timeSpent').optional().isInt({ min: 0 })
], handleValidationErrors, async (req, res) => {
  try {
    const { courseId, type, itemId, progress, timeSpent = 0 } = req.body;
    const studentId = req.user.id;

    // Check if student is enrolled
    const course = await Course.findById(courseId);
    if (!course || !course.students.includes(studentId)) {
      return res.status(403).json({ message: 'Not enrolled in this course' });
    }

    // Find or create progress record
    let progressRecord = await Progress.findOne({
      student: studentId,
      course: courseId,
      type: type,
      [type]: itemId
    });

    if (!progressRecord) {
      progressRecord = new Progress({
        student: studentId,
        course: courseId,
        type: type,
        [type]: itemId
      });
    }

    // Update progress
    await progressRecord.updateProgress(progress, timeSpent);
    await progressRecord.populate('lesson assignment quiz');

    res.json(progressRecord);
  } catch (error) {
    console.error('Error recording progress:', error);
    res.status(500).json({ message: 'Error recording progress' });
  }
});

// Complete an item
router.post('/complete', [
  auth,
  body('courseId').isMongoId().withMessage('Invalid course ID'),
  body('type').isIn(['lesson', 'assignment', 'quiz']).withMessage('Invalid type'),
  body('itemId').isMongoId().withMessage('Invalid item ID'),
  body('score').isFloat({ min: 0, max: 100 }),
  body('feedback').optional().isLength({ max: 1000 })
], handleValidationErrors, async (req, res) => {
  try {
    const { courseId, type, itemId, score, feedback = '' } = req.body;
    const studentId = req.user.id;

    // Check if student is enrolled
    const course = await Course.findById(courseId);
    if (!course || !course.students.includes(studentId)) {
      return res.status(403).json({ message: 'Not enrolled in this course' });
    }

    // Find or create progress record
    let progressRecord = await Progress.findOne({
      student: studentId,
      course: courseId,
      type: type,
      [type]: itemId
    });

    if (!progressRecord) {
      progressRecord = new Progress({
        student: studentId,
        course: courseId,
        type: type,
        [type]: itemId
      });
    }

    // Complete the item
    await progressRecord.complete(score, feedback);
    await progressRecord.populate('lesson assignment quiz');

    res.json(progressRecord);
  } catch (error) {
    console.error('Error completing item:', error);
    res.status(500).json({ message: 'Error completing item' });
  }
});

// ==================== ANALYTICS ====================

// Get course analytics (for teachers/admins)
router.get('/analytics/course/:courseId', [
  auth,
  requireTeacher,
  param('courseId').isMongoId().withMessage('Invalid course ID')
], handleValidationErrors, async (req, res) => {
  try {
    const { courseId } = req.params;

    // Check if user is the instructor or admin
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (req.user.role === 'teacher' && course.instructor.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not the instructor of this course' });
    }

    const analytics = await Progress.getCourseAnalytics(courseId);
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching course analytics:', error);
    res.status(500).json({ message: 'Error fetching analytics' });
  }
});

// Get student analytics (for teachers/admins)
router.get('/analytics/student/:studentId', [
  auth,
  requireTeacher,
  param('studentId').isMongoId().withMessage('Invalid student ID')
], handleValidationErrors, async (req, res) => {
  try {
    const { studentId } = req.params;

    // Check if student exists
    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Check if teacher has access to this student's courses
    if (req.user.role === 'teacher') {
      const studentCourses = await Course.find({ students: studentId });
      const teacherCourses = studentCourses.filter(course => 
        course.instructor.toString() === req.user.id
      );
      
      if (teacherCourses.length === 0) {
        return res.status(403).json({ message: 'No access to this student\'s data' });
      }
    }

    const analytics = await Progress.getStudentAnalytics(studentId);
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching student analytics:', error);
    res.status(500).json({ message: 'Error fetching analytics' });
  }
});

// Get system-wide analytics (admin only)
router.get('/analytics/system', [
  auth,
  requireAdmin
], async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }

    // Get overall statistics
    const totalProgress = await Progress.countDocuments(dateFilter);
    const completedProgress = await Progress.countDocuments({
      ...dateFilter,
      status: 'completed'
    });
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalCourses = await Course.countDocuments();
    const totalTeachers = await User.countDocuments({ role: 'teacher' });

    // Get average scores by type
    const lessonProgress = await Progress.find({ type: 'lesson', ...dateFilter });
    const assignmentProgress = await Progress.find({ type: 'assignment', ...dateFilter });
    const quizProgress = await Progress.find({ type: 'quiz', ...dateFilter });

    const averageScores = {
      lessons: lessonProgress.length > 0 
        ? lessonProgress.reduce((sum, p) => sum + p.score, 0) / lessonProgress.length 
        : 0,
      assignments: assignmentProgress.length > 0 
        ? assignmentProgress.reduce((sum, p) => sum + p.score, 0) / assignmentProgress.length 
        : 0,
      quizzes: quizProgress.length > 0 
        ? quizProgress.reduce((sum, p) => sum + p.score, 0) / quizProgress.length 
        : 0
    };

    // Get completion rates by course
    const courseProgress = await Progress.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$course',
          totalItems: { $sum: 1 },
          completedItems: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          averageScore: { $avg: '$score' }
        }
      },
      {
        $lookup: {
          from: 'courses',
          localField: '_id',
          foreignField: '_id',
          as: 'course'
        }
      },
      { $unwind: '$course' },
      {
        $project: {
          courseTitle: '$course.title',
          totalItems: 1,
          completedItems: 1,
          completionRate: {
            $multiply: [
              { $divide: ['$completedItems', '$totalItems'] },
              100
            ]
          },
          averageScore: 1
        }
      },
      { $sort: { completionRate: -1 } }
    ]);

    // Get recent activity
    const recentActivity = await Progress.find({
      ...dateFilter,
      lastAttempt: { $exists: true }
    })
    .populate('student', 'firstName lastName')
    .populate('course', 'title')
    .sort({ lastAttempt: -1 })
    .limit(20);

    res.json({
      overview: {
        totalProgress,
        completedProgress,
        completionRate: totalProgress > 0 ? (completedProgress / totalProgress) * 100 : 0,
        totalStudents,
        totalCourses,
        totalTeachers
      },
      averageScores,
      courseProgress,
      recentActivity
    });
  } catch (error) {
    console.error('Error fetching system analytics:', error);
    res.status(500).json({ message: 'Error fetching analytics' });
  }
});

// Get progress trends over time
router.get('/analytics/trends', [
  auth,
  requireTeacher,
  query('courseId').optional().isMongoId(),
  query('studentId').optional().isMongoId(),
  query('period').optional().isIn(['day', 'week', 'month']).withMessage('Invalid period')
], handleValidationErrors, async (req, res) => {
  try {
    const { courseId, studentId, period = 'week' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    // Build query
    let query = {
      createdAt: { $gte: startDate, $lte: now }
    };

    if (courseId) {
      query.course = courseId;
    }

    if (studentId) {
      query.student = studentId;
    }

    // Get progress by day
    const dailyProgress = await Progress.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            status: '$status'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          statuses: {
            $push: {
              status: '$_id.status',
              count: '$count'
            }
          },
          total: { $sum: '$count' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get completion trends
    const completionTrends = await Progress.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
            type: '$type'
          },
          completed: { $sum: 1 },
          averageScore: { $avg: '$score' }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          types: {
            $push: {
              type: '$_id.type',
              completed: '$completed',
              averageScore: '$averageScore'
            }
          },
          totalCompleted: { $sum: '$completed' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      dailyProgress,
      completionTrends,
      period,
      startDate,
      endDate: now
    });
  } catch (error) {
    console.error('Error fetching progress trends:', error);
    res.status(500).json({ message: 'Error fetching trends' });
  }
});

// ==================== REPORTS ====================

// Generate progress report
router.get('/reports/progress/:courseId', [
  auth,
  requireTeacher,
  param('courseId').isMongoId().withMessage('Invalid course ID'),
  query('format').optional().isIn(['json', 'csv', 'pdf']).withMessage('Invalid format')
], handleValidationErrors, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { format = 'json' } = req.query;

    // Check permissions
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (req.user.role === 'teacher' && course.instructor.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not the instructor of this course' });
    }

    const analytics = await Progress.getCourseAnalytics(courseId);

    if (format === 'csv') {
      // Generate CSV report
      const csvData = analytics.progress.map(p => ({
        Student: `${p.student.firstName} ${p.student.lastName}`,
        Email: p.student.email,
        Type: p.type,
        Status: p.status,
        Progress: `${p.progress}%`,
        Score: `${p.score}%`,
        TimeSpent: p.formattedTimeSpent,
        Attempts: p.attempts,
        LastAttempt: p.lastAttempt ? new Date(p.lastAttempt).toLocaleDateString() : 'N/A',
        CompletedAt: p.completedAt ? new Date(p.completedAt).toLocaleDateString() : 'N/A'
      }));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="progress-report-${courseId}.csv"`);
      
      // Convert to CSV
      const csv = [
        Object.keys(csvData[0]).join(','),
        ...csvData.map(row => Object.values(row).join(','))
      ].join('\n');
      
      res.send(csv);
    } else {
      res.json(analytics);
    }
  } catch (error) {
    console.error('Error generating progress report:', error);
    res.status(500).json({ message: 'Error generating report' });
  }
});

module.exports = router;
