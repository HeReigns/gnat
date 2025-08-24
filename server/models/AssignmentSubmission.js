const mongoose = require('mongoose');

const assignmentSubmissionSchema = new mongoose.Schema({
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: [true, 'Assignment is required']
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student is required']
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Course is required']
  },
  submissionText: {
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
  submittedAt: {
    type: Date,
    default: Date.now
  },
  isLate: {
    type: Boolean,
    default: false
  },
  latePenalty: {
    type: Number,
    default: 0
  },
  // Grading fields
  isGraded: {
    type: Boolean,
    default: false
  },
  gradedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  gradedAt: Date,
  score: {
    type: Number,
    min: [0, 'Score cannot be negative'],
    max: [1000, 'Score cannot exceed 1000']
  },
  percentage: {
    type: Number,
    min: [0, 'Percentage cannot be negative'],
    max: [100, 'Percentage cannot exceed 100%']
  },
  grade: {
    type: String,
    enum: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F', 'P', 'NP']
  },
  feedback: {
    type: String,
    trim: true
  },
  rubricScores: [{
    criterion: String,
    points: Number,
    maxPoints: Number,
    feedback: String
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      required: true,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    isInstructor: {
      type: Boolean,
      default: false
    }
  }],
  status: {
    type: String,
    enum: ['submitted', 'graded', 'returned', 'resubmitted'],
    default: 'submitted'
  },
  attemptNumber: {
    type: Number,
    default: 1
  },
  previousSubmission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AssignmentSubmission'
  }
}, {
  timestamps: true
});

// Indexes
assignmentSubmissionSchema.index({ assignment: 1, student: 1 });
assignmentSubmissionSchema.index({ course: 1, student: 1 });
assignmentSubmissionSchema.index({ student: 1, submittedAt: -1 });
assignmentSubmissionSchema.index({ isGraded: 1, gradedAt: -1 });

// Virtual for final score after late penalty
assignmentSubmissionSchema.virtual('finalScore').get(function() {
  if (!this.score) return null;
  return Math.max(0, this.score - (this.score * this.latePenalty / 100));
});

// Virtual for final percentage after late penalty
assignmentSubmissionSchema.virtual('finalPercentage').get(function() {
  if (!this.percentage) return null;
  return Math.max(0, this.percentage - this.latePenalty);
});

// Method to calculate grade from percentage
assignmentSubmissionSchema.methods.calculateGrade = function() {
  if (!this.percentage) return null;
  
  const finalPercentage = this.finalPercentage;
  
  if (finalPercentage >= 97) return 'A+';
  if (finalPercentage >= 93) return 'A';
  if (finalPercentage >= 90) return 'A-';
  if (finalPercentage >= 87) return 'B+';
  if (finalPercentage >= 83) return 'B';
  if (finalPercentage >= 80) return 'B-';
  if (finalPercentage >= 77) return 'C+';
  if (finalPercentage >= 73) return 'C';
  if (finalPercentage >= 70) return 'C-';
  if (finalPercentage >= 67) return 'D+';
  if (finalPercentage >= 63) return 'D';
  if (finalPercentage >= 60) return 'D-';
  return 'F';
};

// Method to check if submission is on time
assignmentSubmissionSchema.methods.isOnTime = function() {
  return !this.isLate;
};

// Method to get submission status
assignmentSubmissionSchema.methods.getStatus = function() {
  if (this.status === 'returned') return 'returned';
  if (this.isGraded) return 'graded';
  return 'submitted';
};

// Pre-save middleware to calculate late penalty
assignmentSubmissionSchema.pre('save', async function(next) {
  if (this.isModified('submittedAt') || this.isNew) {
    const Assignment = mongoose.model('Assignment');
    const assignment = await Assignment.findById(this.assignment);
    
    if (assignment) {
      this.isLate = this.submittedAt > assignment.dueDate;
      this.latePenalty = assignment.calculateLatePenalty(this.submittedAt);
    }
  }
  
  if (this.isModified('score') && this.score !== null) {
    const Assignment = mongoose.model('Assignment');
    const assignment = await Assignment.findById(this.assignment);
    
    if (assignment) {
      this.percentage = (this.score / assignment.totalPoints) * 100;
      this.grade = this.calculateGrade();
    }
  }
  
  next();
});

module.exports = mongoose.model('AssignmentSubmission', assignmentSubmissionSchema);
