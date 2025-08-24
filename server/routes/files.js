const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { body, param, query, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { requireTeacher, requireAdmin } = require('../middleware/auth');
const File = require('../models/File');
const sharp = require('sharp');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.env.UPLOAD_PATH || './uploads', file.fieldname || 'general');
    
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = [
    // Documents
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
    
    // Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    
    // Videos
    'video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov',
    
    // Audio
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'audio/aac',
    
    // Archives
    'application/zip', 'application/x-rar-compressed', 'application/x-tar', 'application/gzip'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 10 // Max 10 files per upload
  }
});

// ==================== FILE UPLOAD ====================

// Upload single file
router.post('/upload', [
  auth,
  upload.single('file'),
  body('type').isIn(['course', 'assignment', 'profile', 'general', 'lesson', 'quiz', 'forum']).withMessage('Invalid file type'),
  body('relatedTo.model').optional().isIn(['Course', 'Assignment', 'Lesson', 'Quiz', 'ForumTopic', 'ForumPost', 'User']),
  body('relatedTo.id').optional().isMongoId(),
  body('description').optional().isLength({ max: 500 }),
  body('tags').optional().isArray(),
  body('isPublic').optional().isBoolean()
], handleValidationErrors, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimeType: req.file.mimetype,
      type: req.body.type,
      uploadedBy: req.user.id,
      description: req.body.description,
      tags: req.body.tags ? JSON.parse(req.body.tags) : [],
      isPublic: req.body.isPublic === 'true'
    };

    if (req.body.relatedTo) {
      fileData.relatedTo = {
        model: req.body.relatedTo.model,
        id: req.body.relatedTo.id
      };
    }

    // Set permissions based on file type and user role
    if (req.body.type === 'course' || req.body.type === 'lesson') {
      fileData.permissions = {
        canView: ['student', 'teacher', 'admin'],
        canDownload: ['student', 'teacher', 'admin'],
        canEdit: ['teacher', 'admin']
      };
    } else if (req.body.type === 'assignment') {
      fileData.permissions = {
        canView: ['teacher', 'admin'],
        canDownload: ['teacher', 'admin'],
        canEdit: ['teacher', 'admin']
      };
    }

    const file = new File(fileData);
    await file.save();

    // Generate thumbnail for images
    if (file.category === 'image') {
      try {
        const thumbnailPath = path.join(path.dirname(file.path), 'thumbnails');
        await fs.mkdir(thumbnailPath, { recursive: true });
        
        const thumbnailFilename = `thumb-${file.filename}`;
        const thumbnailFullPath = path.join(thumbnailPath, thumbnailFilename);
        
        await sharp(file.path)
          .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(thumbnailFullPath);
        
        file.metadata.thumbnail = thumbnailFullPath;
        await file.save();
      } catch (error) {
        console.error('Error generating thumbnail:', error);
      }
    }

    await file.populate('uploadedBy', 'firstName lastName');
    res.status(201).json(file);
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ message: 'Error uploading file' });
  }
});

// Upload multiple files
router.post('/upload-multiple', [
  auth,
  upload.array('files', 10),
  body('type').isIn(['course', 'assignment', 'profile', 'general', 'lesson', 'quiz', 'forum']),
  body('relatedTo.model').optional().isIn(['Course', 'Assignment', 'Lesson', 'Quiz', 'ForumTopic', 'ForumPost', 'User']),
  body('relatedTo.id').optional().isMongoId()
], handleValidationErrors, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const uploadedFiles = [];

    for (const file of req.files) {
      const fileData = {
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        size: file.size,
        mimeType: file.mimetype,
        type: req.body.type,
        uploadedBy: req.user.id
      };

      if (req.body.relatedTo) {
        fileData.relatedTo = {
          model: req.body.relatedTo.model,
          id: req.body.relatedTo.id
        };
      }

      const newFile = new File(fileData);
      await newFile.save();
      await newFile.populate('uploadedBy', 'firstName lastName');
      uploadedFiles.push(newFile);
    }

    res.status(201).json({ files: uploadedFiles });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ message: 'Error uploading files' });
  }
});

// ==================== FILE RETRIEVAL ====================

// Get all files (with filtering)
router.get('/', [
  query('type').optional().isIn(['course', 'assignment', 'profile', 'general', 'lesson', 'quiz', 'forum']),
  query('category').optional().isIn(['document', 'image', 'video', 'audio', 'archive', 'other']),
  query('search').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], handleValidationErrors, async (req, res) => {
  try {
    const { type, category, search, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    let query = { isActive: true };

    // Add type filter
    if (type) {
      query.type = type;
    }

    // Add category filter
    if (category) {
      query.category = category;
    }

    // Add search filter
    if (search) {
      query.$or = [
        { originalName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Add permission check for non-admin users
    if (req.user.role !== 'admin') {
      query['permissions.canView'] = req.user.role;
    }

    const files = await File.find(query)
      .populate('uploadedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await File.countDocuments(query);

    res.json({
      files,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ message: 'Error fetching files' });
  }
});

// Get files by type and related model
router.get('/by-type/:type', [
  param('type').isIn(['course', 'assignment', 'profile', 'general', 'lesson', 'quiz', 'forum']),
  query('model').optional().isIn(['Course', 'Assignment', 'Lesson', 'Quiz', 'ForumTopic', 'ForumPost', 'User']),
  query('id').optional().isMongoId()
], handleValidationErrors, async (req, res) => {
  try {
    const { type } = req.params;
    const { model, id } = req.query;

    const files = await File.getFilesByType(type, model, id, req.user.role);
    res.json(files);
  } catch (error) {
    console.error('Error fetching files by type:', error);
    res.status(500).json({ message: 'Error fetching files' });
  }
});

// Get single file
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid file ID')
], handleValidationErrors, async (req, res) => {
  try {
    const file = await File.findById(req.params.id)
      .populate('uploadedBy', 'firstName lastName');

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check permissions
    if (!file.permissions.canView.includes(req.user.role) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Increment view count
    await file.incrementView();

    res.json(file);
  } catch (error) {
    console.error('Error fetching file:', error);
    res.status(500).json({ message: 'Error fetching file' });
  }
});

// ==================== FILE DOWNLOAD ====================

// Download file
router.get('/:id/download', [
  param('id').isMongoId().withMessage('Invalid file ID')
], handleValidationErrors, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check permissions
    if (!file.permissions.canDownload.includes(req.user.role) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if file exists
    try {
      await fs.access(file.path);
    } catch (error) {
      return res.status(404).json({ message: 'File not found on disk' });
    }

    // Increment download count
    await file.incrementDownload();

    // Set headers
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.setHeader('Content-Length', file.size);

    // Stream file
    const fileStream = require('fs').createReadStream(file.path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ message: 'Error downloading file' });
  }
});

// Get file thumbnail
router.get('/:id/thumbnail', [
  param('id').isMongoId().withMessage('Invalid file ID')
], handleValidationErrors, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    if (file.category !== 'image') {
      return res.status(400).json({ message: 'File is not an image' });
    }

    // Check if thumbnail exists
    if (!file.metadata.thumbnail) {
      return res.status(404).json({ message: 'Thumbnail not available' });
    }

    try {
      await fs.access(file.metadata.thumbnail);
    } catch (error) {
      return res.status(404).json({ message: 'Thumbnail not found on disk' });
    }

    res.setHeader('Content-Type', 'image/jpeg');
    const thumbnailStream = require('fs').createReadStream(file.metadata.thumbnail);
    thumbnailStream.pipe(res);
  } catch (error) {
    console.error('Error serving thumbnail:', error);
    res.status(500).json({ message: 'Error serving thumbnail' });
  }
});

// ==================== FILE MANAGEMENT ====================

// Update file metadata
router.put('/:id', [
  auth,
  param('id').isMongoId().withMessage('Invalid file ID'),
  body('description').optional().isLength({ max: 500 }),
  body('tags').optional().isArray(),
  body('isPublic').optional().isBoolean(),
  body('permissions').optional().isObject()
], handleValidationErrors, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check if user can edit
    if (!file.permissions.canEdit.includes(req.user.role) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update fields
    if (req.body.description !== undefined) file.description = req.body.description;
    if (req.body.tags !== undefined) file.tags = req.body.tags;
    if (req.body.isPublic !== undefined) file.isPublic = req.body.isPublic;
    if (req.body.permissions !== undefined) file.permissions = req.body.permissions;

    await file.save();
    await file.populate('uploadedBy', 'firstName lastName');

    res.json(file);
  } catch (error) {
    console.error('Error updating file:', error);
    res.status(500).json({ message: 'Error updating file' });
  }
});

// Delete file
router.delete('/:id', [
  auth,
  param('id').isMongoId().withMessage('Invalid file ID')
], handleValidationErrors, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check if user can delete
    if (!file.permissions.canEdit.includes(req.user.role) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Delete file from disk
    try {
      await fs.unlink(file.path);
      
      // Delete thumbnail if exists
      if (file.metadata.thumbnail) {
        await fs.unlink(file.metadata.thumbnail);
      }
    } catch (error) {
      console.error('Error deleting file from disk:', error);
    }

    // Delete from database
    await file.remove();

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ message: 'Error deleting file' });
  }
});

// ==================== FILE SEARCH ====================

// Search files
router.get('/search', [
  query('q').trim().isLength({ min: 2 }).withMessage('Search query must be at least 2 characters'),
  query('type').optional().isIn(['course', 'assignment', 'profile', 'general', 'lesson', 'quiz', 'forum']),
  query('category').optional().isIn(['document', 'image', 'video', 'audio', 'archive', 'other']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], handleValidationErrors, async (req, res) => {
  try {
    const { q, type, category, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const filters = {};
    if (type) filters.type = type;
    if (category) filters.category = category;

    const files = await File.searchFiles(q, filters, req.user.role)
      .skip(skip)
      .limit(limit);

    const total = await File.countDocuments({
      isActive: true,
      'permissions.canView': req.user.role,
      $or: [
        { originalName: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } }
      ],
      ...filters
    });

    res.json({
      files,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error searching files:', error);
    res.status(500).json({ message: 'Error searching files' });
  }
});

module.exports = router;
