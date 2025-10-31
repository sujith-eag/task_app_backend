import TeacherSessionReflection from '../../../models/teacherSessionReflectionModel.js';
import ClassSession from '../../../models/classSessionModel.js';
import AttendanceRecord from '../../../models/attendanceRecordModel.js';

/**
 * Reflection Service (Phase 0 - Feedback Domain)
 * 
 * Handles teacher session reflections
 */

class ReflectionService {
  /**
   * Create or update teacher's session reflection
   * @param {string} sessionId - Class session ID
   * @param {string} teacherId - Teacher user ID
   * @param {object} reflectionData - { whatWentWell, whatCouldImprove, studentEngagement, topicsToRevisit, additionalNotes }
   * @returns {Promise<object>}
   */
  async upsertReflection(sessionId, teacherId, reflectionData) {
    // Verify session belongs to teacher
    const session = await ClassSession.findOne({
      _id: sessionId,
      teacher: teacherId,
      status: 'completed'
    });
    
    if (!session) {
      throw new Error('Session not found, not completed, or unauthorized');
    }
    
    const {
      whatWentWell,
      whatCouldImprove,
      studentEngagement,
      topicsToRevisit,
      additionalNotes
    } = reflectionData;
    
    // Find existing reflection or create new one
    let reflection = await TeacherSessionReflection.findOne({ sessionId });
    
    if (reflection) {
      // Update existing reflection
      reflection.whatWentWell = whatWentWell;
      reflection.whatCouldImprove = whatCouldImprove;
      reflection.studentEngagement = studentEngagement;
      reflection.topicsToRevisit = topicsToRevisit || [];
      reflection.additionalNotes = additionalNotes || '';
      await reflection.save();
    } else {
      // Create new reflection
      reflection = await TeacherSessionReflection.create({
        sessionId,
        teacher: teacherId,
        subject: session.subject,
        batch: session.batch,
        semester: session.semester,
        section: session.section,
        whatWentWell,
        whatCouldImprove,
        studentEngagement,
        topicsToRevisit: topicsToRevisit || [],
        additionalNotes: additionalNotes || ''
      });
    }
    
    return reflection;
  }

  /**
   * Get reflection for a session
   * @param {string} sessionId - Class session ID
   * @param {string} teacherId - Teacher user ID (for authorization)
   * @returns {Promise<object|null>}
   */
  async getReflection(sessionId, teacherId) {
    // Verify session belongs to teacher
    const session = await ClassSession.findOne({
      _id: sessionId,
      teacher: teacherId
    });
    
    if (!session) {
      throw new Error('Session not found or unauthorized');
    }
    
    const reflection = await TeacherSessionReflection.findOne({ sessionId })
      .populate('subject', 'name code');
    
    return reflection;
  }

  /**
   * Get sessions that need reflection
   * @param {string} teacherId - Teacher user ID
   * @param {number} limit - Number of sessions to return
   * @returns {Promise<Array>}
   */
  async getSessionsNeedingReflection(teacherId, limit = 10) {
    // Get completed sessions without reflections
    const sessions = await ClassSession.find({
      teacher: teacherId,
      status: 'completed'
    })
      .populate('subject', 'name code')
      .sort({ createdAt: -1 })
      .limit(limit * 2); // Get more to filter
    
    const sessionIds = sessions.map(s => s._id);
    
    // Get existing reflections
    const existingReflections = await TeacherSessionReflection.find({
      sessionId: { $in: sessionIds }
    }).select('sessionId');
    
    const reflectedSessionIds = new Set(
      existingReflections.map(r => r.sessionId.toString())
    );
    
    // Filter sessions without reflections
    const sessionsWithoutReflection = sessions
      .filter(session => !reflectedSessionIds.has(session._id.toString()))
      .slice(0, limit);
    
    // Get attendance summaries
    const sessionsWithSummary = await Promise.all(
      sessionsWithoutReflection.map(async (session) => {
        const summary = await AttendanceRecord.getSessionSummary(session._id);
        return {
          ...session.toObject(),
          attendanceSummary: summary,
          hasReflection: false
        };
      })
    );
    
    return sessionsWithSummary;
  }

  /**
   * Get teacher's reflection history
   * @param {string} teacherId - Teacher user ID
   * @param {object} filters - { subjectId, startDate, endDate, limit }
   * @returns {Promise<Array>}
   */
  async getReflectionHistory(teacherId, filters = {}) {
    const query = {
      teacher: teacherId
    };
    
    if (filters.subjectId) {
      query.subject = filters.subjectId;
    }
    
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }
    
    const reflections = await TeacherSessionReflection.find(query)
      .populate('subject', 'name code')
      .populate({
        path: 'sessionId',
        select: 'topic sessionType createdAt'
      })
      .sort({ createdAt: -1 })
      .limit(filters.limit || 50);
    
    return reflections;
  }

  /**
   * Delete a reflection
   * @param {string} sessionId - Class session ID
   * @param {string} teacherId - Teacher user ID (for authorization)
   * @returns {Promise<void>}
   */
  async deleteReflection(sessionId, teacherId) {
    const reflection = await TeacherSessionReflection.findOne({
      sessionId,
      teacher: teacherId
    });
    
    if (!reflection) {
      throw new Error('Reflection not found or unauthorized');
    }
    
    await reflection.deleteOne();
  }

  /**
   * Get reflection analytics for teacher
   * @param {string} teacherId - Teacher user ID
   * @param {object} filters - { subjectId, startDate, endDate }
   * @returns {Promise<object>}
   */
  async getReflectionAnalytics(teacherId, filters = {}) {
    const matchStage = {
      teacher: teacherId
    };
    
    if (filters.subjectId) {
      matchStage.subject = filters.subjectId;
    }
    
    if (filters.startDate || filters.endDate) {
      matchStage.createdAt = {};
      if (filters.startDate) matchStage.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) matchStage.createdAt.$lte = new Date(filters.endDate);
    }
    
    const analytics = await TeacherSessionReflection.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalReflections: { $sum: 1 },
          averageEngagement: { $avg: '$studentEngagement' },
          topicsToRevisitCount: {
            $sum: { $size: '$topicsToRevisit' }
          },
          engagementDistribution: {
            $push: '$studentEngagement'
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalReflections: 1,
          averageEngagement: { $round: ['$averageEngagement', 2] },
          topicsToRevisitCount: 1,
          engagementDistribution: 1
        }
      }
    ]);
    
    const result = analytics[0] || {
      totalReflections: 0,
      averageEngagement: 0,
      topicsToRevisitCount: 0,
      engagementDistribution: []
    };
    
    // Calculate engagement breakdown (1-5)
    const engagementBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    result.engagementDistribution.forEach(engagement => {
      engagementBreakdown[engagement] = (engagementBreakdown[engagement] || 0) + 1;
    });
    
    return {
      ...result,
      engagementBreakdown
    };
  }
}

export default new ReflectionService();
