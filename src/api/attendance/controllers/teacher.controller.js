import sessionService from '../services/session.service.js';
import markingService from '../services/marking.service.js';

/**
 * Teacher Controller (Phase 0 - Attendance Domain)
 * 
 * Handles teacher-facing attendance operations
 */

class TeacherController {
  /**
   * Get class creation data (teacher's assigned subjects)
   * GET /api/attendance/teacher/class-data
   */
  async getClassCreationData(req, res, next) {
    try {
      const teacherId = req.user._id;
      
      const assignments = await sessionService.getTeacherSubjects(teacherId);
      
      res.status(200).json({
        success: true,
        data: { assignments }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new class session
   * POST /api/attendance/teacher/sessions
   * Body: { subject, batch, semester, section, topic, sessionType }
   */
  async createSession(req, res, next) {
    try {
      const teacherId = req.user._id;
      const { subject, batch, semester, section, topic, sessionType } = req.body;
      
      const result = await sessionService.createSession({
        teacher: teacherId,
        subject,
        batch,
        semester,
        section,
        topic,
        sessionType
      });
      
      res.status(201).json({
        success: true,
        message: 'Class session created successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get active session for teacher
   * GET /api/attendance/teacher/active-session
   */
  async getActiveSession(req, res, next) {
    try {
      const teacherId = req.user._id;
      
      const session = await sessionService.getActiveSession(teacherId);
      
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'No active session found'
        });
      }
      
      res.status(200).json({
        success: true,
        data: session
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get session roster with attendance records
   * GET /api/attendance/teacher/sessions/:sessionId/roster
   */
  async getSessionRoster(req, res, next) {
    try {
      const teacherId = req.user._id;
      const { sessionId } = req.params;
      
      const roster = await sessionService.getSessionRoster(sessionId, teacherId);
      
      res.status(200).json({
        success: true,
        data: { roster }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update attendance manually
   * PATCH /api/attendance/teacher/records/:recordId
   * Body: { status }
   */
  async updateAttendanceRecord(req, res, next) {
    try {
      const teacherId = req.user._id;
      const { recordId } = req.params;
      const { status } = req.body;
      
      const record = await markingService.markManually(recordId, status, teacherId);
      
      // Emit socket event for real-time update
      if (req.io) {
        req.io.to(`session_${record.classSession}`).emit('attendance-updated', {
          recordId: record._id,
          studentId: record.student,
          status: record.status
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Attendance updated successfully',
        data: { record }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Bulk update attendance records
   * PATCH /api/attendance/teacher/records/bulk
   * Body: { updates: [{ recordId, status }, ...] }
   */
  async bulkUpdateAttendance(req, res, next) {
    try {
      const teacherId = req.user._id;
      const { updates } = req.body;
      
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Updates array is required'
        });
      }
      
      const records = await markingService.bulkUpdateAttendance(updates, teacherId);
      
      // Emit socket events for real-time updates
      if (req.io && records.length > 0) {
        const sessionId = records[0].classSession;
        records.forEach(record => {
          req.io.to(`session_${sessionId}`).emit('attendance-updated', {
            recordId: record._id,
            studentId: record.student,
            status: record.status
          });
        });
      }
      
      res.status(200).json({
        success: true,
        message: `${records.length} attendance records updated successfully`,
        data: { records }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Finalize session (close attendance window)
   * POST /api/attendance/teacher/sessions/:sessionId/finalize
   */
  async finalizeSession(req, res, next) {
    try {
      const teacherId = req.user._id;
      const { sessionId } = req.params;
      
      const result = await sessionService.finalizeSession(sessionId, teacherId);
      
      // Emit socket event
      if (req.io) {
        req.io.to(`session_${sessionId}`).emit('session-finalized', {
          sessionId,
          attendanceSummary: result.attendanceSummary
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Session finalized successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get teacher's session history
   * GET /api/attendance/teacher/history
   * Query: ?subjectId=xxx&batch=2020&semester=5&section=A&startDate=xxx&endDate=xxx&limit=50
   */
  async getSessionHistory(req, res, next) {
    try {
      const teacherId = req.user._id;
      const { subjectId, batch, semester, section, status, startDate, endDate, limit } = req.query;
      
      const filters = {};
      if (subjectId) filters.subjectId = subjectId;
      if (batch) filters.batch = parseInt(batch);
      if (semester) filters.semester = parseInt(semester);
      if (section) filters.section = section;
      if (status) filters.status = status;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (limit) filters.limit = parseInt(limit);
      
      const sessions = await sessionService.getTeacherHistory(teacherId, filters);
      
      res.status(200).json({
        success: true,
        data: { sessions, total: sessions.length }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Regenerate attendance code
   * POST /api/attendance/teacher/sessions/:sessionId/regenerate-code
   */
  async regenerateCode(req, res, next) {
    try {
      const teacherId = req.user._id;
      const { sessionId } = req.params;
      
      const result = await sessionService.regenerateAttendanceCode(sessionId, teacherId);
      
      // Emit socket event
      if (req.io) {
        req.io.to(`session_${sessionId}`).emit('code-regenerated', result);
      }
      
      res.status(200).json({
        success: true,
        message: 'Attendance code regenerated',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a session
   * DELETE /api/attendance/teacher/sessions/:sessionId
   */
  async deleteSession(req, res, next) {
    try {
      const teacherId = req.user._id;
      const { sessionId } = req.params;
      
      await sessionService.deleteSession(sessionId, teacherId);
      
      res.status(200).json({
        success: true,
        message: 'Session deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new TeacherController();
