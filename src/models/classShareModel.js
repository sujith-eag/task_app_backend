import mongoose from 'mongoose';

/**
 * ClassShare Model
 * 
 * Represents a file/folder shared with a specific class (batch, semester, section, subject).
 * Supports:
 * - Multiple shares per file (share with multiple classes)
 * - Expiration dates (teacher-controlled)
 * - Manual revoke (delete share)
 * - Subject-specific sharing
 * 
 * Similar to FileShare but for class-based sharing instead of user-to-user.
 */
const classShareSchema = new mongoose.Schema(
  {
    // File or folder being shared
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
      required: true,
      index: true
    },

    // Teacher who created the share
    sharedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    // Subject context for the share
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
      index: true
    },

    // Class identification
    batch: {
      type: Number,
      required: true,
      index: true,
      min: 2020,
      max: 2035
    },

    semester: {
      type: Number,
      required: true,
      index: true,
      min: 1,
      max: 8
    },

    section: {
      type: String,
      required: true,
      index: true,
      enum: ['A', 'B', 'C'],
      uppercase: true
    },

    // Optional expiration
    expiresAt: {
      type: Date,
      default: null
    },

    // Optional description/note for the share
    description: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  {
    timestamps: true // Adds createdAt and updatedAt
  }
);

// ============================================================================
// Indexes
// ============================================================================

/**
 * Compound index for uniqueness: one file can't be shared with same class twice
 * Prevents duplicate shares to the same batch/semester/section/subject
 */
classShareSchema.index(
  { fileId: 1, batch: 1, semester: 1, section: 1, subject: 1 },
  { unique: true }
);

/**
 * Index for finding all shares for a class
 * Used when students query "what's shared with my class?"
 */
classShareSchema.index({
  batch: 1,
  semester: 1,
  section: 1,
  subject: 1
});

/**
 * Index for finding shares by teacher
 * Used for "my shared files" view
 */
classShareSchema.index({ sharedBy: 1, createdAt: -1 });

/**
 * Index for expiration cleanup cron job
 */
classShareSchema.index({ expiresAt: 1 });

// ============================================================================
// Static Methods
// ============================================================================

/**
 * Check if a file is shared with a specific class
 * 
 * @param {ObjectId|string} fileId - File ID
 * @param {Object} classDetails - { batch, semester, section, subject }
 * @returns {Promise<boolean>}
 */
classShareSchema.statics.isSharedWithClass = async function (fileId, classDetails) {
  if (!fileId || !classDetails) return false;

  const { batch, semester, section, subject } = classDetails;

  const query = {
    fileId,
    batch,
    semester,
    section,
    $or: [
      { expiresAt: null }, // No expiration
      { expiresAt: { $gt: new Date() } } // Not expired
    ]
  };

  // Include subject filter if provided
  if (subject) {
    query.subject = subject;
  }

  const exists = await this.exists(query);
  return !!exists;
};

/**
 * Find all active shares for a file
 * 
 * @param {ObjectId|string} fileId - File ID
 * @returns {Promise<Array>} Array of ClassShare documents
 */
classShareSchema.statics.findByFile = function (fileId) {
  return this.find({
    fileId,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  })
    .populate('subject', 'name subjectCode')
    .populate('sharedBy', 'name email')
    .sort({ createdAt: -1 });
};

/**
 * Find all files shared with a specific class
 * 
 * @param {Object} classDetails - { batch, semester, section, subject (optional) }
 * @returns {Promise<Array>} Array of fileIds
 */
classShareSchema.statics.getFilesSharedWithClass = async function (classDetails) {
  const { batch, semester, section, subject } = classDetails;

  const query = {
    batch,
    semester,
    section,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  };

  if (subject) {
    query.subject = subject;
  }

  const shares = await this.find(query).distinct('fileId');
  return shares;
};

/**
 * Find all shares created by a teacher
 * 
 * @param {ObjectId|string} teacherId - Teacher user ID
 * @returns {Promise<Array>} Array of ClassShare documents
 */
classShareSchema.statics.findByTeacher = function (teacherId) {
  return this.find({
    sharedBy: teacherId,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  })
    .populate('fileId', 'fileName isFolder fileType size')
    .populate('subject', 'name subjectCode')
    .sort({ createdAt: -1 });
};

/**
 * Delete expired ClassShare entries (cleanup cron job)
 * 
 * @returns {Promise<Object>} Deletion result with count
 */
classShareSchema.statics.cleanExpired = async function () {
  const now = new Date();
  const result = await this.deleteMany({
    expiresAt: { $lte: now }
  });

  return {
    deletedCount: result.deletedCount,
    cleanedAt: now
  };
};

/**
 * Get share statistics for a file
 * 
 * @param {ObjectId|string} fileId - File ID
 * @returns {Promise<Object>} Statistics
 */
classShareSchema.statics.getShareStats = async function (fileId) {
  const shares = await this.find({
    fileId,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });

  const sections = new Set(shares.map(s => s.section));
  const subjects = new Set(shares.map(s => String(s.subject)));
  const batches = new Set(shares.map(s => s.batch));

  return {
    totalShares: shares.length,
    uniqueSections: sections.size,
    uniqueSubjects: subjects.size,
    uniqueBatches: batches.size,
    shares: shares
  };
};

// ============================================================================
// Instance Methods
// ============================================================================

/**
 * Check if this share is currently active (not expired)
 * 
 * @returns {boolean}
 */
classShareSchema.methods.isActive = function () {
  if (!this.expiresAt) return true;
  return this.expiresAt > new Date();
};

/**
 * Extend expiration date
 * 
 * @param {Number} days - Number of days to extend
 * @returns {Promise<ClassShare>}
 */
classShareSchema.methods.extendExpiration = async function (days) {
  if (!this.expiresAt) {
    // If no expiration set, create one from now
    this.expiresAt = new Date();
  }
  this.expiresAt.setDate(this.expiresAt.getDate() + days);
  return await this.save();
};

// ============================================================================
// Middleware
// ============================================================================

/**
 * Pre-save validation: Ensure teacher is assigned to teach the subject
 * This validation can be added if needed, but might be better in service layer
 */
// classShareSchema.pre('save', async function(next) {
//   // Validation logic here if needed
//   next();
// });

/**
 * Post-delete hook: Could trigger notifications when share is revoked
 */
// classShareSchema.post('deleteOne', async function(doc) {
//   // Notification logic here if needed
// });

// ============================================================================
// Virtual Properties
// ============================================================================

/**
 * Virtual property for class identifier
 */
classShareSchema.virtual('classIdentifier').get(function () {
  return `Batch ${this.batch} - Sem ${this.semester} - Sec ${this.section}`;
});

// ============================================================================
// Model Export
// ============================================================================

const ClassShare = mongoose.model('ClassShare', classShareSchema);

export default ClassShare;
