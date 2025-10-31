import mongoose from 'mongoose';

/**
 * AttendanceRecord Model (Phase 0)
 * 
 * Replaces the embedded attendanceRecords array in ClassSession model.
 * This standalone model provides better scalability, querying, and separation of concerns.
 * 
 * Each record represents a single student's attendance for a single class session.
 */

const attendanceRecordSchema = new mongoose.Schema({
  // --- Core References ---
  classSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassSession',
    required: true,
    index: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
    index: true
  },

  // --- Class Context ---
  batch: {
    type: Number,
    required: true,
    index: true
  },
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 8,
    index: true
  },
  section: {
    type: String,
    required: true,
    enum: ['A', 'B', 'C'],
    index: true
  },

  // --- Attendance Status ---
  status: {
    type: String,
    enum: ['present', 'absent', 'late'],
    default: 'absent',
    required: true,
    index: true
  },
  markedAt: {
    type: Date,
    default: null
  },
  markedMethod: {
    type: String,
    enum: ['code', 'manual', 'late_mark'],
    default: null
  },

  // --- Feedback Status ---
  hasSubmittedFeedback: {
    type: Boolean,
    default: false,
    index: true
  },
  feedbackSubmittedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// ============================================================================
// Indexes for Efficient Queries
// ============================================================================

// Composite index for querying all records in a session
attendanceRecordSchema.index({ classSession: 1, student: 1 }, { unique: true });

// Index for student attendance history queries
attendanceRecordSchema.index({ student: 1, subject: 1, status: 1 });

// Index for teacher session queries
attendanceRecordSchema.index({ teacher: 1, classSession: 1 });

// Index for subject-based analytics
attendanceRecordSchema.index({ subject: 1, batch: 1, semester: 1, section: 1 });

// Index for feedback tracking
attendanceRecordSchema.index({ classSession: 1, hasSubmittedFeedback: 1 });

// ============================================================================
// Instance Methods
// ============================================================================

/**
 * Mark attendance as present
 * @param {string} method - How attendance was marked ('code', 'manual', 'late_mark')
 */
attendanceRecordSchema.methods.markPresent = function(method = 'code') {
  this.status = 'present';
  this.markedAt = new Date();
  this.markedMethod = method;
  return this.save();
};

/**
 * Mark attendance manually (by teacher)
 * @param {string} status - 'present', 'absent', or 'late'
 */
attendanceRecordSchema.methods.markManually = function(status) {
  this.status = status;
  this.markedAt = new Date();
  this.markedMethod = 'manual';
  return this.save();
};

/**
 * Record feedback submission
 */
attendanceRecordSchema.methods.recordFeedbackSubmission = function() {
  this.hasSubmittedFeedback = true;
  this.feedbackSubmittedAt = new Date();
  return this.save();
};

// ============================================================================
// Static Methods
// ============================================================================

/**
 * Get attendance records for a class session
 * @param {string} classSessionId - Class session ID
 * @param {object} options - Query options
 */
attendanceRecordSchema.statics.getSessionRecords = async function(classSessionId, options = {}) {
  const query = this.find({ classSession: classSessionId });
  
  if (options.populate) {
    query.populate('student', 'name studentDetails.usn avatar');
  }
  
  if (options.status) {
    query.where('status').equals(options.status);
  }
  
  return query.sort({ 'student.name': 1 });
};

/**
 * Get student's attendance statistics for a subject
 * @param {string} studentId - Student ID
 * @param {string} subjectId - Subject ID (optional)
 */
attendanceRecordSchema.statics.getStudentStats = async function(studentId, subjectId = null) {
  const matchStage = { student: new mongoose.Types.ObjectId(studentId) };
  
  if (subjectId) {
    matchStage.subject = new mongoose.Types.ObjectId(subjectId);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: subjectId ? null : '$subject',
        totalClasses: { $sum: 1 },
        presentCount: {
          $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
        },
        lateCount: {
          $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
        },
        absentCount: {
          $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
        }
      }
    },
    {
      $project: {
        subjectId: '$_id',
        totalClasses: 1,
        presentCount: 1,
        lateCount: 1,
        absentCount: 1,
        attendancePercentage: {
          $round: [
            { $multiply: [{ $divide: ['$presentCount', '$totalClasses'] }, 100] },
            2
          ]
        }
      }
    },
    ...(subjectId ? [] : [{
      $lookup: {
        from: 'subjects',
        localField: '_id',
        foreignField: '_id',
        as: 'subjectDetails'
      }
    }])
  ]);
};

/**
 * Bulk create attendance records for a class session
 * @param {string} classSessionId - Class session ID
 * @param {array} studentIds - Array of student IDs
 * @param {object} sessionData - { teacher, subject, batch, semester, section }
 */
attendanceRecordSchema.statics.createForSession = async function(classSessionId, studentIds, sessionData) {
  const records = studentIds.map(studentId => ({
    classSession: classSessionId,
    student: studentId,
    teacher: sessionData.teacher,
    subject: sessionData.subject,
    batch: sessionData.batch,
    semester: sessionData.semester,
    section: sessionData.section,
    status: 'absent'
  }));
  
  return this.insertMany(records);
};

/**
 * Get students eligible for feedback (present but haven't submitted)
 * @param {string} classSessionId - Class session ID
 */
attendanceRecordSchema.statics.getEligibleForFeedback = async function(classSessionId) {
  return this.find({
    classSession: classSessionId,
    status: 'present',
    hasSubmittedFeedback: false
  }).populate('student', 'name studentDetails.usn');
};

/**
 * Get attendance summary for a class session
 * @param {string} classSessionId - Class session ID
 */
attendanceRecordSchema.statics.getSessionSummary = async function(classSessionId) {
  const summary = await this.aggregate([
    { $match: { classSession: new mongoose.Types.ObjectId(classSessionId) } },
    {
      $group: {
        _id: null,
        totalStudents: { $sum: 1 },
        presentCount: {
          $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
        },
        lateCount: {
          $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
        },
        absentCount: {
          $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
        },
        feedbackCount: {
          $sum: { $cond: [{ $eq: ['$hasSubmittedFeedback', true] }, 1, 0] }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalStudents: 1,
        presentCount: 1,
        lateCount: 1,
        absentCount: 1,
        feedbackCount: 1,
        attendanceRate: {
          $round: [
            { $multiply: [{ $divide: ['$presentCount', '$totalStudents'] }, 100] },
            2
          ]
        }
      }
    }
  ]);
  
  return summary[0] || {
    totalStudents: 0,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    feedbackCount: 0,
    attendanceRate: 0
  };
};

// ============================================================================
// Pre-save Hook
// ============================================================================

attendanceRecordSchema.pre('save', function(next) {
  // If marking as present/late, set markedAt if not already set
  if ((this.status === 'present' || this.status === 'late') && !this.markedAt) {
    this.markedAt = new Date();
  }
  
  // If changing from present to absent, clear markedAt
  if (this.isModified('status') && this.status === 'absent') {
    this.markedAt = null;
    this.markedMethod = null;
  }
  
  next();
});

const AttendanceRecord = mongoose.model('AttendanceRecord', attendanceRecordSchema);

export default AttendanceRecord;
