const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Course title is required'],
    trim: true,
    maxlength: [100, 'Course title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Course description is required'],
    maxlength: [1000, 'Course description cannot exceed 1000 characters']
  },
  shortDescription: {
    type: String,
    maxlength: [200, 'Short description cannot exceed 200 characters']
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Instructor is required']
  },
  category: {
    type: String,
    required: [true, 'Course category is required'],
    enum: ['mathematics', 'science', 'english', 'social-studies', 'arts', 'physical-education', 'technology', 'other']
  },
  level: {
    type: String,
    required: [true, 'Course level is required'],
    enum: ['beginner', 'intermediate', 'advanced']
  },
  thumbnail: {
    type: String,
    default: ''
  },
  duration: {
    type: Number, // in minutes
    default: 0
  },
  lessons: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson'
  }],
  prerequisites: [{
    type: String,
    trim: true
  }],
  learningObjectives: [{
    type: String,
    trim: true
  }],
  tags: [{
    type: String,
    trim: true
  }],
  isPublished: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  enrollmentCount: {
    type: Number,
    default: 0
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  price: {
    type: Number,
    default: 0,
    min: 0
  },
  maxStudents: {
    type: Number,
    default: 0 // 0 means unlimited
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  certificate: {
    enabled: {
      type: Boolean,
      default: false
    },
    requirements: {
      type: String,
      default: 'Complete all lessons and assignments'
    }
  },
  settings: {
    allowDiscussion: {
      type: Boolean,
      default: true
    },
    allowDownloads: {
      type: Boolean,
      default: true
    },
    requireEnrollment: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Virtual for course status
courseSchema.virtual('status').get(function() {
  if (!this.isPublished) return 'draft';
  if (this.startDate && new Date() < this.startDate) return 'upcoming';
  if (this.endDate && new Date() > this.endDate) return 'completed';
  return 'active';
});

// Virtual for enrollment availability
courseSchema.virtual('isEnrollmentOpen').get(function() {
  if (!this.isPublished) return false;
  if (this.maxStudents > 0 && this.enrollmentCount >= this.maxStudents) return false;
  if (this.endDate && new Date() > this.endDate) return false;
  return true;
});

// Indexes for better query performance
courseSchema.index({ instructor: 1 });
courseSchema.index({ category: 1 });
courseSchema.index({ isPublished: 1 });
courseSchema.index({ isFeatured: 1 });
courseSchema.index({ 'rating.average': -1 });
courseSchema.index({ enrollmentCount: -1 });

// Pre-save middleware to update short description
courseSchema.pre('save', function(next) {
  if (this.description && !this.shortDescription) {
    this.shortDescription = this.description.substring(0, 200);
  }
  next();
});

// Method to calculate course duration from lessons
courseSchema.methods.calculateDuration = async function() {
  const Lesson = mongoose.model('Lesson');
  const lessons = await Lesson.find({ _id: { $in: this.lessons } });
  this.duration = lessons.reduce((total, lesson) => total + (lesson.duration || 0), 0);
  return this.duration;
};

// Method to update enrollment count
courseSchema.methods.updateEnrollmentCount = async function() {
  const Enrollment = mongoose.model('Enrollment');
  this.enrollmentCount = await Enrollment.countDocuments({ 
    course: this._id, 
    status: 'active' 
  });
  return this.enrollmentCount;
};

module.exports = mongoose.model('Course', courseSchema);
