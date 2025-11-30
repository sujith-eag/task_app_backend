import mongoose from 'mongoose';
import User from '../../../../models/userModel.js';
import Subject from '../../../../models/subjectModel.js';
import ClassSession from '../../../../models/classSessionModel.js';
import Feedback from '../../../../models/feedbackModel.js';

// ============================================================================
// Dashboard Services
// ============================================================================

/**
 * Get dashboard overview statistics
 * @returns {Promise<Object>} Dashboard statistics including counts and trends
 */
export const getDashboardStats = async () => {
  // Calculate date ranges for trends
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Execute all count queries in parallel for performance
  const [
    totalStudents,
    totalTeachers,
    totalSubjects,
    pendingApplications,
    totalSessions,
    totalFeedback,
    // Trend data - last 30 days
    studentsLast30Days,
    teachersLast30Days,
    sessionsLast30Days,
    feedbackLast30Days,
    // Trend data - previous 30 days (30-60 days ago)
    studentsPrev30Days,
    teachersPrev30Days,
    sessionsPrev30Days,
    feedbackPrev30Days,
  ] = await Promise.all([
    // Current totals - use 'roles' array field
    User.countDocuments({ roles: 'student', isVerified: true }),
    User.countDocuments({ roles: { $in: ['teacher', 'hod'] }, isVerified: true }),
    Subject.countDocuments(),
    User.countDocuments({ 
      'studentDetails.applicationStatus': 'pending',
    }),
    ClassSession.countDocuments(),
    Feedback.countDocuments(),
    
    // Last 30 days counts
    User.countDocuments({ 
      roles: 'student', 
      isVerified: true, 
      createdAt: { $gte: thirtyDaysAgo } 
    }),
    User.countDocuments({ 
      roles: { $in: ['teacher', 'hod'] }, 
      isVerified: true, 
      createdAt: { $gte: thirtyDaysAgo } 
    }),
    ClassSession.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    Feedback.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    
    // Previous 30 days counts (30-60 days ago)
    User.countDocuments({ 
      roles: 'student', 
      isVerified: true, 
      createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } 
    }),
    User.countDocuments({ 
      roles: { $in: ['teacher', 'hod'] }, 
      isVerified: true, 
      createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } 
    }),
    ClassSession.countDocuments({ 
      createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } 
    }),
    Feedback.countDocuments({ 
      createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } 
    }),
  ]);

  // Calculate percentage changes (avoid division by zero)
  const calculateTrend = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  return {
    stats: {
      students: {
        total: totalStudents,
        trend: calculateTrend(studentsLast30Days, studentsPrev30Days),
        last30Days: studentsLast30Days,
      },
      teachers: {
        total: totalTeachers,
        trend: calculateTrend(teachersLast30Days, teachersPrev30Days),
        last30Days: teachersLast30Days,
      },
      subjects: {
        total: totalSubjects,
      },
      pendingApplications: {
        total: pendingApplications,
      },
      sessions: {
        total: totalSessions,
        trend: calculateTrend(sessionsLast30Days, sessionsPrev30Days),
        last30Days: sessionsLast30Days,
      },
      feedback: {
        total: totalFeedback,
        trend: calculateTrend(feedbackLast30Days, feedbackPrev30Days),
        last30Days: feedbackLast30Days,
      },
    },
  };
};

/**
 * Get attendance trend data for charts (last 7 days)
 * @returns {Promise<Array>} Daily attendance data
 */
export const getAttendanceTrend = async () => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const trend = await ClassSession.aggregate([
    {
      $match: {
        startTime: { $gte: sevenDaysAgo },
      },
    },
    { $unwind: '$attendanceRecords' },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$startTime' },
        },
        totalStudents: { $sum: 1 },
        presentStudents: {
          $sum: { $cond: [{ $eq: ['$attendanceRecords.status', true] }, 1, 0] },
        },
      },
    },
    {
      $project: {
        _id: 0,
        date: '$_id',
        total: '$totalStudents',
        present: '$presentStudents',
        percentage: {
          $cond: {
            if: { $gt: ['$totalStudents', 0] },
            then: {
              $round: [
                { $multiply: [{ $divide: ['$presentStudents', '$totalStudents'] }, 100] },
                1,
              ],
            },
            else: 0,
          },
        },
      },
    },
    { $sort: { date: 1 } },
  ]);

  return trend;
};

/**
 * Get feedback rating distribution for charts
 * @returns {Promise<Object>} Feedback rating distribution
 */
export const getFeedbackDistribution = async () => {
  const distribution = await Feedback.aggregate([
    {
      $group: {
        _id: null,
        avgClarity: { $avg: '$ratings.clarity' },
        avgEngagement: { $avg: '$ratings.engagement' },
        avgPace: { $avg: '$ratings.pace' },
        avgKnowledge: { $avg: '$ratings.knowledge' },
        totalFeedback: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        totalFeedback: 1,
        averageRatings: {
          clarity: { $round: ['$avgClarity', 2] },
          engagement: { $round: ['$avgEngagement', 2] },
          pace: { $round: ['$avgPace', 2] },
          knowledge: { $round: ['$avgKnowledge', 2] },
        },
      },
    },
  ]);

  // Get rating breakdown (1-5 stars distribution)
  const ratingBreakdown = await Feedback.aggregate([
    {
      $project: {
        overallRating: {
          $avg: [
            '$ratings.clarity',
            '$ratings.engagement',
            '$ratings.pace',
            '$ratings.knowledge',
          ],
        },
      },
    },
    {
      $bucket: {
        groupBy: '$overallRating',
        boundaries: [0, 1.5, 2.5, 3.5, 4.5, 5.1],
        default: 'Other',
        output: {
          count: { $sum: 1 },
        },
      },
    },
  ]);

  // Map bucket boundaries to star ratings
  const starLabels = ['1 Star', '2 Stars', '3 Stars', '4 Stars', '5 Stars'];
  const breakdown = starLabels.map((label, index) => {
    const bucket = ratingBreakdown.find((b, i) => i === index);
    return {
      rating: label,
      count: bucket?.count || 0,
    };
  });

  return {
    summary: distribution[0] || { totalFeedback: 0, averageRatings: {} },
    breakdown,
  };
};

/**
 * Get recent activity for the activity feed
 * @param {number} limit - Number of recent activities to fetch
 * @returns {Promise<Array>} Recent activities
 */
export const getRecentActivity = async (limit = 10) => {
  // Get recent applications - use 'studentDetails.applicationStatus' field
  const recentApplications = await User.find({
    'studentDetails.applicationStatus': { $in: ['pending', 'approved', 'rejected'] },
  })
    .select('name studentDetails.applicationStatus createdAt updatedAt')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  // Get recent sessions
  const recentSessions = await ClassSession.find()
    .populate('teacher', 'name')
    .populate('subject', 'name')
    .select('teacher subject sessionDate createdAt')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Combine and sort by date
  const activities = [
    ...recentApplications.map((app) => ({
      id: app._id.toString(),
      type: 'application',
      action: app.studentDetails?.applicationStatus || 'unknown',
      user: app.name,
      timestamp: app.updatedAt || app.createdAt,
    })),
    ...recentSessions.map((session) => ({
      id: session._id.toString(),
      type: 'session',
      action: 'created',
      user: session.teacher?.name || 'Unknown',
      subject: session.subject?.name || 'Unknown',
      timestamp: session.createdAt,
    })),
  ];

  // Sort by timestamp and limit
  activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return activities.slice(0, limit);
};

/**
 * Get semester-wise student distribution
 * @returns {Promise<Array>} Student count by semester
 */
export const getStudentsBySemester = async () => {
  const distribution = await User.aggregate([
    {
      $match: {
        roles: 'student',
        isVerified: true,
        'studentDetails.semester': { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: '$studentDetails.semester',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        semester: '$_id',
        count: 1,
      },
    },
    { $sort: { semester: 1 } },
  ]);

  return distribution;
};
