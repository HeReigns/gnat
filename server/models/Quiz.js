const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Quiz title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Quiz description is required'],
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
  questions: [{
    questionText: {
      type: String,
      required: true,
      trim: true
    },
    questionType: {
      type: String,
      enum: ['multiple-choice', 'true-false', 'short-answer', 'essay', 'matching', 'fill-blank'],
      required: true
    },
    points: {
      type: Number,
      required: true,
      min: [1, 'Points must be at least 1'],
      default: 1
    },
    options: [{
      text: String,
      isCorrect: Boolean,
      explanation: String
    }],
    correctAnswer: String, // For short-answer, essay, fill-blank
    correctAnswers: [String], // For multiple correct answers
    matchingPairs: [{
      left: String,
      right: String
    }],
    fillBlanks: [{
      text: String,
      answer: String,
      caseSensitive: {
        type: Boolean,
        default: false
      }
    }],
    explanation: String,
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium'
    },
    tags: [String]
  }],
  totalPoints: {
    type: Number,
    required: true,
    min: [1, 'Total points must be at least 1']
  },
  timeLimit: {
    type: Number, // in minutes, 0 = no time limit
    min: [0, 'Time limit cannot be negative'],
    default: 0
  },
  passingScore: {
    type: Number,
    min: [0, 'Passing score cannot be negative'],
    max: [100, 'Passing score cannot exceed 100%'],
    default: 60
  },
  maxAttempts: {
    type: Number,
    min: [1, 'Max attempts must be at least 1'],
    default: 1
  },
  shuffleQuestions: {
    type: Boolean,
    default: false
  },
  shuffleOptions: {
    type: Boolean,
    default: false
  },
  showCorrectAnswers: {
    type: Boolean,
    default: true
  },
  showExplanations: {
    type: Boolean,
    default: true
  },
  allowReview: {
    type: Boolean,
    default: true
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  settings: {
    requirePassword: {
      type: Boolean,
      default: false
    },
    password: String,
    allowBacktracking: {
      type: Boolean,
      default: true
    },
    showProgress: {
      type: Boolean,
      default: true
    },
    showTimer: {
      type: Boolean,
      default: true
    },
    autoSubmit: {
      type: Boolean,
      default: true
    },
    preventCheating: {
      type: Boolean,
      default: false
    }
  },
  statistics: {
    totalAttempts: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0
    },
    passRate: {
      type: Number,
      default: 0
    },
    completionRate: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes
quizSchema.index({ course: 1, startDate: 1 });
quizSchema.index({ instructor: 1, createdAt: -1 });
quizSchema.index({ isPublished: 1, isActive: 1 });

// Virtual for status
quizSchema.virtual('status').get(function() {
  const now = new Date();
  if (!this.isPublished) return 'draft';
  if (!this.isActive) return 'inactive';
  if (now < this.startDate) return 'scheduled';
  if (now > this.endDate) return 'expired';
  return 'active';
});

// Virtual for time remaining
quizSchema.virtual('timeRemaining').get(function() {
  const now = new Date();
  const timeDiff = this.endDate - now;
  if (timeDiff <= 0) return 0;
  return timeDiff;
});

// Method to check if quiz is active
quizSchema.methods.isActive = function() {
  const now = new Date();
  return this.isPublished && this.isActive && now >= this.startDate && now <= this.endDate;
};

// Method to check if quiz is available
quizSchema.methods.isAvailable = function() {
  const now = new Date();
  return this.isPublished && this.isActive && now >= this.startDate && now <= this.endDate;
};

// Method to calculate total points
quizSchema.methods.calculateTotalPoints = function() {
  return this.questions.reduce((total, question) => total + question.points, 0);
};

// Pre-save middleware to calculate total points
quizSchema.pre('save', function(next) {
  if (this.questions && this.questions.length > 0) {
    this.totalPoints = this.calculateTotalPoints();
  }
  next();
});

// Method to shuffle questions
quizSchema.methods.shuffleQuestions = function() {
  if (this.shuffleQuestions) {
    this.questions = this.questions.sort(() => Math.random() - 0.5);
  }
  return this.questions;
};

// Method to shuffle options for multiple choice questions
quizSchema.methods.shuffleOptions = function() {
  if (this.shuffleOptions) {
    this.questions.forEach(question => {
      if (question.questionType === 'multiple-choice' && question.options) {
        question.options = question.options.sort(() => Math.random() - 0.5);
      }
    });
  }
  return this.questions;
};

module.exports = mongoose.model('Quiz', quizSchema);
