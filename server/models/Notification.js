const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'course_enrollment',
      'assignment_due',
      'assignment_graded',
      'quiz_available',
      'quiz_graded',
      'lesson_available',
      'course_update',
      'forum_reply',
      'forum_mention',
      'system_announcement',
      'welcome',
      'password_reset',
      'email_verification'
    ],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  data: {
    // Additional data for the notification
    courseId: mongoose.Schema.Types.ObjectId,
    assignmentId: mongoose.Schema.Types.ObjectId,
    quizId: mongoose.Schema.Types.ObjectId,
    lessonId: mongoose.Schema.Types.ObjectId,
    forumTopicId: mongoose.Schema.Types.ObjectId,
    forumPostId: mongoose.Schema.Types.ObjectId,
    senderId: mongoose.Schema.Types.ObjectId,
    url: String, // Link to relevant page
    actionText: String, // Call-to-action text
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    }
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'read'],
    default: 'pending'
  },
  deliveryMethod: {
    email: {
      type: Boolean,
      default: true
    },
    inApp: {
      type: Boolean,
      default: true
    },
    sms: {
      type: Boolean,
      default: false
    }
  },
  sentAt: {
    type: Date,
    default: null
  },
  readAt: {
    type: Date,
    default: null
  },
  emailSent: {
    type: Boolean,
    default: false
  },
  emailError: {
    type: String,
    default: null
  },
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
notificationSchema.index({ recipient: 1, status: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ type: 1, status: 1 });
notificationSchema.index({ 'data.priority': 1, createdAt: 1 });
notificationSchema.index({ status: 'pending', createdAt: 1 });

// Virtual for notification age
notificationSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Virtual for is read
notificationSchema.virtual('isRead').get(function() {
  return this.status === 'read';
});

// Virtual for is urgent
notificationSchema.virtual('isUrgent').get(function() {
  return this.data.priority === 'urgent';
});

// Pre-save middleware
notificationSchema.pre('save', function(next) {
  // Set priority based on type
  if (!this.data.priority) {
    switch (this.type) {
      case 'assignment_due':
      case 'quiz_available':
        this.data.priority = 'high';
        break;
      case 'system_announcement':
      case 'password_reset':
        this.data.priority = 'urgent';
        break;
      case 'forum_reply':
      case 'forum_mention':
        this.data.priority = 'low';
        break;
      default:
        this.data.priority = 'medium';
    }
  }
  
  next();
});

// Method to mark as read
notificationSchema.methods.markAsRead = function() {
  this.status = 'read';
  this.readAt = new Date();
  return this.save();
};

// Method to mark as sent
notificationSchema.methods.markAsSent = function() {
  this.status = 'sent';
  this.sentAt = new Date();
  this.emailSent = true;
  return this.save();
};

// Method to mark as failed
notificationSchema.methods.markAsFailed = function(error) {
  this.status = 'failed';
  this.emailError = error;
  this.retryCount += 1;
  return this.save();
};

// Method to retry sending
notificationSchema.methods.retry = function() {
  if (this.retryCount < this.maxRetries) {
    this.status = 'pending';
    this.emailError = null;
    return this.save();
  }
  return Promise.reject(new Error('Max retries exceeded'));
};

// Static method to create notification
notificationSchema.statics.createNotification = async function(data) {
  const notification = new this(data);
  await notification.save();
  return notification;
};

// Static method to get user notifications
notificationSchema.statics.getUserNotifications = async function(userId, options = {}) {
  const {
    status,
    type,
    limit = 20,
    skip = 0,
    unreadOnly = false
  } = options;

  let query = { recipient: userId };

  if (status) query.status = status;
  if (type) query.type = type;
  if (unreadOnly) query.status = { $ne: 'read' };

  const notifications = await this.find(query)
    .populate('recipient', 'firstName lastName email')
    .populate('data.senderId', 'firstName lastName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return notifications;
};

// Static method to get pending notifications for email sending
notificationSchema.statics.getPendingEmailNotifications = async function(limit = 50) {
  return this.find({
    status: 'pending',
    'deliveryMethod.email': true,
    emailSent: false,
    retryCount: { $lt: '$maxRetries' }
  })
  .populate('recipient', 'firstName lastName email')
  .sort({ 'data.priority': -1, createdAt: 1 })
  .limit(limit);
};

// Static method to get notification statistics
notificationSchema.statics.getNotificationStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { recipient: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const total = await this.countDocuments({ recipient: userId });
  const unread = await this.countDocuments({ 
    recipient: userId, 
    status: { $ne: 'read' } 
  });

  return {
    total,
    unread,
    byStatus: stats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {})
  };
};

// Static method to mark all as read
notificationSchema.statics.markAllAsRead = async function(userId) {
  return this.updateMany(
    { recipient: userId, status: { $ne: 'read' } },
    { 
      status: 'read',
      readAt: new Date()
    }
  );
};

// Static method to delete old notifications
notificationSchema.statics.cleanupOldNotifications = async function(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    status: { $in: ['read', 'sent', 'failed'] }
  });
};

module.exports = mongoose.model('Notification', notificationSchema);
