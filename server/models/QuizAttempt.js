const mongoose = require('mongoose');

const quizAttemptSchema = new mongoose.Schema({
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: [true, 'Quiz is required']
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
  attemptNumber: {
    type: Number,
    required: true,
    default: 1
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date,
  timeSpent: {
    type: Number, // in seconds
    default: 0
  },
  answers: [{
    questionIndex: {
      type: Number,
      required: true
    },
    questionType: {
      type: String,
      required: true,
      enum: ['multiple-choice', 'true-false', 'short-answer', 'essay', 'matching', 'fill-blank']
    },
    selectedOptions: [Number], // For multiple choice, true-false
    textAnswer: String, // For short-answer, essay
    matchingAnswers: [{
      leftIndex: Number,
      rightIndex: Number
    }], // For matching questions
    fillBlankAnswers: [String], // For fill-in-the-blank
    isCorrect: Boolean,
    pointsEarned: {
      type: Number,
      default: 0
    },
    feedback: String,
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    gradedAt: Date
  }],
  totalScore: {
    type: Number,
    default: 0
  },
  percentage: {
    type: Number,
    default: 0
  },
  grade: {
    type: String,
    enum: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F', 'P', 'NP']
  },
  isPassed: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'abandoned', 'timeout'],
    default: 'in-progress'
  },
  isGraded: {
    type: Boolean,
    default: false
  },
  gradedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  gradedAt: Date,
  feedback: String,
  ipAddress: String,
  userAgent: String,
  // For cheating prevention
  tabSwitches: {
    type: Number,
    default: 0
  },
  fullscreenExits: {
    type: Number,
    default: 0
  },
  suspiciousActivity: {
    type: Boolean,
    default: false
  },
  notes: String
}, {
  timestamps: true
});

// Indexes
quizAttemptSchema.index({ quiz: 1, student: 1 });
quizAttemptSchema.index({ course: 1, student: 1 });
quizAttemptSchema.index({ student: 1, startedAt: -1 });
quizAttemptSchema.index({ status: 1, completedAt: -1 });

// Virtual for duration
quizAttemptSchema.virtual('duration').get(function() {
  if (!this.completedAt) return null;
  return this.completedAt - this.startedAt;
});

// Virtual for time remaining
quizAttemptSchema.virtual('timeRemaining').get(function() {
  if (!this.quiz || !this.quiz.timeLimit) return null;
  const elapsed = this.timeSpent || 0;
  const timeLimit = this.quiz.timeLimit * 60; // Convert to seconds
  return Math.max(0, timeLimit - elapsed);
});

// Method to check if attempt is in progress
quizAttemptSchema.methods.isInProgress = function() {
  return this.status === 'in-progress';
};

// Method to check if attempt is completed
quizAttemptSchema.methods.isCompleted = function() {
  return this.status === 'completed';
};

// Method to calculate score
quizAttemptSchema.methods.calculateScore = function() {
  let totalScore = 0;
  let totalPossible = 0;

  this.answers.forEach(answer => {
    if (answer.isCorrect !== undefined) {
      totalScore += answer.pointsEarned || 0;
    }
    // For questions that need manual grading, we'll calculate later
  });

  return {
    score: totalScore,
    percentage: this.quiz ? (totalScore / this.quiz.totalPoints) * 100 : 0
  };
};

// Method to determine grade
quizAttemptSchema.methods.calculateGrade = function() {
  const percentage = this.percentage;
  
  if (percentage >= 97) return 'A+';
  if (percentage >= 93) return 'A';
  if (percentage >= 90) return 'A-';
  if (percentage >= 87) return 'B+';
  if (percentage >= 83) return 'B';
  if (percentage >= 80) return 'B-';
  if (percentage >= 77) return 'C+';
  if (percentage >= 73) return 'C';
  if (percentage >= 70) return 'C-';
  if (percentage >= 67) return 'D+';
  if (percentage >= 63) return 'D';
  if (percentage >= 60) return 'D-';
  return 'F';
};

// Method to check if passed
quizAttemptSchema.methods.checkIfPassed = function() {
  if (!this.quiz) return false;
  return this.percentage >= this.quiz.passingScore;
};

// Pre-save middleware to update completion status
quizAttemptSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }

  if (this.isModified('answers') && this.answers.length > 0) {
    const scoreData = this.calculateScore();
    this.totalScore = scoreData.score;
    this.percentage = scoreData.percentage;
    this.grade = this.calculateGrade();
    this.isPassed = this.checkIfPassed();
  }

  next();
});

// Method to auto-grade objective questions
quizAttemptSchema.methods.autoGrade = function() {
  this.answers.forEach(answer => {
    if (answer.questionType === 'multiple-choice' || answer.questionType === 'true-false') {
      // Auto-grade these question types
      const question = this.quiz.questions[answer.questionIndex];
      if (question) {
        answer.isCorrect = this.checkAnswer(answer, question);
        answer.pointsEarned = answer.isCorrect ? question.points : 0;
        answer.gradedAt = new Date();
      }
    }
  });

  // Update overall score
  const scoreData = this.calculateScore();
  this.totalScore = scoreData.score;
  this.percentage = scoreData.percentage;
  this.grade = this.calculateGrade();
  this.isPassed = this.checkIfPassed();
};

// Method to check if an answer is correct
quizAttemptSchema.methods.checkAnswer = function(answer, question) {
  switch (question.questionType) {
    case 'multiple-choice':
      return this.checkMultipleChoice(answer, question);
    case 'true-false':
      return this.checkTrueFalse(answer, question);
    case 'short-answer':
      return this.checkShortAnswer(answer, question);
    case 'fill-blank':
      return this.checkFillBlank(answer, question);
    case 'matching':
      return this.checkMatching(answer, question);
    default:
      return false; // Essay questions need manual grading
  }
};

// Helper methods for different question types
quizAttemptSchema.methods.checkMultipleChoice = function(answer, question) {
  const correctOptions = question.options
    .map((option, index) => ({ ...option, index }))
    .filter(option => option.isCorrect)
    .map(option => option.index);
  
  return JSON.stringify(answer.selectedOptions.sort()) === JSON.stringify(correctOptions.sort());
};

quizAttemptSchema.methods.checkTrueFalse = function(answer, question) {
  const correctOption = question.options.findIndex(option => option.isCorrect);
  return answer.selectedOptions[0] === correctOption;
};

quizAttemptSchema.methods.checkShortAnswer = function(answer, question) {
  if (!answer.textAnswer || !question.correctAnswer) return false;
  
  const studentAnswer = answer.textAnswer.trim().toLowerCase();
  const correctAnswer = question.correctAnswer.trim().toLowerCase();
  
  return studentAnswer === correctAnswer;
};

quizAttemptSchema.methods.checkFillBlank = function(answer, question) {
  if (!answer.fillBlankAnswers || !question.fillBlanks) return false;
  
  let correctCount = 0;
  answer.fillBlankAnswers.forEach((studentAnswer, index) => {
    const blank = question.fillBlanks[index];
    if (blank) {
      const isCorrect = blank.caseSensitive 
        ? studentAnswer === blank.answer
        : studentAnswer.toLowerCase() === blank.answer.toLowerCase();
      if (isCorrect) correctCount++;
    }
  });
  
  return correctCount === question.fillBlanks.length;
};

quizAttemptSchema.methods.checkMatching = function(answer, question) {
  if (!answer.matchingAnswers || !question.matchingPairs) return false;
  
  let correctCount = 0;
  answer.matchingAnswers.forEach(match => {
    const pair = question.matchingPairs[match.leftIndex];
    if (pair && match.rightIndex === question.matchingPairs.indexOf(pair)) {
      correctCount++;
    }
  });
  
  return correctCount === question.matchingPairs.length;
};

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
