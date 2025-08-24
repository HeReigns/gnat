const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Lesson title is required'],
    trim: true,
    maxlength: [100, 'Lesson title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Lesson description is required'],
    maxlength: [500, 'Lesson description cannot exceed 500 characters']
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Course is required']
  },
  order: {
    type: Number,
    required: [true, 'Lesson order is required'],
    min: 1
  },
  content: {
    type: {
      type: String,
      enum: ['text', 'video', 'document', 'quiz', 'assignment', 'mixed'],
      default: 'text'
    },
    text: {
      type: String,
      maxlength: [10000, 'Text content cannot exceed 10000 characters']
    },
    video: {
      url: String,
      duration: Number, // in seconds
      thumbnail: String
    },
    documents: [{
      name: String,
      url: String,
      size: Number,
      type: String
    }],
    attachments: [{
      name: String,
      url: String,
      size: Number,
      type: String
    }]
  },
  duration: {
    type: Number, // in minutes
    default: 0
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  isFree: {
    type: Boolean,
    default: false
  },
  learningObjectives: [{
    type: String,
    trim: true
  }],
  prerequisites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson'
  }],
  resources: [{
    title: String,
    url: String,
    description: String,
    type: {
      type: String,
      enum: ['link', 'document', 'video', 'other']
    }
  }],
  notes: {
    type: String,
    maxlength: [2000, 'Notes cannot exceed 2000 characters']
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
    requireCompletion: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Virtual for lesson status
lessonSchema.virtual('status').get(function() {
  return this.isPublished ? 'published' : 'draft';
});

// Indexes for better query performance
lessonSchema.index({ course: 1, order: 1 });
lessonSchema.index({ course: 1, isPublished: 1 });
lessonSchema.index({ 'content.type': 1 });

// Pre-save middleware to validate order uniqueness within course
lessonSchema.pre('save', async function(next) {
  if (this.isModified('order') || this.isModified('course')) {
    const Lesson = mongoose.model('Lesson');
    const existingLesson = await Lesson.findOne({
      course: this.course,
      order: this.order,
      _id: { $ne: this._id }
    });
    
    if (existingLesson) {
      return next(new Error('Lesson order must be unique within a course'));
    }
  }
  next();
});

// Method to get next lesson
lessonSchema.methods.getNextLesson = async function() {
  const Lesson = mongoose.model('Lesson');
  return await Lesson.findOne({
    course: this.course,
    order: { $gt: this.order },
    isPublished: true
  }).sort({ order: 1 });
};

// Method to get previous lesson
lessonSchema.methods.getPreviousLesson = async function() {
  const Lesson = mongoose.model('Lesson');
  return await Lesson.findOne({
    course: this.course,
    order: { $lt: this.order },
    isPublished: true
  }).sort({ order: -1 });
};

// Method to calculate lesson duration
lessonSchema.methods.calculateDuration = function() {
  let duration = 0;
  
  if (this.content.video && this.content.video.duration) {
    duration += Math.ceil(this.content.video.duration / 60); // Convert seconds to minutes
  }
  
  if (this.content.text) {
    // Estimate reading time (average 200 words per minute)
    const wordCount = this.content.text.split(/\s+/).length;
    duration += Math.ceil(wordCount / 200);
  }
  
  if (this.content.documents && this.content.documents.length > 0) {
    // Estimate 5 minutes per document
    duration += this.content.documents.length * 5;
  }
  
  this.duration = duration;
  return duration;
};

module.exports = mongoose.model('Lesson', lessonSchema);
