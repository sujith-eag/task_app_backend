import ClassSession from '../../../models/classSessionModel.js';
import AttendanceRecord from '../../../models/attendanceRecordModel.js';
import User from '../../../models/userModel.js';
import Subject from '../../../models/subjectModel.js';

/**
 * Session Service (Phase 0 - Attendance Domain)
 * 
 * Handles class session creation, management, and lifecycle
 */

class SessionService {
  /**
   * Generate a random 8-digit attendance code
   * @returns {string}
   */
  generateAttendanceCode() {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  }

  /**
   * Get teacher's assigned subjects
   * @param {string} teacherId - Teacher user ID
   * @returns {Promise<Array>}
   */
  async getTeacherSubjects(teacherId) {
    const teacher = await User.findById(teacherId)
      .select('teacherDetails.assignments')
      .populate('teacherDetails.assignments.subject');
    
    if (!teacher || !teacher.teacherDetails) {
      throw new Error('Teacher not found or invalid role');
    }
    
    return teacher.teacherDetails.assignments;
  }

  /**
   * Verify teacher is assigned to teach a subject
   * @param {string} teacherId - Teacher user ID
   * @param {string} subjectId - Subject ID
   * @param {number} batch - Batch year
   * @param {number} semester - Semester number
   * @param {string} section - Section letter
   * @returns {Promise<boolean>}
   */
  async verifyTeacherAssignment(teacherId, subjectId, batch, semester, section) {
    const teacher = await User.findById(teacherId);
    if (!teacher || !teacher.teacherDetails) return false;
    
    const assignment = teacher.teacherDetails.assignments.find(a =>
      a.subject.toString() === subjectId &&
      a.batch === batch &&
      a.semester === semester &&
      a.section === section
    );
    
    return !!assignment;
  }

  /**
   * Get enrolled students for a class
   * @param {object} classParams - { subjectId, batch, semester, section }
   * @returns {Promise<Array>}
   */
  async getEnrolledStudents({ subjectId, batch, semester, section }) {
    const students = await User.find({
      role: 'student',
      'studentDetails.batch': batch,
      'studentDetails.semester': semester,
      'studentDetails.section': section,
      'studentDetails.subjects': subjectId
    }).select('_id name studentDetails.usn avatar');
    
    return students;
  }

  /**
   * Create a new class session
   * @param {object} sessionData - { teacher, subject, batch, semester, section, topic, sessionType }
   * @returns {Promise<object>}
   */
  async createSession(sessionData) {
    const { teacher, subject, batch, semester, section, topic, sessionType } = sessionData;
    
    // Verify teacher assignment
    const isAssigned = await this.verifyTeacherAssignment(
      teacher,
      subject,
      batch,
      semester,
      section
    );
    
    if (!isAssigned) {
      throw new Error('Teacher is not assigned to this class');
    }
    
    // Get enrolled students
    const students = await this.getEnrolledStudents({ subjectId: subject, batch, semester, section });
    
    if (students.length === 0) {
      throw new Error('No students enrolled in this class');
    }
    
    // Generate attendance code
    const attendanceCode = this.generateAttendanceCode();
    const codeExpiresAt = new Date(Date.now() + 60 * 1000); // 60 seconds
    
    // Create class session
    const session = await ClassSession.create({
      teacher,
      subject,
      batch,
      semester,
      section,
      topic,
      sessionType,
      attendanceCode,
      codeExpiresAt,
      status: 'active'
    });
    
    // Create attendance records for all enrolled students
    const studentIds = students.map(s => s._id);
    await AttendanceRecord.createForSession(session._id, studentIds, {
      teacher,
      subject,
      batch,
      semester,
      section
    });
    
    return {
      session,
      totalStudents: students.length,
      attendanceCode,
      codeExpiresAt
    };
  }

  /**
   * Get active session for a teacher
   * @param {string} teacherId - Teacher user ID
   * @returns {Promise<object|null>}
   */
  async getActiveSession(teacherId) {
    const session = await ClassSession.findOne({
      teacher: teacherId,
      status: 'active'
    })
      .populate('subject', 'name code')
      .populate('teacher', 'name email');
    
    if (!session) return null;
    
    // Get attendance summary
    const summary = await AttendanceRecord.getSessionSummary(session._id);
    
    return {
      ...session.toObject(),
      attendanceSummary: summary
    };
  }

  /**
   * Get session roster with attendance records
   * @param {string} sessionId - Class session ID
   * @param {string} teacherId - Teacher user ID (for authorization)
   * @returns {Promise<Array>}
   */
  async getSessionRoster(sessionId, teacherId) {
    // Verify session belongs to teacher
    const session = await ClassSession.findOne({
      _id: sessionId,
      teacher: teacherId
    });
    
    if (!session) {
      throw new Error('Session not found or unauthorized');
    }
    
    // Get attendance records with populated student details
    const records = await AttendanceRecord.find({ classSession: sessionId })
      .populate('student', 'name studentDetails.usn avatar')
      .sort({ 'student.name': 1 });
    
    return records;
  }

  /**
   * Finalize session (close attendance window)
   * @param {string} sessionId - Class session ID
   * @param {string} teacherId - Teacher user ID (for authorization)
   * @returns {Promise<object>}
   */
  async finalizeSession(sessionId, teacherId) {
    const session = await ClassSession.findOne({
      _id: sessionId,
      teacher: teacherId,
      status: 'active'
    });
    
    if (!session) {
      throw new Error('Session not found, already finalized, or unauthorized');
    }
    
    session.status = 'completed';
    session.endedAt = new Date();
    await session.save();
    
    const summary = await AttendanceRecord.getSessionSummary(sessionId);
    
    return {
      session,
      attendanceSummary: summary
    };
  }

  /**
   * Get teacher's session history
   * @param {string} teacherId - Teacher user ID
   * @param {object} filters - { subjectId, batch, semester, section, startDate, endDate, limit }
   * @returns {Promise<Array>}
   */
  async getTeacherHistory(teacherId, filters = {}) {
    const query = {
      teacher: teacherId
    };
    
    if (filters.subjectId) query.subject = filters.subjectId;
    if (filters.batch) query.batch = filters.batch;
    if (filters.semester) query.semester = filters.semester;
    if (filters.section) query.section = filters.section;
    if (filters.status) query.status = filters.status;
    
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }
    
    const sessions = await ClassSession.find(query)
      .populate('subject', 'name code')
      .sort({ createdAt: -1 })
      .limit(filters.limit || 50);
    
    // Add attendance summaries and reflection status
    const sessionsWithData = await Promise.all(
      sessions.map(async (session) => {
        const summary = await AttendanceRecord.getSessionSummary(session._id);
        
        return {
          ...session.toObject(),
          attendanceSummary: summary
        };
      })
    );
    
    return sessionsWithData;
  }

  /**
   * Update attendance code (regenerate if needed)
   * @param {string} sessionId - Class session ID
   * @param {string} teacherId - Teacher user ID (for authorization)
   * @returns {Promise<object>}
   */
  async regenerateAttendanceCode(sessionId, teacherId) {
    const session = await ClassSession.findOne({
      _id: sessionId,
      teacher: teacherId,
      status: 'active'
    });
    
    if (!session) {
      throw new Error('Session not found, already finalized, or unauthorized');
    }
    
    session.attendanceCode = this.generateAttendanceCode();
    session.codeExpiresAt = new Date(Date.now() + 60 * 1000);
    await session.save();
    
    return {
      attendanceCode: session.attendanceCode,
      codeExpiresAt: session.codeExpiresAt
    };
  }

  /**
   * Delete a session (and associated attendance records)
   * @param {string} sessionId - Class session ID
   * @param {string} teacherId - Teacher user ID (for authorization)
   * @returns {Promise<void>}
   */
  async deleteSession(sessionId, teacherId) {
    const session = await ClassSession.findOne({
      _id: sessionId,
      teacher: teacherId
    });
    
    if (!session) {
      throw new Error('Session not found or unauthorized');
    }
    
    // Delete all attendance records
    await AttendanceRecord.deleteMany({ classSession: sessionId });
    
    // Delete session
    await session.deleteOne();
  }
}

export default new SessionService();
