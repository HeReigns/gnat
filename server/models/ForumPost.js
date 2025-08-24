const mongoose = require('mongoose');

const forumPostSchema = new mongoose.Schema({
  content: {
    type: String,
    required: [true, 'Post content is required'],
    trim: true
  },
  topic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumTopic',
    required: true
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
  parentPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumPost',
    default: null // for threaded replies
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editHistory: [{
    content: String,
    editedAt: {
      type: Date,
      default: Date.now
    },
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String
  }],
  isSolution: {
    type: Boolean,
    default: false // for marking best answers
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  dislikes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  reports: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      enum: ['spam', 'inappropriate', 'offensive', 'duplicate', 'other'],
      required: true
    },
    description: String,
    reportedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved'],
      default: 'pending'
    }
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
  }],
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
forumPostSchema.index({ topic: 1, createdAt: 1 });
forumPostSchema.index({ category: 1 });
forumPostSchema.index({ author: 1 });
forumPostSchema.index({ parentPost: 1 });
forumPostSchema.index({ isActive: 1 });
forumPostSchema.index({ isSolution: 1 });
forumPostSchema.index({ 'reports.status': 1 });

// Virtual for like count
forumPostSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Virtual for dislike count
forumPostSchema.virtual('dislikeCount').get(function() {
  return this.dislikes.length;
});

// Virtual for report count
forumPostSchema.virtual('reportCount').get(function() {
  return this.reports.length;
});

// Virtual for score (likes - dislikes)
forumPostSchema.virtual('score').get(function() {
  return this.likes.length - this.dislikes.length;
});

// Method to toggle like
forumPostSchema.methods.toggleLike = function(userId) {
  const likeIndex = this.likes.indexOf(userId);
  const dislikeIndex = this.dislikes.indexOf(userId);
  
  if (likeIndex > -1) {
    this.likes.splice(likeIndex, 1);
  } else {
    this.likes.push(userId);
    if (dislikeIndex > -1) {
      this.dislikes.splice(dislikeIndex, 1);
    }
  }
  
  return this.save();
};

// Method to toggle dislike
forumPostSchema.methods.toggleDislike = function(userId) {
  const likeIndex = this.likes.indexOf(userId);
  const dislikeIndex = this.dislikes.indexOf(userId);
  
  if (dislikeIndex > -1) {
    this.dislikes.splice(dislikeIndex, 1);
  } else {
    this.dislikes.push(userId);
    if (likeIndex > -1) {
      this.likes.splice(likeIndex, 1);
    }
  }
  
  return this.save();
};

// Method to report post
forumPostSchema.methods.report = function(userId, reason, description = '') {
  const existingReport = this.reports.find(report => 
    report.user.toString() === userId.toString()
  );
  
  if (existingReport) {
    existingReport.reason = reason;
    existingReport.description = description;
    existingReport.reportedAt = new Date();
  } else {
    this.reports.push({
      user: userId,
      reason,
      description,
      reportedAt: new Date()
    });
  }
  
  return this.save();
};

// Method to mark as solution
forumPostSchema.methods.markAsSolution = function() {
  this.isSolution = true;
  return this.save();
};

// Method to unmark as solution
forumPostSchema.methods.unmarkAsSolution = function() {
  this.isSolution = false;
  return this.save();
};

// Method to edit post
forumPostSchema.methods.edit = function(newContent, editedBy, reason = '') {
  // Save current content to edit history
  this.editHistory.push({
    content: this.content,
    editedAt: new Date(),
    editedBy: this.author,
    reason: reason || 'No reason provided'
  });
  
  this.content = newContent;
  this.isEdited = true;
  
  return this.save();
};

// Static method to get posts for a topic with pagination
forumPostSchema.statics.getPostsForTopic = async function(topicId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const posts = await this.find({
    topic: topicId,
    isActive: true
  })
  .populate('author', 'firstName lastName avatar role')
  .populate('parentPost', 'content author')
  .populate('mentions', 'firstName lastName')
  .sort({ createdAt: 1 })
  .skip(skip)
  .limit(limit);
  
  const total = await this.countDocuments({
    topic: topicId,
    isActive: true
  });
  
  return {
    posts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method to get replies for a post
forumPostSchema.statics.getReplies = async function(postId) {
  return this.find({
    parentPost: postId,
    isActive: true
  })
  .populate('author', 'firstName lastName avatar role')
  .populate('mentions', 'firstName lastName')
  .sort({ createdAt: 1 });
};

// Pre-save middleware to update topic statistics
forumPostSchema.pre('save', async function(next) {
  if (this.isNew) {
    const Topic = mongoose.model('ForumTopic');
    const topic = await Topic.findById(this.topic);
    if (topic) {
      await topic.updateLastActivity(this._id, this.author);
    }
  }
  next();
});

module.exports = mongoose.model('ForumPost', forumPostSchema);

