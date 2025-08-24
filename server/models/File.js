const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    trim: true
  },
  originalName: {
    type: String,
    required: true,
    trim: true
  },
  path: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  extension: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['course', 'assignment', 'profile', 'general', 'lesson', 'quiz', 'forum'],
    required: true
  },
  category: {
    type: String,
    enum: ['document', 'image', 'video', 'audio', 'archive', 'other'],
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  relatedTo: {
    model: {
      type: String,
      enum: ['Course', 'Assignment', 'Lesson', 'Quiz', 'ForumTopic', 'ForumPost', 'User'],
      required: false
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      required: false
    }
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  viewCount: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String,
    trim: true
  }],
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  metadata: {
    width: Number, // for images
    height: Number, // for images
    duration: Number, // for videos/audio
    pages: Number, // for documents
    thumbnail: String, // path to thumbnail
  },
  permissions: {
    canView: [{
      type: String,
      enum: ['student', 'teacher', 'admin'],
      default: ['teacher', 'admin']
    }],
    canDownload: [{
      type: String,
      enum: ['student', 'teacher', 'admin'],
      default: ['teacher', 'admin']
    }],
    canEdit: [{
      type: String,
      enum: ['teacher', 'admin'],
      default: ['admin']
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
fileSchema.index({ type: 1, 'relatedTo.model': 1, 'relatedTo.id': 1 });
fileSchema.index({ uploadedBy: 1 });
fileSchema.index({ category: 1 });
fileSchema.index({ tags: 1 });
fileSchema.index({ isActive: 1 });
fileSchema.index({ createdAt: -1 });

// Virtual for file URL
fileSchema.virtual('url').get(function() {
  return `/api/files/${this._id}/download`;
});

// Virtual for thumbnail URL
fileSchema.virtual('thumbnailUrl').get(function() {
  return this.metadata.thumbnail ? `/api/files/${this._id}/thumbnail` : null;
});

// Virtual for formatted size
fileSchema.virtual('formattedSize').get(function() {
  const bytes = this.size;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
});

// Pre-save middleware to set category based on mime type
fileSchema.pre('save', function(next) {
  if (this.isModified('mimeType')) {
    const mimeType = this.mimeType.toLowerCase();
    
    if (mimeType.startsWith('image/')) {
      this.category = 'image';
    } else if (mimeType.startsWith('video/')) {
      this.category = 'video';
    } else if (mimeType.startsWith('audio/')) {
      this.category = 'audio';
    } else if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) {
      this.category = 'document';
    } else if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) {
      this.category = 'archive';
    } else {
      this.category = 'other';
    }
  }
  
  if (this.isModified('originalName')) {
    this.extension = this.originalName.split('.').pop().toLowerCase();
  }
  
  next();
});

// Method to increment download count
fileSchema.methods.incrementDownload = function() {
  this.downloadCount += 1;
  return this.save();
};

// Method to increment view count
fileSchema.methods.incrementView = function() {
  this.viewCount += 1;
  return this.save();
};

// Static method to get files by type and related model
fileSchema.statics.getFilesByType = async function(type, modelName = null, modelId = null, userRole = 'student') {
  const query = { type, isActive: true };
  
  if (modelName && modelId) {
    query['relatedTo.model'] = modelName;
    query['relatedTo.id'] = modelId;
  }
  
  // Add permission check
  query['permissions.canView'] = userRole;
  
  return this.find(query)
    .populate('uploadedBy', 'firstName lastName')
    .sort({ createdAt: -1 });
};

// Static method to search files
fileSchema.statics.searchFiles = async function(searchTerm, filters = {}, userRole = 'student') {
  const query = {
    isActive: true,
    'permissions.canView': userRole,
    $or: [
      { originalName: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } },
      { tags: { $in: [new RegExp(searchTerm, 'i')] } }
    ]
  };
  
  // Apply filters
  if (filters.type) query.type = filters.type;
  if (filters.category) query.category = filters.category;
  if (filters.uploadedBy) query.uploadedBy = filters.uploadedBy;
  
  return this.find(query)
    .populate('uploadedBy', 'firstName lastName')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model('File', fileSchema);
