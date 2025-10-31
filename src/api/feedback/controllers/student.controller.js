import feedbackService from '../services/feedback.service.js';

/**
 * Student Feedback Controller (Phase 0 - Feedback Domain)
 * 
 * Handles student feedback submission
 */

class StudentFeedbackController {
  /**
   * Submit feedback for a class session
   * POST /api/feedback/student/submit
   * Body: { sessionId, rating, comment }
   */
  async submitFeedback(req, res, next) {
    try {
      const studentId = req.user._id;
      const { sessionId, rating, comment } = req.body;
      
      const result = await feedbackService.submitFeedback(studentId, sessionId, {
        rating,
        comment
      });
      
      res.status(201).json({
        success: true,
        message: 'Feedback submitted successfully. Thank you for your input!',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get sessions where student can submit feedback
   * GET /api/feedback/student/pending
   */
  async getPendingFeedbackSessions(req, res, next) {
    try {
      const studentId = req.user._id;
      
      const sessions = await feedbackService.getSessionsForFeedback(studentId);
      
      res.status(200).json({
        success: true,
        data: { sessions, total: sessions.length }
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new StudentFeedbackController();
