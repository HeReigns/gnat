const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { requireTeacher, requireAdmin } = require('../middleware/auth');
const Payment = require('../models/Payment');
const Course = require('../models/Course');
const User = require('../models/User');
const emailService = require('../services/emailService');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ==================== PAYMENT PROCESSING ====================

// Initialize payment
router.post('/initialize', [
  auth,
  body('courseId').isMongoId().withMessage('Invalid course ID'),
  body('paymentMethod').isIn(['mobile_money', 'card', 'bank_transfer', 'paypal', 'stripe']).withMessage('Invalid payment method'),
  body('paymentProvider').isIn(['momo', 'vodafone_cash', 'airtel_money', 'stripe', 'paypal', 'bank']).withMessage('Invalid payment provider'),
  body('billingAddress').optional().isObject()
], handleValidationErrors, async (req, res) => {
  try {
    const { courseId, paymentMethod, paymentProvider, billingAddress } = req.body;
    const userId = req.user.id;

    // Check if course exists and is paid
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (!course.isPaid) {
      return res.status(400).json({ message: 'This course is free' });
    }

    // Check if user is already enrolled
    if (course.students.includes(userId)) {
      return res.status(400).json({ message: 'Already enrolled in this course' });
    }

    // Check if user has pending payment for this course
    const existingPayment = await Payment.findOne({
      user: userId,
      course: courseId,
      status: { $in: ['pending', 'processing'] }
    });

    if (existingPayment) {
      return res.status(400).json({ 
        message: 'You have a pending payment for this course',
        paymentId: existingPayment._id
      });
    }

    // Create payment record
    const paymentData = {
      user: userId,
      course: courseId,
      type: 'course_enrollment',
      amount: course.price,
      currency: course.currency || 'GHS',
      paymentMethod,
      paymentProvider,
      description: `Enrollment in ${course.title}`,
      metadata: {
        courseTitle: course.title,
        courseDuration: course.duration,
        instructorName: course.instructorName
      },
      billingAddress: billingAddress || {
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email
      }
    };

    const payment = await Payment.createPayment(paymentData);
    await payment.populate('course', 'title instructor');

    // Initialize payment with provider
    const paymentUrl = await initializePaymentWithProvider(payment, paymentMethod, paymentProvider);

    res.json({
      payment,
      paymentUrl,
      message: 'Payment initialized successfully'
    });
  } catch (error) {
    console.error('Error initializing payment:', error);
    res.status(500).json({ message: 'Error initializing payment' });
  }
});

// Process payment callback
router.post('/callback/:provider', [
  param('provider').isIn(['momo', 'vodafone_cash', 'airtel_money', 'stripe', 'paypal']).withMessage('Invalid provider')
], async (req, res) => {
  try {
    const { provider } = req.params;
    const callbackData = req.body;

    // Verify callback signature
    if (!verifyCallbackSignature(provider, callbackData, req.headers)) {
      return res.status(400).json({ message: 'Invalid callback signature' });
    }

    const { paymentId, status, transactionId, error } = callbackData;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    // Update payment status
    if (status === 'success' || status === 'completed') {
      await payment.markAsCompleted(transactionId);
      
      // Enroll student in course
      if (payment.course) {
        const course = await Course.findById(payment.course);
        if (course && !course.students.includes(payment.user)) {
          course.students.push(payment.user);
          await course.save();
        }
      }

      // Send confirmation email
      const user = await User.findById(payment.user);
      if (user && payment.course) {
        const course = await Course.findById(payment.course);
        await emailService.sendCourseEnrollmentNotification(user, course);
      }

      res.json({ message: 'Payment processed successfully' });
    } else {
      await payment.markAsFailed(error || 'Payment failed');
      res.json({ message: 'Payment failed' });
    }
  } catch (error) {
    console.error('Error processing payment callback:', error);
    res.status(500).json({ message: 'Error processing callback' });
  }
});

// Verify payment status
router.get('/verify/:paymentId', [
  auth,
  param('paymentId').isMongoId().withMessage('Invalid payment ID')
], handleValidationErrors, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id;

    const payment = await Payment.findById(paymentId)
      .populate('course', 'title instructor');

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    // Check if user owns this payment
    if (payment.user.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check payment status with provider
    const status = await checkPaymentStatusWithProvider(payment);

    res.json({
      payment,
      status,
      isEnrolled: payment.course ? payment.course.students.includes(userId) : false
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ message: 'Error verifying payment' });
  }
});

// ==================== PAYMENT MANAGEMENT ====================

// Get user payments
router.get('/user', [
  auth,
  query('status').optional().isIn(['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded']),
  query('type').optional().isIn(['course_enrollment', 'subscription', 'certificate', 'refund']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], handleValidationErrors, async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    const userId = req.user.role === 'student' ? req.user.id : req.query.userId;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    if (req.user.role === 'student' && req.user.id !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const options = { status, type, limit: parseInt(limit), skip: (page - 1) * limit };
    const payments = await Payment.getUserPayments(userId, options);

    const total = await Payment.countDocuments({ user: userId, ...(status && { status }), ...(type && { type }) });

    res.json({
      payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching user payments:', error);
    res.status(500).json({ message: 'Error fetching payments' });
  }
});

// Get payment details
router.get('/:paymentId', [
  auth,
  param('paymentId').isMongoId().withMessage('Invalid payment ID')
], handleValidationErrors, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id;

    const payment = await Payment.findById(paymentId)
      .populate('course', 'title instructor')
      .populate('user', 'firstName lastName email');

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    // Check permissions
    if (payment.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({ message: 'Error fetching payment' });
  }
});

// Cancel payment
router.post('/:paymentId/cancel', [
  auth,
  param('paymentId').isMongoId().withMessage('Invalid payment ID')
], handleValidationErrors, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    // Check permissions
    if (payment.user.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!payment.isPending) {
      return res.status(400).json({ message: 'Payment cannot be cancelled' });
    }

    await payment.markAsCancelled();

    res.json({ message: 'Payment cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling payment:', error);
    res.status(500).json({ message: 'Error cancelling payment' });
  }
});

// ==================== REFUNDS ====================

// Request refund
router.post('/:paymentId/refund', [
  auth,
  requireAdmin,
  param('paymentId').isMongoId().withMessage('Invalid payment ID'),
  body('amount').isFloat({ min: 0 }).withMessage('Invalid refund amount'),
  body('reason').isLength({ min: 10, max: 500 }).withMessage('Refund reason must be between 10 and 500 characters')
], handleValidationErrors, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount, reason } = req.body;

    const payment = await Payment.findById(paymentId)
      .populate('user', 'firstName lastName email')
      .populate('course', 'title');

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    if (!payment.isRefundable) {
      return res.status(400).json({ message: 'Payment is not refundable' });
    }

    if (amount > payment.amount) {
      return res.status(400).json({ message: 'Refund amount cannot exceed payment amount' });
    }

    // Process refund
    const { originalPayment, refundPayment } = await Payment.processRefund(paymentId, amount, reason);

    // Send refund notification email
    if (payment.user) {
      await emailService.sendEmail(
        payment.user.email,
        'Payment Refund Processed',
        `Your refund of ${refundPayment.formattedAmount} for ${payment.description} has been processed. Reason: ${reason}`
      );
    }

    res.json({
      message: 'Refund processed successfully',
      originalPayment,
      refundPayment
    });
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({ message: 'Error processing refund' });
  }
});

// ==================== ANALYTICS ====================

// Get payment statistics (admin only)
router.get('/analytics/stats', [
  auth,
  requireAdmin,
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('status').optional().isIn(['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded']),
  query('type').optional().isIn(['course_enrollment', 'subscription', 'certificate', 'refund'])
], handleValidationErrors, async (req, res) => {
  try {
    const { startDate, endDate, status, type } = req.query;
    
    const filters = {};
    if (startDate && endDate) {
      filters.startDate = startDate;
      filters.endDate = endDate;
    }
    if (status) filters.status = status;
    if (type) filters.type = type;

    const stats = await Payment.getPaymentStats(filters);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching payment stats:', error);
    res.status(500).json({ message: 'Error fetching payment statistics' });
  }
});

// Get revenue analytics (admin only)
router.get('/analytics/revenue', [
  auth,
  requireAdmin,
  query('period').optional().isIn(['week', 'month', 'year']).withMessage('Invalid period')
], handleValidationErrors, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const analytics = await Payment.getRevenueAnalytics(period);
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching revenue analytics:', error);
    res.status(500).json({ message: 'Error fetching revenue analytics' });
  }
});

// Get course payment analytics (teacher/admin)
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

    const payments = await Payment.getCoursePayments(courseId);
    const stats = await Payment.getPaymentStats({ courseId });

    res.json({
      payments,
      stats
    });
  } catch (error) {
    console.error('Error fetching course payment analytics:', error);
    res.status(500).json({ message: 'Error fetching course payment analytics' });
  }
});

// ==================== PAYMENT PROVIDER INTEGRATIONS ====================

// Initialize payment with provider
async function initializePaymentWithProvider(payment, method, provider) {
  // This is a placeholder implementation
  // In a real application, you would integrate with actual payment providers
  
  switch (provider) {
    case 'momo':
      return await initializeMobileMoneyPayment(payment);
    case 'stripe':
      return await initializeStripePayment(payment);
    case 'paypal':
      return await initializePayPalPayment(payment);
    default:
      throw new Error(`Unsupported payment provider: ${provider}`);
  }
}

async function initializeMobileMoneyPayment(payment) {
  // Placeholder for mobile money integration
  return {
    type: 'mobile_money',
    provider: 'momo',
    paymentUrl: `/payments/momo/${payment._id}`,
    reference: payment.reference
  };
}

async function initializeStripePayment(payment) {
  // Placeholder for Stripe integration
  return {
    type: 'card',
    provider: 'stripe',
    paymentUrl: `/payments/stripe/${payment._id}`,
    reference: payment.reference
  };
}

async function initializePayPalPayment(payment) {
  // Placeholder for PayPal integration
  return {
    type: 'paypal',
    provider: 'paypal',
    paymentUrl: `/payments/paypal/${payment._id}`,
    reference: payment.reference
  };
}

// Verify callback signature
function verifyCallbackSignature(provider, data, headers) {
  // Placeholder for signature verification
  // In a real application, you would verify the callback signature
  return true;
}

// Check payment status with provider
async function checkPaymentStatusWithProvider(payment) {
  // Placeholder for status checking
  // In a real application, you would check with the payment provider
  return payment.status;
}

module.exports = router;
