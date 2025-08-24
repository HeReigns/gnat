const mongoose = require('mongoose');

const forumTopicSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Topic title is required'],
    trim: true,
    maxlength: [200, 'Topic title cannot exceed 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Topic content is required'],
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumCategory',
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: false // null for general topics
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],
  isSticky: {
    type: Boolean,
    default: false
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['open', 'closed', 'archived'],
    default: 'open'
  },
  type: {
    type: String,
    enum: ['discussion', 'question', 'announcement', 'poll'],
    default: 'discussion'
  },
  statistics: {
    views: {
      type: Number,
      default: 0
    },
    replies: {
      type: Number,
      default: 0
    },
    posts: {
      type: Number,
      default: 1 // includes the original post
    },
    lastReply: {
      type: Date,
      default: null
    }
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  lastPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumPost'
  },
  lastPoster: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  subscribers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  moderators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  attachments: [{
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    mimeType: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
forumTopicSchema.index({ slug: 1 });
forumTopicSchema.index({ category: 1 });
forumTopicSchema.index({ author: 1 });
forumTopicSchema.index({ course: 1 });
forumTopicSchema.index({ isActive: 1 });
forumTopicSchema.index({ isSticky: 1, lastActivity: -1 });
forumTopicSchema.index({ lastActivity: -1 });
forumTopicSchema.index({ tags: 1 });

// Virtual for URL
forumTopicSchema.virtual('url').get(function() {
  return `/forums/topic/${this.slug}`;
});

// Virtual for excerpt
forumTopicSchema.virtual('excerpt').get(function() {
  return this.content.length > 200 
    ? this.content.substring(0, 200) + '...' 
    : this.content;
});

// Pre-save middleware to generate slug
forumTopicSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Method to increment views
forumTopicSchema.methods.incrementViews = function() {
  this.statistics.views += 1;
  return this.save();
};

// Method to update last activity
forumTopicSchema.methods.updateLastActivity = function(postId, posterId) {
  this.lastActivity = new Date();
  this.lastPost = postId;
  this.lastPoster = posterId;
  this.statistics.lastReply = new Date();
  this.statistics.replies += 1;
  this.statistics.posts += 1;
  return this.save();
};

// Method to subscribe/unsubscribe
forumTopicSchema.methods.toggleSubscription = function(userId) {
  const index = this.subscribers.indexOf(userId);
  if (index > -1) {
    this.subscribers.splice(index, 1);
  } else {
    this.subscribers.push(userId);
  }
  return this.save();
};

// Static method to get topics with pagination
forumTopicSchema.statics.getTopics = async function(categoryId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const topics = await this.find({
    category: categoryId,
    isActive: true
  })
  .populate('author', 'firstName lastName avatar')
  .populate('lastPoster', 'firstName lastName')
  .populate('category', 'name slug')
  .sort({ isSticky: -1, lastActivity: -1 })
  .skip(skip)
  .limit(limit);
  
  const total = await this.countDocuments({
    category: categoryId,
    isActive: true
  });
  
  return {
    topics,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method to search topics
forumTopicSchema.statics.searchTopics = async function(query, categoryId = null, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const searchQuery = {
    isActive: true,
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { content: { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } }
    ]
  };
  
  if (categoryId) {
    searchQuery.category = categoryId;
  }
  
  const topics = await this.find(searchQuery)
    .populate('author', 'firstName lastName avatar')
    .populate('category', 'name slug')
    .sort({ lastActivity: -1 })
    .skip(skip)
    .limit(limit);
  
  const total = await this.countDocuments(searchQuery);
  
  return {
    topics,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

module.exports = mongoose.model('ForumTopic', forumTopicSchema);

