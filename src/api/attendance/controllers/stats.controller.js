import statsService from '../services/stats.service.js';

/**
 * Stats Controller (Phase 0 - Attendance Domain)
 * 
 * Handles attendance analytics and reporting
 */

class StatsController {
  /**
   * Get class attendance statistics
   * GET /api/attendance/stats/class
   * Query: ?batch=2020&semester=5&section=A&subjectId=xxx
   */
  async getClassStats(req, res, next) {
    try {
      const teacherId = req.user._id;
      const { batch, semester, section, subjectId } = req.query;
      
      if (!batch || !semester || !section || !subjectId) {
        return res.status(400).json({
          success: false,
          message: 'batch, semester, section, and subjectId are required'
        });
      }
      
      const classParams = {
        batch: parseInt(batch),
        semester: parseInt(semester),
        section,
        subjectId
      };
      
      const stats = await statsService.getClassStats(classParams, teacherId);
      
      res.status(200).json({
        success: true,
        data: { stats }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get session summary
   * GET /api/attendance/stats/session/:sessionId
   */
  async getSessionSummary(req, res, next) {
    try {
      const { sessionId } = req.params;
      
      const summary = await statsService.getSessionSummary(sessionId);
      
      res.status(200).json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get low attendance students
   * GET /api/attendance/stats/low-attendance
   * Query: ?threshold=75&batch=2020&semester=5&section=A&subjectId=xxx
   */
  async getLowAttendanceStudents(req, res, next) {
    try {
      const { threshold, batch, semester, section, subjectId } = req.query;
      
      if (!threshold || !batch || !semester || !section) {
        return res.status(400).json({
          success: false,
          message: 'threshold, batch, semester, and section are required'
        });
      }
      
      const classParams = {
        batch: parseInt(batch),
        semester: parseInt(semester),
        section
      };
      
      if (subjectId) {
        classParams.subjectId = subjectId;
      }
      
      const students = await statsService.getLowAttendanceStudents(
        parseFloat(threshold),
        classParams
      );
      
      res.status(200).json({
        success: true,
        data: { students, threshold: parseFloat(threshold) }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export attendance data
   * GET /api/attendance/stats/export
   * Query: ?batch=2020&semester=5&section=A&subjectId=xxx&startDate=xxx&endDate=xxx
   */
  async exportAttendanceData(req, res, next) {
    try {
      const { batch, semester, section, subjectId, startDate, endDate } = req.query;
      
      if (!batch || !semester || !section) {
        return res.status(400).json({
          success: false,
          message: 'batch, semester, and section are required'
        });
      }
      
      const params = {
        batch: parseInt(batch),
        semester: parseInt(semester),
        section
      };
      
      if (subjectId) params.subjectId = subjectId;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      
      const data = await statsService.exportAttendanceData(params);
      
      res.status(200).json({
        success: true,
        data: { records: data, total: data.length }
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new StatsController();
