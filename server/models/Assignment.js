const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Assignment title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Assignment description is required'],
    trim: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Course is required']
  },
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson'
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Instructor is required']
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  totalPoints: {
    type: Number,
    required: [true, 'Total points is required'],
    min: [1, 'Total points must be at least 1'],
    max: [1000, 'Total points cannot exceed 1000']
  },
  instructions: {
    type: String,
    trim: true
  },
  attachments: [{
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  submissionType: {
    type: String,
    enum: ['text', 'file', 'both'],
    default: 'text'
  },
  maxFileSize: {
    type: Number,
    default: 10 * 1024 * 1024 // 10MB
  },
  allowedFileTypes: [{
    type: String,
    enum: ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'zip', 'rar']
  }],
  maxSubmissions: {
    type: Number,
    default: 1
  },
  allowLateSubmission: {
    type: Boolean,
    default: false
  },
  latePenalty: {
    type: Number,
    default: 0,
    min: [0, 'Late penalty cannot be negative'],
    max: [100, 'Late penalty cannot exceed 100%']
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  isGraded: {
    type: Boolean,
    default: false
  },
  rubric: [{
    criterion: {
      type: String,
      required: true
    },
    points: {
      type: Number,
      required: true,
      min: 0
    },
    description: String
  }],
  settings: {
    allowComments: {
      type: Boolean,
      default: true
    },
    showGrades: {
      type: Boolean,
      default: true
    },
    requireSubmission: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Indexes
assignmentSchema.index({ course: 1, dueDate: 1 });
assignmentSchema.index({ instructor: 1, createdAt: -1 });
assignmentSchema.index({ isPublished: 1, dueDate: 1 });

// Virtual for status
assignmentSchema.virtual('status').get(function() {
  const now = new Date();
  if (!this.isPublished) return 'draft';
  if (now > this.dueDate) return 'overdue';
  return 'active';
});

// Virtual for time remaining
assignmentSchema.virtual('timeRemaining').get(function() {
  const now = new Date();
  const timeDiff = this.dueDate - now;
  if (timeDiff <= 0) return 0;
  return timeDiff;
});

// Method to check if assignment is overdue
assignmentSchema.methods.isOverdue = function() {
  return new Date() > this.dueDate;
};

// Method to calculate late penalty
assignmentSchema.methods.calculateLatePenalty = function(submissionDate) {
  if (!this.allowLateSubmission || !this.latePenalty) return 0;
  if (submissionDate <= this.dueDate) return 0;
  
  const daysLate = Math.ceil((submissionDate - this.dueDate) / (1000 * 60 * 60 * 24));
  return Math.min(this.latePenalty, daysLate * 5); // 5% per day, max 100%
};

module.exports = mongoose.model('Assignment', assignmentSchema);
