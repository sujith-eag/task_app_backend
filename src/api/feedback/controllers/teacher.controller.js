import feedbackService from '../services/feedback.service.js';
import reflectionService from '../services/reflection.service.js';

/**
 * Teacher Feedback Controller (Phase 0 - Feedback Domain)
 * 
 * Handles teacher access to feedback and reflections
 */

class TeacherFeedbackController {
  /**
   * Get aggregated feedback summary for a session
   * GET /api/feedback/teacher/sessions/:sessionId/summary
   */
  async getFeedbackSummary(req, res, next) {
    try {
      const teacherId = req.user._id;
      const { sessionId } = req.params;
      
      const summary = await feedbackService.getAggregatedFeedbackForSession(
        sessionId,
        teacherId
      );
      
      // Also get teacher's reflection if exists
      const reflection = await reflectionService.getReflection(sessionId, teacherId);
      
      res.status(200).json({
        success: true,
        data: {
          ...summary,
          teacherReflection: reflection
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get teacher's overall feedback statistics
   * GET /api/feedback/teacher/stats
   * Query: ?subjectId=xxx&startDate=xxx&endDate=xxx
   */
  async getFeedbackStats(req, res, next) {
    try {
      const teacherId = req.user._id;
      const { subjectId, startDate, endDate } = req.query;
      
      const filters = {};
      if (subjectId) filters.subjectId = subjectId;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      
      const stats = await feedbackService.getTeacherFeedbackStats(teacherId, filters);
      
      res.status(200).json({
        success: true,
        data: { stats }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create or update session reflection
   * POST /api/feedback/teacher/sessions/:sessionId/reflection
   * Body: { whatWentWell, whatCouldImprove, studentEngagement, topicsToRevisit, additionalNotes }
   */
  async upsertReflection(req, res, next) {
    try {
      const teacherId = req.user._id;
      const { sessionId } = req.params;
      const reflectionData = req.body;
      
      const reflection = await reflectionService.upsertReflection(
        sessionId,
        teacherId,
        reflectionData
      );
      
      res.status(200).json({
        success: true,
        message: 'Reflection saved successfully',
        data: { reflection }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get reflection for a session
   * GET /api/feedback/teacher/sessions/:sessionId/reflection
   */
  async getReflection(req, res, next) {
    try {
      const teacherId = req.user._id;
      const { sessionId } = req.params;
      
      const reflection = await reflectionService.getReflection(sessionId, teacherId);
      
      if (!reflection) {
        return res.status(404).json({
          success: false,
          message: 'No reflection found for this session'
        });
      }
      
      res.status(200).json({
        success: true,
        data: { reflection }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get sessions that need reflection
   * GET /api/feedback/teacher/reflections/pending
   */
  async getPendingReflections(req, res, next) {
    try {
      const teacherId = req.user._id;
      const { limit } = req.query;
      
      const sessions = await reflectionService.getSessionsNeedingReflection(
        teacherId,
        limit ? parseInt(limit) : 10
      );
      
      res.status(200).json({
        success: true,
        data: { sessions, total: sessions.length }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get reflection history
   * GET /api/feedback/teacher/reflections/history
   * Query: ?subjectId=xxx&startDate=xxx&endDate=xxx&limit=50
   */
  async getReflectionHistory(req, res, next) {
    try {
      const teacherId = req.user._id;
      const { subjectId, startDate, endDate, limit } = req.query;
      
      const filters = {};
      if (subjectId) filters.subjectId = subjectId;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (limit) filters.limit = parseInt(limit);
      
      const reflections = await reflectionService.getReflectionHistory(teacherId, filters);
      
      res.status(200).json({
        success: true,
        data: { reflections, total: reflections.length }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a reflection
   * DELETE /api/feedback/teacher/sessions/:sessionId/reflection
   */
  async deleteReflection(req, res, next) {
    try {
      const teacherId = req.user._id;
      const { sessionId } = req.params;
      
      await reflectionService.deleteReflection(sessionId, teacherId);
      
      res.status(200).json({
        success: true,
        message: 'Reflection deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get reflection analytics
   * GET /api/feedback/teacher/reflections/analytics
   * Query: ?subjectId=xxx&startDate=xxx&endDate=xxx
   */
  async getReflectionAnalytics(req, res, next) {
    try {
      const teacherId = req.user._id;
      const { subjectId, startDate, endDate } = req.query;
      
      const filters = {};
      if (subjectId) filters.subjectId = subjectId;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      
      const analytics = await reflectionService.getReflectionAnalytics(teacherId, filters);
      
      res.status(200).json({
        success: true,
        data: analytics
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new TeacherFeedbackController();
