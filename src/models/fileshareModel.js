import mongoose from 'mongoose';

/**
 * FileShare Model
 * 
 * Handles all file sharing functionality:
 * - Public share links (code-based access)
 * - Direct user shares (specific users)
 * - Class shares (batch/semester/section groups)
 * 
 * This model separates sharing concerns from the File model,
 * following the Phase 0 architecture principle of domain separation.
 */

const fileShareSchema = new mongoose.Schema(
  {
    // ========================================
    // Core Fields
    // ========================================

    /**
     * Reference to the shared file
     */
    file: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'File',
      index: true,
    },

    /**
     * Owner of the file (denormalized for query performance)
     */
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      index: true,
    },

    /**
     * Type of share
     */
    shareType: {
      type: String,
      enum: ['public', 'direct', 'class'],
      required: true,
      index: true,
    },

    // ========================================
    // Public Share Fields
    // ========================================

    /**
     * Public share code (8-character hex)
     * Only populated for shareType: 'public'
     */
    publicCode: {
      type: String,
      unique: true,
      sparse: true, // Allows null values, only enforces uniqueness on non-null
      index: true,
    },

    /**
     * Whether public share is active
     */
    isActive: {
      type: Boolean,
      default: true,
    },

    /**
     * Public share expiration date
     */
    expiresAt: {
      type: Date,
      index: true,
    },

    // ========================================
    // Direct Share Fields
    // ========================================

    /**
     * User this file is shared with (for direct shares)
     * Only populated for shareType: 'direct'
     */
    sharedWith: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    // ========================================
    // Class Share Fields
    // ========================================

    /**
     * Subject for class share (for teachers sharing with students)
     * Only populated for shareType: 'class'
     */
    classShare: {
      subject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
      },
      batch: {
        type: Number,
      },
      semester: {
        type: Number,
      },
      section: {
        type: String,
      },
    },

    // ========================================
    // Metadata
    // ========================================

    /**
     * Number of times this share has been accessed/downloaded
     */
    accessCount: {
      type: Number,
      default: 0,
    },

    /**
     * Last time this share was accessed
     */
    lastAccessedAt: {
      type: Date,
    },

    /**
     * User who created this share (may differ from owner in future features)
     */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// ============================================================================
// Indexes for Performance
// ============================================================================

// Compound index for finding shares by file and type
fileShareSchema.index({ file: 1, shareType: 1 });

// Compound index for direct shares lookup
fileShareSchema.index({ file: 1, sharedWith: 1 });

// Compound index for class shares lookup
fileShareSchema.index({
  'classShare.subject': 1,
  'classShare.batch': 1,
  'classShare.semester': 1,
  'classShare.section': 1,
});

// Compound index for active public shares
fileShareSchema.index({
  shareType: 1,
  isActive: 1,
  expiresAt: 1,
});

// ============================================================================
// Instance Methods
// ============================================================================

/**
 * Check if share is currently valid (not expired)
 */
fileShareSchema.methods.isValid = function () {
  if (this.shareType === 'public') {
    return (
      this.isActive &&
      (!this.expiresAt || this.expiresAt > new Date())
    );
  }

  if (this.shareType === 'direct') {
    return !this.expiresAt || this.expiresAt > new Date();
  }

  if (this.shareType === 'class') {
    return true; // Class shares don't expire by default
  }

  return false;
};

/**
 * Increment access count and update last accessed time
 */
fileShareSchema.methods.recordAccess = async function () {
  this.accessCount += 1;
  this.lastAccessedAt = new Date();
  return await this.save();
};

/**
 * Deactivate a share (for public shares)
 */
fileShareSchema.methods.deactivate = async function () {
  if (this.shareType === 'public') {
    this.isActive = false;
    return await this.save();
  }
  throw new Error('Only public shares can be deactivated. Others should be deleted.');
};

// ============================================================================
// Static Methods
// ============================================================================

/**
 * Find all shares for a file
 */
fileShareSchema.statics.findByFile = function (fileId) {
  return this.find({ file: fileId })
    .populate('sharedWith', 'name avatar email')
    .populate('classShare.subject', 'name code')
    .sort({ createdAt: -1 });
};

/**
 * Find valid public share by code
 */
fileShareSchema.statics.findValidPublicShare = function (code) {
  return this.findOne({
    shareType: 'public',
    publicCode: code,
    isActive: true,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ],
  }).populate('file owner', 'fileName fileType size s3Key name avatar');
};

/**
 * Check if user has access to a file via any share
 */
fileShareSchema.statics.userHasAccess = async function (fileId, userId, userDetails = null) {
  // Check direct share
  const directShare = await this.findOne({
    file: fileId,
    shareType: 'direct',
    sharedWith: userId,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ],
  });

  if (directShare) return true;

  // Check class share (if user is a student)
  if (userDetails?.role === 'student' && userDetails?.studentDetails) {
    const classShare = await this.findOne({
      file: fileId,
      shareType: 'class',
      'classShare.batch': userDetails.studentDetails.batch,
      'classShare.semester': userDetails.studentDetails.semester,
      'classShare.section': userDetails.studentDetails.section,
    });

    if (classShare) return true;
  }

  return false;
};

/**
 * Get all files shared with a user
 */
fileShareSchema.statics.getFilesSharedWithUser = function (userId, userDetails = null) {
  const query = {
    $or: [
      // Direct shares
      {
        shareType: 'direct',
        sharedWith: userId,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } },
        ],
      },
    ],
  };

  // Add class share condition if student
  if (userDetails?.role === 'student' && userDetails?.studentDetails) {
    query.$or.push({
      shareType: 'class',
      'classShare.batch': userDetails.studentDetails.batch,
      'classShare.semester': userDetails.studentDetails.semester,
      'classShare.section': userDetails.studentDetails.section,
    });
  }

  return this.find(query)
    .populate('file', 'fileName fileType size isFolder parentId path createdAt')
    .populate('owner', 'name avatar')
    .sort({ createdAt: -1 });
};

/**
 * Clean up expired shares
 */
fileShareSchema.statics.cleanExpired = async function () {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() },
  });
  return result.deletedCount;
};

// ============================================================================
// Pre-save Hooks
// ============================================================================

/**
 * Validate share type specific fields
 */
fileShareSchema.pre('save', function (next) {
  if (this.shareType === 'public') {
    if (!this.publicCode) {
      return next(new Error('Public shares must have a publicCode'));
    }
    // Clear other share type fields
    this.sharedWith = undefined;
    this.classShare = undefined;
  } else if (this.shareType === 'direct') {
    if (!this.sharedWith) {
      return next(new Error('Direct shares must have a sharedWith user'));
    }
    // Clear other share type fields
    this.publicCode = undefined;
    this.classShare = undefined;
    this.isActive = true; // Direct shares don't use isActive
  } else if (this.shareType === 'class') {
    if (
      !this.classShare ||
      !this.classShare.batch ||
      !this.classShare.semester ||
      !this.classShare.section
    ) {
      return next(
        new Error('Class shares must have batch, semester, and section')
      );
    }
    // Clear other share type fields
    this.publicCode = undefined;
    this.sharedWith = undefined;
    this.isActive = true; // Class shares don't use isActive
  }

  next();
});

// ============================================================================
// Model Export
// ============================================================================

const FileShare = mongoose.model('FileShare', fileShareSchema);

export default FileShare;
