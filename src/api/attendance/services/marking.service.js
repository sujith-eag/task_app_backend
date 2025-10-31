import AttendanceRecord from '../../../models/attendanceRecordModel.js';
import ClassSession from '../../../models/classSessionModel.js';
import User from '../../../models/userModel.js';
import mongoose from 'mongoose';

/**
 * Marking Service (Phase 0 - Attendance Domain)
 * 
 * Handles attendance marking by students and manual updates by teachers
 */

class MarkingService {
  /**
   * Mark attendance using code (student-initiated)
   * @param {string} studentId - Student user ID
   * @param {string} attendanceCode - 8-digit code
   * @returns {Promise<object>}
   */
  async markWithCode(studentId, attendanceCode) {
    // Find active session with this code
    const session = await ClassSession.findOne({
      attendanceCode,
      status: 'active',
      codeExpiresAt: { $gt: new Date() }
    }).populate('subject', 'name code');
    
    if (!session) {
      throw new Error('Invalid or expired attendance code');
    }
    
    // Find the attendance record for this student
    const record = await AttendanceRecord.findOne({
      classSession: session._id,
      student: studentId
    });
    
    if (!record) {
      throw new Error('You are not enrolled in this class');
    }
    
    // Check if already marked
    if (record.status === 'present') {
      throw new Error('Attendance already marked for this session');
    }
    
    // Mark as present
    await record.markPresent('code');
    
    return {
      record,
      session: {
        _id: session._id,
        subject: session.subject,
        topic: session.topic,
        sessionType: session.sessionType
      }
    };
  }

  /**
   * Mark attendance manually (teacher-initiated)
   * @param {string} recordId - Attendance record ID
   * @param {string} status - 'present', 'absent', or 'late'
   * @param {string} teacherId - Teacher user ID (for authorization)
   * @returns {Promise<object>}
   */
  async markManually(recordId, status, teacherId) {
    const record = await AttendanceRecord.findById(recordId)
      .populate('classSession');
    
    if (!record) {
      throw new Error('Attendance record not found');
    }
    
    // Verify teacher authorization
    if (record.teacher.toString() !== teacherId) {
      throw new Error('Unauthorized to modify this attendance record');
    }
    
    // Update status
    await record.markManually(status);
    
    return record;
  }

  /**
   * Bulk update attendance records
   * @param {Array} updates - Array of { recordId, status }
   * @param {string} teacherId - Teacher user ID (for authorization)
   * @returns {Promise<Array>}
   */
  async bulkUpdateAttendance(updates, teacherId) {
    const recordIds = updates.map(u => u.recordId);
    
    // Fetch all records and verify authorization
    const records = await AttendanceRecord.find({
      _id: { $in: recordIds },
      teacher: teacherId
    });
    
    if (records.length !== updates.length) {
      throw new Error('Some records not found or unauthorized');
    }
    
    // Create a map for quick lookup
    const updateMap = new Map(updates.map(u => [u.recordId, u.status]));
    
    // Update each record
    const promises = records.map(record => {
      const newStatus = updateMap.get(record._id.toString());
      return record.markManually(newStatus);
    });
    
    const updatedRecords = await Promise.all(promises);
    
    return updatedRecords;
  }

  /**
   * Get sessions where student can mark attendance
   * @param {string} studentId - Student user ID
   * @returns {Promise<Array>}
   */
  async getActiveSessionsForStudent(studentId) {
    // Get student details
    const student = await User.findById(studentId)
      .select('studentDetails.batch studentDetails.semester studentDetails.section studentDetails.subjects');
    
    if (!student || !student.studentDetails) {
      throw new Error('Student not found or invalid role');
    }
    
    const { batch, semester, section, subjects } = student.studentDetails;
    
    // Find active sessions for student's classes
    const sessions = await ClassSession.find({
      batch,
      semester,
      section,
      subject: { $in: subjects },
      status: 'active',
      codeExpiresAt: { $gt: new Date() }
    })
      .populate('subject', 'name code')
      .populate('teacher', 'name');
    
    // Check attendance status for each session
    const sessionsWithStatus = await Promise.all(
      sessions.map(async (session) => {
        const record = await AttendanceRecord.findOne({
          classSession: session._id,
          student: studentId
        });
        
        return {
          ...session.toObject(),
          attendanceStatus: record ? record.status : 'absent',
          canMark: record && record.status === 'absent'
        };
      })
    );
    
    return sessionsWithStatus;
  }

  /**
   * Validate attendance code format
   * @param {string} code - Attendance code
   * @returns {boolean}
   */
  validateCodeFormat(code) {
    return /^\d{8}$/.test(code);
  }
}

export default new MarkingService();
