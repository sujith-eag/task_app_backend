import Feedback from '../../../models/feedbackModel.js';
import TeacherSessionReflection from '../../../models/teacherSessionReflectionModel.js';
import AttendanceRecord from '../../../models/attendanceRecordModel.js';
import ClassSession from '../../../models/classSessionModel.js';
import mongoose from 'mongoose';

/**
 * Feedback Service (Phase 0 - Feedback Domain)
 * 
 * Handles student feedback submission and retrieval
 */

class FeedbackService {
  /**
   * Submit anonymous feedback for a class session
   * @param {string} studentId - Student user ID
   * @param {string} sessionId - Class session ID
   * @param {object} feedbackData - { rating, comment }
   * @returns {Promise<object>}
   */
  async submitFeedback(studentId, sessionId, feedbackData) {
    const { rating, comment } = feedbackData;
    
    // Start a transaction for atomicity
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Verify student attended the session
      const attendanceRecord = await AttendanceRecord.findOne({
        classSession: sessionId,
        student: studentId,
        status: 'present'
      }).session(session);
      
      if (!attendanceRecord) {
        throw new Error('Can only submit feedback for sessions you attended');
      }
      
      // Check if feedback already submitted
      if (attendanceRecord.hasSubmittedFeedback) {
        throw new Error('Feedback already submitted for this session');
      }
      
      // Get session details
      const classSession = await ClassSession.findById(sessionId)
        .populate('subject', 'name code')
        .populate('teacher', 'name')
        .session(session);
      
      if (!classSession) {
        throw new Error('Class session not found');
      }
      
      // Create anonymous feedback
      const feedback = await Feedback.create([{
        sessionId,
        teacher: classSession.teacher._id,
        subject: classSession.subject._id,
        batch: classSession.batch,
        semester: classSession.semester,
        section: classSession.section,
        rating,
        comment: comment || ''
      }], { session });
      
      // Update attendance record to mark feedback as submitted
      await attendanceRecord.recordFeedbackSubmission();
      
      // Commit transaction
      await session.commitTransaction();
      
      return {
        feedback: feedback[0],
        session: {
          _id: classSession._id,
          subject: classSession.subject,
          topic: classSession.topic,
          sessionType: classSession.sessionType
        }
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get sessions where student can submit feedback
   * @param {string} studentId - Student user ID
   * @returns {Promise<Array>}
   */
  async getSessionsForFeedback(studentId) {
    // Find sessions where student was present but hasn't submitted feedback
    const records = await AttendanceRecord.find({
      student: studentId,
      status: 'present',
      hasSubmittedFeedback: false
    })
      .populate({
        path: 'classSession',
        match: { status: 'completed' }, // Only completed sessions
        populate: [
          { path: 'subject', select: 'name code' },
          { path: 'teacher', select: 'name' }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(20);
    
    // Filter out records where classSession is null (not completed)
    const sessionsForFeedback = records
      .filter(record => record.classSession !== null)
      .map(record => ({
        recordId: record._id,
        session: {
          _id: record.classSession._id,
          subject: record.classSession.subject,
          teacher: record.classSession.teacher,
          topic: record.classSession.topic,
          sessionType: record.classSession.sessionType,
          date: record.classSession.createdAt
        }
      }));
    
    return sessionsForFeedback;
  }

  /**
   * Get feedback for a specific session
   * @param {string} sessionId - Class session ID
   * @returns {Promise<Array>}
   */
  async getFeedbackForSession(sessionId) {
    const feedbacks = await Feedback.find({ sessionId })
      .select('-teacher') // Exclude teacher field for anonymity
      .sort({ createdAt: -1 });
    
    return feedbacks;
  }

  /**
   * Get aggregated feedback summary for a session
   * @param {string} sessionId - Class session ID
   * @param {string} teacherId - Teacher user ID (for authorization)
   * @returns {Promise<object>}
   */
  async getAggregatedFeedbackForSession(sessionId, teacherId) {
    // Verify session belongs to teacher
    const session = await ClassSession.findOne({
      _id: sessionId,
      teacher: teacherId
    }).populate('subject', 'name code');
    
    if (!session) {
      throw new Error('Session not found or unauthorized');
    }
    
    // Get aggregated feedback statistics
    const feedbackStats = await Feedback.aggregate([
      { $match: { sessionId: new mongoose.Types.ObjectId(sessionId) } },
      {
        $group: {
          _id: null,
          totalResponses: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          ratingDistribution: {
            $push: '$rating'
          },
          comments: {
            $push: {
              $cond: [
                { $ne: ['$comment', ''] },
                '$comment',
                '$$REMOVE'
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalResponses: 1,
          averageRating: { $round: ['$averageRating', 2] },
          ratingDistribution: 1,
          comments: 1
        }
      }
    ]);
    
    const stats = feedbackStats[0] || {
      totalResponses: 0,
      averageRating: 0,
      ratingDistribution: [],
      comments: []
    };
    
    // Calculate rating breakdown (1-5 stars)
    const ratingBreakdown = {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0
    };
    
    stats.ratingDistribution.forEach(rating => {
      ratingBreakdown[rating] = (ratingBreakdown[rating] || 0) + 1;
    });
    
    return {
      session: {
        _id: session._id,
        subject: session.subject,
        topic: session.topic,
        sessionType: session.sessionType,
        date: session.createdAt
      },
      feedbackSummary: {
        totalResponses: stats.totalResponses,
        averageRating: stats.averageRating,
        ratingBreakdown,
        comments: stats.comments
      }
    };
  }

  /**
   * Get teacher's feedback statistics
   * @param {string} teacherId - Teacher user ID
   * @param {object} filters - { subjectId, startDate, endDate }
   * @returns {Promise<object>}
   */
  async getTeacherFeedbackStats(teacherId, filters = {}) {
    const matchStage = {
      teacher: new mongoose.Types.ObjectId(teacherId)
    };
    
    if (filters.subjectId) {
      matchStage.subject = new mongoose.Types.ObjectId(filters.subjectId);
    }
    
    if (filters.startDate || filters.endDate) {
      matchStage.createdAt = {};
      if (filters.startDate) matchStage.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) matchStage.createdAt.$lte = new Date(filters.endDate);
    }
    
    const stats = await Feedback.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: filters.subjectId ? null : '$subject',
          totalFeedbacks: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          ratingBreakdown: {
            $push: '$rating'
          }
        }
      },
      {
        $project: {
          subjectId: '$_id',
          totalFeedbacks: 1,
          averageRating: { $round: ['$averageRating', 2] },
          ratingBreakdown: 1
        }
      },
      ...(filters.subjectId ? [] : [{
        $lookup: {
          from: 'subjects',
          localField: '_id',
          foreignField: '_id',
          as: 'subjectDetails'
        }
      }])
    ]);
    
    // Calculate rating breakdown for each subject
    const processedStats = stats.map(stat => {
      const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      stat.ratingBreakdown.forEach(rating => {
        ratingBreakdown[rating] = (ratingBreakdown[rating] || 0) + 1;
      });
      
      return {
        ...stat,
        ratingBreakdown,
        subjectDetails: stat.subjectDetails ? stat.subjectDetails[0] : null
      };
    });
    
    return processedStats;
  }
}

export default new FeedbackService();
