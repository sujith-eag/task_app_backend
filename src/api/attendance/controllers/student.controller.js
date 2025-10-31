import markingService from '../services/marking.service.js';
import statsService from '../services/stats.service.js';

/**
 * Student Controller (Phase 0 - Attendance Domain)
 * 
 * Handles student-facing attendance operations
 */

class StudentController {
  /**
   * Mark attendance using code
   * POST /api/attendance/student/mark
   * Body: { attendanceCode }
   */
  async markAttendance(req, res, next) {
    try {
      const studentId = req.user._id;
      const { attendanceCode } = req.body;
      
      // Validate code format
      if (!markingService.validateCodeFormat(attendanceCode)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid attendance code format. Must be 8 digits.'
        });
      }
      
      const result = await markingService.markWithCode(studentId, attendanceCode);
      
      // Emit socket event for real-time update
      if (req.io) {
        req.io.to(`session_${result.session._id}`).emit('attendance-marked', {
          recordId: result.record._id,
          studentId,
          status: result.record.status,
          markedAt: result.record.markedAt
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Attendance marked successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get active sessions where student can mark attendance
   * GET /api/attendance/student/active-sessions
   */
  async getActiveSessions(req, res, next) {
    try {
      const studentId = req.user._id;
      
      const sessions = await markingService.getActiveSessionsForStudent(studentId);
      
      res.status(200).json({
        success: true,
        data: { sessions }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get student's overall attendance statistics
   * GET /api/attendance/student/stats
   */
  async getAttendanceStats(req, res, next) {
    try {
      const studentId = req.user._id;
      
      const overallStats = await statsService.getStudentOverallStats(studentId);
      const subjectStats = await statsService.getStudentStatsBySubject(studentId);
      
      res.status(200).json({
        success: true,
        data: {
          overall: overallStats,
          bySubject: subjectStats
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get student's attendance statistics for a specific subject
   * GET /api/attendance/student/stats/:subjectId
   */
  async getSubjectStats(req, res, next) {
    try {
      const studentId = req.user._id;
      const { subjectId } = req.params;
      
      const stats = await statsService.getStudentStatsBySubject(studentId);
      const subjectStats = stats.find(s => s.subjectId.toString() === subjectId);
      
      if (!subjectStats) {
        return res.status(404).json({
          success: false,
          message: 'No attendance records found for this subject'
        });
      }
      
      res.status(200).json({
        success: true,
        data: subjectStats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get student's attendance trend over time
   * GET /api/attendance/student/trend
   * Query: ?subjectId=xxx&startDate=xxx&endDate=xxx
   */
  async getAttendanceTrend(req, res, next) {
    try {
      const studentId = req.user._id;
      const { subjectId, startDate, endDate } = req.query;
      
      const dateRange = {};
      if (startDate) dateRange.startDate = startDate;
      if (endDate) dateRange.endDate = endDate;
      
      const trend = await statsService.getStudentTrend(studentId, subjectId, dateRange);
      
      res.status(200).json({
        success: true,
        data: { trend }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get student profile with attendance summary
   * GET /api/attendance/student/profile
   */
  async getProfile(req, res, next) {
    try {
      const studentId = req.user._id;
      
      // Get user details
      const user = req.user; // Already available from auth middleware
      
      // Get attendance statistics
      const overallStats = await statsService.getStudentOverallStats(studentId);
      const subjectStats = await statsService.getStudentStatsBySubject(studentId);
      
      res.status(200).json({
        success: true,
        data: {
          profile: {
            _id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            studentDetails: user.studentDetails
          },
          attendance: {
            overall: overallStats,
            bySubject: subjectStats
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new StudentController();
