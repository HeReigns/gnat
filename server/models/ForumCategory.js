const mongoose = require('mongoose');

const forumCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    maxlength: [100, 'Category name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Category description is required'],
    trim: true,
    maxlength: [500, 'Category description cannot exceed 500 characters']
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  icon: {
    type: String,
    default: 'forum'
  },
  color: {
    type: String,
    default: '#1976d2'
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  allowedRoles: [{
    type: String,
    enum: ['student', 'teacher', 'admin'],
    default: ['student', 'teacher', 'admin']
  }],
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: false // null for general categories
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  moderators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  statistics: {
    topicsCount: {
      type: Number,
      default: 0
    },
    postsCount: {
      type: Number,
      default: 0
    },
    lastActivity: {
      type: Date,
      default: null
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
forumCategorySchema.index({ slug: 1 });
forumCategorySchema.index({ course: 1 });
forumCategorySchema.index({ isActive: 1 });
forumCategorySchema.index({ order: 1 });

// Virtual for URL
forumCategorySchema.virtual('url').get(function() {
  return `/forums/category/${this.slug}`;
});

// Pre-save middleware to generate slug
forumCategorySchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Method to update statistics
forumCategorySchema.methods.updateStatistics = async function() {
  const Topic = mongoose.model('ForumTopic');
  const Post = mongoose.model('ForumPost');
  
  const topicsCount = await Topic.countDocuments({ category: this._id, isActive: true });
  const postsCount = await Post.countDocuments({ category: this._id, isActive: true });
  
  const lastTopic = await Topic.findOne({ category: this._id, isActive: true })
    .sort({ lastActivity: -1 })
    .select('lastActivity');
  
  this.statistics = {
    topicsCount,
    postsCount,
    lastActivity: lastTopic ? lastTopic.lastActivity : null
  };
  
  return this.save();
};

// Static method to get categories with statistics
forumCategorySchema.statics.getCategoriesWithStats = async function(userRole = 'student') {
  return this.find({
    isActive: true,
    allowedRoles: userRole
  })
  .populate('course', 'title')
  .populate('createdBy', 'firstName lastName')
  .sort({ order: 1, name: 1 });
};

module.exports = mongoose.model('ForumCategory', forumCategorySchema);

