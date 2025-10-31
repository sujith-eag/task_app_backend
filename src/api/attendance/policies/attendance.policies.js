import AttendanceRecord from '../../../models/attendanceRecordModel.js';
import ClassSession from '../../../models/classSessionModel.js';
import User from '../../../models/userModel.js';

/**
 * Attendance Policies (Phase 0 - Attendance Domain)
 * 
 * Authorization and business rules for attendance operations
 */

class AttendancePolicies {
  /**
   * Check if teacher can access session
   * @param {string} teacherId - Teacher user ID
   * @param {string} sessionId - Class session ID
   * @returns {Promise<boolean>}
   */
  async canAccessSession(teacherId, sessionId) {
    const session = await ClassSession.findOne({
      _id: sessionId,
      teacher: teacherId
    });
    
    return !!session;
  }

  /**
   * Check if student can mark attendance for session
   * @param {string} studentId - Student user ID
   * @param {string} sessionId - Class session ID
   * @returns {Promise<object>}
   */
  async canMarkAttendance(studentId, sessionId) {
    // Check if session exists and is active
    const session = await ClassSession.findById(sessionId);
    
    if (!session) {
      return { allowed: false, reason: 'Session not found' };
    }
    
    if (session.status !== 'active') {
      return { allowed: false, reason: 'Session is not active' };
    }
    
    if (session.codeExpiresAt < new Date()) {
      return { allowed: false, reason: 'Attendance code has expired' };
    }
    
    // Check if student is enrolled
    const record = await AttendanceRecord.findOne({
      classSession: sessionId,
      student: studentId
    });
    
    if (!record) {
      return { allowed: false, reason: 'Student not enrolled in this class' };
    }
    
    if (record.status === 'present') {
      return { allowed: false, reason: 'Attendance already marked' };
    }
    
    return { allowed: true };
  }

  /**
   * Check if teacher can update attendance record
   * @param {string} teacherId - Teacher user ID
   * @param {string} recordId - Attendance record ID
   * @returns {Promise<boolean>}
   */
  async canUpdateAttendanceRecord(teacherId, recordId) {
    const record = await AttendanceRecord.findOne({
      _id: recordId,
      teacher: teacherId
    });
    
    return !!record;
  }

  /**
   * Check if teacher is assigned to teach a class
   * @param {string} teacherId - Teacher user ID
   * @param {object} classParams - { subjectId, batch, semester, section }
   * @returns {Promise<boolean>}
   */
  async isTeacherAssignedToClass(teacherId, classParams) {
    const { subjectId, batch, semester, section } = classParams;
    
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
   * Check if student is enrolled in a class
   * @param {string} studentId - Student user ID
   * @param {object} classParams - { subjectId, batch, semester, section }
   * @returns {Promise<boolean>}
   */
  async isStudentEnrolledInClass(studentId, classParams) {
    const { subjectId, batch, semester, section } = classParams;
    
    const student = await User.findById(studentId);
    if (!student || !student.studentDetails) return false;
    
    const { studentDetails } = student;
    
    return (
      studentDetails.batch === batch &&
      studentDetails.semester === semester &&
      studentDetails.section === section &&
      studentDetails.subjects.includes(subjectId)
    );
  }

  /**
   * Check if attendance window is open
   * @param {string} sessionId - Class session ID
   * @returns {Promise<boolean>}
   */
  async isAttendanceWindowOpen(sessionId) {
    const session = await ClassSession.findById(sessionId);
    
    if (!session) return false;
    
    return (
      session.status === 'active' &&
      session.codeExpiresAt > new Date()
    );
  }

  /**
   * Validate session creation
   * @param {string} teacherId - Teacher user ID
   * @param {object} sessionData - Session creation data
   * @returns {Promise<object>}
   */
  async validateSessionCreation(teacherId, sessionData) {
    const { subject, batch, semester, section } = sessionData;
    
    // Check if teacher already has an active session
    const activeSession = await ClassSession.findOne({
      teacher: teacherId,
      status: 'active'
    });
    
    if (activeSession) {
      return {
        valid: false,
        reason: 'You already have an active session. Please finalize it before creating a new one.'
      };
    }
    
    // Check if teacher is assigned to this class
    const isAssigned = await this.isTeacherAssignedToClass(teacherId, {
      subjectId: subject,
      batch,
      semester,
      section
    });
    
    if (!isAssigned) {
      return {
        valid: false,
        reason: 'You are not assigned to teach this class'
      };
    }
    
    return { valid: true };
  }
}

export default new AttendancePolicies();
