const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    required: false
  },
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: false
  },
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: false
  },
  type: {
    type: String,
    enum: ['lesson', 'assignment', 'quiz', 'course'],
    required: true
  },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed', 'failed'],
    default: 'not_started'
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  score: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  timeSpent: {
    type: Number, // in seconds
    default: 0
  },
  attempts: {
    type: Number,
    default: 0
  },
  lastAttempt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  dueDate: {
    type: Date,
    default: null
  },
  isLate: {
    type: Boolean,
    default: false
  },
  feedback: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  metadata: {
    // For lessons
    timeViewed: Number, // seconds
    sectionsCompleted: [String],
    
    // For assignments
    submissionDate: Date,
    gradeReceived: Number,
    rubricScores: [{
      criterion: String,
      score: Number,
      maxScore: Number
    }],
    
    // For quizzes
    questionsAnswered: Number,
    correctAnswers: Number,
    timeLimit: Number,
    timeUsed: Number,
    answers: [{
      questionId: mongoose.Schema.Types.ObjectId,
      answer: mongoose.Schema.Types.Mixed,
      isCorrect: Boolean,
      points: Number
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
progressSchema.index({ student: 1, course: 1 });
progressSchema.index({ student: 1, type: 1 });
progressSchema.index({ course: 1, type: 1 });
progressSchema.index({ status: 1 });
progressSchema.index({ completedAt: 1 });

// Virtual for completion status
progressSchema.virtual('isCompleted').get(function() {
  return this.status === 'completed';
});

// Virtual for overdue status
progressSchema.virtual('isOverdue').get(function() {
  if (!this.dueDate) return false;
  return new Date() > this.dueDate && this.status !== 'completed';
});

// Virtual for formatted time spent
progressSchema.virtual('formattedTimeSpent').get(function() {
  const hours = Math.floor(this.timeSpent / 3600);
  const minutes = Math.floor((this.timeSpent % 3600) / 60);
  const seconds = this.timeSpent % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
});

// Pre-save middleware to update progress and status
progressSchema.pre('save', function(next) {
  // Update status based on progress
  if (this.progress >= 100) {
    this.status = 'completed';
    if (!this.completedAt) {
      this.completedAt = new Date();
    }
  } else if (this.progress > 0) {
    this.status = 'in_progress';
  } else {
    this.status = 'not_started';
  }
  
  // Check if overdue
  if (this.dueDate && new Date() > this.dueDate && this.status !== 'completed') {
    this.isLate = true;
  }
  
  next();
});

// Method to update progress
progressSchema.methods.updateProgress = function(progress, timeSpent = 0) {
  this.progress = Math.min(100, Math.max(0, progress));
  this.timeSpent += timeSpent;
  this.lastAttempt = new Date();
  return this.save();
};

// Method to complete with score
progressSchema.methods.complete = function(score, feedback = '') {
  this.progress = 100;
  this.score = score;
  this.status = 'completed';
  this.completedAt = new Date();
  this.feedback = feedback;
  this.attempts += 1;
  return this.save();
};

// Method to record attempt
progressSchema.methods.recordAttempt = function() {
  this.attempts += 1;
  this.lastAttempt = new Date();
  return this.save();
};

// Static method to get student progress for a course
progressSchema.statics.getStudentCourseProgress = async function(studentId, courseId) {
  const progress = await this.find({
    student: studentId,
    course: courseId
  }).populate('lesson assignment quiz');
  
  const totalItems = progress.length;
  const completedItems = progress.filter(p => p.status === 'completed').length;
  const inProgressItems = progress.filter(p => p.status === 'in_progress').length;
  const notStartedItems = progress.filter(p => p.status === 'not_started').length;
  
  const averageScore = progress.length > 0 
    ? progress.reduce((sum, p) => sum + p.score, 0) / progress.length 
    : 0;
  
  const totalTimeSpent = progress.reduce((sum, p) => sum + p.timeSpent, 0);
  
  return {
    progress,
    summary: {
      totalItems,
      completedItems,
      inProgressItems,
      notStartedItems,
      completionRate: totalItems > 0 ? (completedItems / totalItems) * 100 : 0,
      averageScore,
      totalTimeSpent
    }
  };
};

// Static method to get course analytics
progressSchema.statics.getCourseAnalytics = async function(courseId) {
  const progress = await this.find({ course: courseId })
    .populate('student', 'firstName lastName email')
    .populate('lesson assignment quiz');
  
  const totalStudents = new Set(progress.map(p => p.student._id.toString())).size;
  const totalItems = progress.length;
  const completedItems = progress.filter(p => p.status === 'completed').length;
  
  const averageScores = {
    lessons: 0,
    assignments: 0,
    quizzes: 0
  };
  
  const lessonProgress = progress.filter(p => p.type === 'lesson');
  const assignmentProgress = progress.filter(p => p.type === 'assignment');
  const quizProgress = progress.filter(p => p.type === 'quiz');
  
  if (lessonProgress.length > 0) {
    averageScores.lessons = lessonProgress.reduce((sum, p) => sum + p.score, 0) / lessonProgress.length;
  }
  
  if (assignmentProgress.length > 0) {
    averageScores.assignments = assignmentProgress.reduce((sum, p) => sum + p.score, 0) / assignmentProgress.length;
  }
  
  if (quizProgress.length > 0) {
    averageScores.quizzes = quizProgress.reduce((sum, p) => sum + p.score, 0) / quizProgress.length;
  }
  
  return {
    totalStudents,
    totalItems,
    completedItems,
    completionRate: totalItems > 0 ? (completedItems / totalItems) * 100 : 0,
    averageScores,
    progress
  };
};

// Static method to get student analytics
progressSchema.statics.getStudentAnalytics = async function(studentId) {
  const progress = await this.find({ student: studentId })
    .populate('course', 'title')
    .populate('lesson assignment quiz');
  
  const totalCourses = new Set(progress.map(p => p.course._id.toString())).size;
  const totalItems = progress.length;
  const completedItems = progress.filter(p => p.status === 'completed').length;
  
  const courseProgress = {};
  progress.forEach(p => {
    const courseId = p.course._id.toString();
    if (!courseProgress[courseId]) {
      courseProgress[courseId] = {
        course: p.course,
        totalItems: 0,
        completedItems: 0,
        averageScore: 0,
        totalTimeSpent: 0
      };
    }
    
    courseProgress[courseId].totalItems += 1;
    if (p.status === 'completed') {
      courseProgress[courseId].completedItems += 1;
    }
    courseProgress[courseId].averageScore += p.score;
    courseProgress[courseId].totalTimeSpent += p.timeSpent;
  });
  
  // Calculate averages
  Object.values(courseProgress).forEach(cp => {
    cp.averageScore = cp.totalItems > 0 ? cp.averageScore / cp.totalItems : 0;
    cp.completionRate = cp.totalItems > 0 ? (cp.completedItems / cp.totalItems) * 100 : 0;
  });
  
  const totalTimeSpent = progress.reduce((sum, p) => sum + p.timeSpent, 0);
  const averageScore = totalItems > 0 ? progress.reduce((sum, p) => sum + p.score, 0) / totalItems : 0;
  
  return {
    totalCourses,
    totalItems,
    completedItems,
    completionRate: totalItems > 0 ? (completedItems / totalItems) * 100 : 0,
    averageScore,
    totalTimeSpent,
    courseProgress: Object.values(courseProgress)
  };
};

module.exports = mongoose.model('Progress', progressSchema);
