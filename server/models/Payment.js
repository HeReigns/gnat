const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: false // Optional for subscriptions
  },
  type: {
    type: String,
    enum: ['course_enrollment', 'subscription', 'certificate', 'refund'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'GHS',
    enum: ['GHS', 'USD', 'EUR', 'GBP']
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['mobile_money', 'card', 'bank_transfer', 'paypal', 'stripe'],
    required: true
  },
  paymentProvider: {
    type: String,
    enum: ['momo', 'vodafone_cash', 'airtel_money', 'stripe', 'paypal', 'bank'],
    required: true
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },
  reference: {
    type: String,
    unique: true,
    required: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  metadata: {
    // Payment provider specific data
    providerTransactionId: String,
    providerResponse: mongoose.Schema.Types.Mixed,
    cardLast4: String,
    cardBrand: String,
    bankName: String,
    accountNumber: String,
    
    // Course specific data
    courseTitle: String,
    courseDuration: String,
    instructorName: String,
    
    // Subscription data
    subscriptionPlan: String,
    subscriptionDuration: String,
    startDate: Date,
    endDate: Date,
    
    // Refund data
    originalPaymentId: mongoose.Schema.Types.ObjectId,
    refundReason: String,
    refundAmount: Number
  },
  billingAddress: {
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    address: String,
    city: String,
    state: String,
    country: String,
    postalCode: String
  },
  receipt: {
    url: String,
    sent: {
      type: Boolean,
      default: false
    },
    sentAt: Date
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  processedAt: {
    type: Date,
    default: null
  },
  failedAt: {
    type: Date,
    default: null
  },
  failureReason: {
    type: String,
    default: null
  },
  refundedAt: {
    type: Date,
    default: null
  },
  refundReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ course: 1, status: 1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ reference: 1 });
paymentSchema.index({ status: 1, createdAt: 1 });
paymentSchema.index({ paymentMethod: 1, status: 1 });

// Virtual for formatted amount
paymentSchema.virtual('formattedAmount').get(function() {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: this.currency
  }).format(this.amount);
});

// Virtual for payment age
paymentSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Virtual for is successful
paymentSchema.virtual('isSuccessful').get(function() {
  return this.status === 'completed';
});

// Virtual for is pending
paymentSchema.virtual('isPending').get(function() {
  return this.status === 'pending' || this.status === 'processing';
});

// Virtual for is refundable
paymentSchema.virtual('isRefundable').get(function() {
  return this.status === 'completed' && !this.refundedAt;
});

// Pre-save middleware
paymentSchema.pre('save', function(next) {
  // Generate reference if not provided
  if (!this.reference) {
    this.reference = this.generateReference();
  }
  
  // Update timestamps based on status changes
  if (this.isModified('status')) {
    switch (this.status) {
      case 'completed':
        this.processedAt = new Date();
        break;
      case 'failed':
        this.failedAt = new Date();
        break;
      case 'refunded':
        this.refundedAt = new Date();
        break;
    }
  }
  
  next();
});

// Method to generate unique reference
paymentSchema.methods.generateReference = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `PAY-${timestamp}-${random}`.toUpperCase();
};

// Method to mark as completed
paymentSchema.methods.markAsCompleted = function(transactionId = null) {
  this.status = 'completed';
  this.processedAt = new Date();
  if (transactionId) {
    this.transactionId = transactionId;
  }
  return this.save();
};

// Method to mark as failed
paymentSchema.methods.markAsFailed = function(reason) {
  this.status = 'failed';
  this.failedAt = new Date();
  this.failureReason = reason;
  return this.save();
};

// Method to mark as cancelled
paymentSchema.methods.markAsCancelled = function() {
  this.status = 'cancelled';
  return this.save();
};

// Method to process refund
paymentSchema.methods.processRefund = function(amount, reason) {
  this.status = 'refunded';
  this.refundedAt = new Date();
  this.refundReason = reason;
  this.metadata.refundAmount = amount;
  return this.save();
};

// Static method to create payment
paymentSchema.statics.createPayment = async function(data) {
  const payment = new this(data);
  await payment.save();
  return payment;
};

// Static method to get user payments
paymentSchema.statics.getUserPayments = async function(userId, options = {}) {
  const {
    status,
    type,
    limit = 20,
    skip = 0
  } = options;

  let query = { user: userId };

  if (status) query.status = status;
  if (type) query.type = type;

  const payments = await this.find(query)
    .populate('course', 'title instructor')
    .populate('user', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return payments;
};

// Static method to get course payments
paymentSchema.statics.getCoursePayments = async function(courseId, options = {}) {
  const {
    status,
    limit = 50,
    skip = 0
  } = options;

  let query = { course: courseId };

  if (status) query.status = status;

  const payments = await this.find(query)
    .populate('user', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return payments;
};

// Static method to get payment statistics
paymentSchema.statics.getPaymentStats = async function(filters = {}) {
  const matchStage = {};
  
  if (filters.startDate && filters.endDate) {
    matchStage.createdAt = {
      $gte: new Date(filters.startDate),
      $lte: new Date(filters.endDate)
    };
  }
  
  if (filters.status) {
    matchStage.status = filters.status;
  }
  
  if (filters.type) {
    matchStage.type = filters.type;
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);

  const totalPayments = await this.countDocuments(matchStage);
  const totalAmount = await this.aggregate([
    { $match: { ...matchStage, status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  return {
    totalPayments,
    totalAmount: totalAmount[0]?.total || 0,
    byStatus: stats.reduce((acc, stat) => {
      acc[stat._id] = {
        count: stat.count,
        amount: stat.totalAmount
      };
      return acc;
    }, {})
  };
};

// Static method to get revenue analytics
paymentSchema.statics.getRevenueAnalytics = async function(period = 'month') {
  const now = new Date();
  let startDate;
  
  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'year':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const dailyRevenue = await this.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: startDate, $lte: now }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          type: '$type'
        },
        revenue: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.date',
        types: {
          $push: {
            type: '$_id.type',
            revenue: '$revenue',
            count: '$count'
          }
        },
        totalRevenue: { $sum: '$revenue' },
        totalCount: { $sum: '$count' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const paymentMethodStats = await this.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: startDate, $lte: now }
      }
    },
    {
      $group: {
        _id: '$paymentMethod',
        revenue: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { revenue: -1 } }
  ]);

  const courseRevenue = await this.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: startDate, $lte: now },
        course: { $exists: true }
      }
    },
    {
      $lookup: {
        from: 'courses',
        localField: 'course',
        foreignField: '_id',
        as: 'courseData'
      }
    },
    { $unwind: '$courseData' },
    {
      $group: {
        _id: '$course',
        courseTitle: { $first: '$courseData.title' },
        revenue: { $sum: '$amount' },
        enrollments: { $sum: 1 }
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: 10 }
  ]);

  return {
    period,
    startDate,
    endDate: now,
    dailyRevenue,
    paymentMethodStats,
    courseRevenue
  };
};

// Static method to process refund
paymentSchema.statics.processRefund = async function(paymentId, amount, reason) {
  const payment = await this.findById(paymentId);
  
  if (!payment) {
    throw new Error('Payment not found');
  }
  
  if (!payment.isRefundable) {
    throw new Error('Payment is not refundable');
  }
  
  if (amount > payment.amount) {
    throw new Error('Refund amount cannot exceed payment amount');
  }
  
  await payment.processRefund(amount, reason);
  
  // Create refund record
  const refundPayment = new this({
    user: payment.user,
    course: payment.course,
    type: 'refund',
    amount: amount,
    currency: payment.currency,
    status: 'completed',
    paymentMethod: payment.paymentMethod,
    paymentProvider: payment.paymentProvider,
    description: `Refund for ${payment.description}`,
    metadata: {
      originalPaymentId: payment._id,
      refundReason: reason,
      refundAmount: amount
    },
    processedAt: new Date()
  });
  
  await refundPayment.save();
  
  return { originalPayment: payment, refundPayment };
};

module.exports = mongoose.model('Payment', paymentSchema);
