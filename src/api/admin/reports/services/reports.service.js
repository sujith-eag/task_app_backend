import mongoose from 'mongoose';
import User from '../../../../models/userModel.js';
import ClassSession from '../../../../models/classSessionModel.js';
import Feedback from '../../../../models/feedbackModel.js';
import TeacherSessionReflection from '../../../../models/teacherSessionReflectionModel.js';

// ============================================================================
// Reports Services
// ============================================================================

/**
 * Get aggregated attendance statistics
 * @param {Object} filters - Query filters (teacherId, subjectId, semester)
 * @returns {Promise<Array>} Attendance statistics
 */
export const getAttendanceStats = async (filters) => {
  const { teacherId, subjectId, semester } = filters;
  const matchQuery = {};

  // Build the initial match query for coarse-grained server-side filtering
  if (teacherId) matchQuery.teacher = new mongoose.Types.ObjectId(teacherId);
  if (subjectId) matchQuery.subject = new mongoose.Types.ObjectId(subjectId);
  if (semester) matchQuery.semester = parseInt(semester, 10);

  const stats = await ClassSession.aggregate([
    // Stage 1: Initial filter based on query parameters to reduce dataset size
    { $match: matchQuery },

    // Stage 2: Deconstruct the attendanceRecords array to process each student
    { $unwind: '$attendanceRecords' },

    // Stage 3: Group by a more granular key to preserve batch and section details
    {
      $group: {
        _id: {
          subject: '$subject',
          teacher: '$teacher',
          batch: '$batch',
          section: '$section',
          semester: '$semester',
        },
        totalStudents: { $sum: 1 },
        presentStudents: {
          $sum: { $cond: [{ $eq: ['$attendanceRecords.status', true] }, 1, 0] },
        },
      },
    },

    // Stage 4: Populate details from other collections
    {
      $lookup: {
        from: 'users',
        localField: '_id.teacher',
        foreignField: '_id',
        as: 'teacherDetails',
      },
    },
    {
      $lookup: {
        from: 'subjects',
        localField: '_id.subject',
        foreignField: '_id',
        as: 'subjectDetails',
      },
    },

    // Stage 5: Project the final shape of the data for the frontend
    {
      $project: {
        _id: 0, // Exclude the default _id
        // Create a stable, unique ID for the DataGrid
        id: {
          $concat: [
            { $toString: '$_id.teacher' },
            '-',
            { $toString: '$_id.subject' },
            '-',
            { $toString: '$_id.batch' },
            '-',
            '$_id.section',
          ],
        },
        teacherId: '$_id.teacher',
        subjectId: '$_id.subject',
        teacherName: { $arrayElemAt: ['$teacherDetails.name', 0] },
        subjectName: { $arrayElemAt: ['$subjectDetails.name', 0] },
        batch: '$_id.batch',
        section: '$_id.section',
        semester: '$_id.semester',
        totalStudents: '$totalStudents',
        presentStudents: '$presentStudents',
        attendancePercentage: {
          $cond: {
            // Avoid division by zero if totalStudents is 0
            if: { $gt: ['$totalStudents', 0] },
            then: {
              $round: [
                { $multiply: [{ $divide: ['$presentStudents', '$totalStudents'] }, 100] },
                2,
              ],
            },
            else: 0,
          },
        },
      },
    },
    { $sort: { subjectName: 1, teacherName: 1 } },
  ]);

  return stats;
};

/**
 * Get a comprehensive feedback report for a class session
 * @param {string} classSessionId - The class session ID
 * @returns {Promise<Object>} Feedback report with session details, student feedback, and teacher reflection
 * @throws {Error} If class session not found
 */
export const getFeedbackReport = async (classSessionId) => {
  // 1. Fetch Session Details
  const sessionDetailsPromise = ClassSession.findById(classSessionId)
    .populate('teacher', 'name')
    .populate('subject', 'name subjectCode');

  // 2. Aggregate Anonymous Student Feedback
  const studentFeedbackPromise = Feedback.aggregate([
    { $match: { classSession: new mongoose.Types.ObjectId(classSessionId) } },
    {
      $group: {
        _id: '$classSession',
        feedbackCount: { $sum: 1 },
        avgClarity: { $avg: '$ratings.clarity' },
        avgEngagement: { $avg: '$ratings.engagement' },
        avgPace: { $avg: '$ratings.pace' },
        avgKnowledge: { $avg: '$ratings.knowledge' },
        positiveComments: { $push: '$positiveFeedback' },
        improvementSuggestions: { $push: '$improvementSuggestions' },
      },
    },
    {
      $project: {
        _id: 0,
        feedbackCount: 1,
        averageRatings: {
          clarity: { $round: ['$avgClarity', 2] },
          engagement: { $round: ['$avgEngagement', 2] },
          pace: { $round: ['$avgPace', 2] },
          knowledge: { $round: ['$avgKnowledge', 2] },
        },
        positiveComments: {
          $filter: {
            input: '$positiveComments',
            as: 'comment',
            cond: { $ne: ['$$comment', ''] },
          },
        },
        improvementSuggestions: {
          $filter: {
            input: '$improvementSuggestions',
            as: 'suggestion',
            cond: { $ne: ['$$suggestion', ''] },
          },
        },
      },
    },
  ]);

  // 3. Fetch Teacher's Reflection
  const teacherReflectionPromise = TeacherSessionReflection.findOne({
    classSession: classSessionId,
  });

  // Execute all promises in parallel
  const [session, studentFeedback, teacherReflection] = await Promise.all([
    sessionDetailsPromise,
    studentFeedbackPromise,
    teacherReflectionPromise,
  ]);

  if (!session) {
    throw new Error('Class session not found.');
  }

  return {
    sessionDetails: session,
    studentFeedbackSummary: studentFeedback[0] || {
      feedbackCount: 0,
      averageRatings: {},
      comments: [],
    },
    teacherReflection: teacherReflection || null,
  };
};

/**
 * Get aggregated feedback summary
 * @param {Object} filters - Query filters (teacherId, subjectId, semester)
 * @returns {Promise<Array>} Feedback summary
 */
export const getFeedbackSummary = async (filters) => {
  const { teacherId, subjectId, semester } = filters;
  const matchQuery = {};

  // Build the initial match query
  if (teacherId) matchQuery.teacher = new mongoose.Types.ObjectId(teacherId);
  if (subjectId) matchQuery.subject = new mongoose.Types.ObjectId(subjectId);
  if (semester) matchQuery.semester = parseInt(semester, 10);

  const summary = await Feedback.aggregate([
    // Stage 1: Filter on the server
    { $match: matchQuery },

    // Stage 2: Group by teacher and subject
    {
      $group: {
        _id: { subject: '$subject', teacher: '$teacher' },
        feedbackCount: { $sum: 1 },
        avgClarity: { $avg: '$ratings.clarity' },
        avgEngagement: { $avg: '$ratings.engagement' },
        avgPace: { $avg: '$ratings.pace' },
        avgKnowledge: { $avg: '$ratings.knowledge' },
      },
    },

    // Stage 3: Populate details from other collections
    {
      $lookup: {
        from: 'users',
        localField: '_id.teacher',
        foreignField: '_id',
        as: 'teacherDetails',
      },
    },
    {
      $lookup: {
        from: 'subjects',
        localField: '_id.subject',
        foreignField: '_id',
        as: 'subjectDetails',
      },
    },

    // Stage 4: Project the final shape of the data
    {
      $project: {
        _id: 0,
        // Create a stable, unique ID for the DataGrid
        id: {
          $concat: [{ $toString: '$_id.teacher' }, '-', { $toString: '$_id.subject' }],
        },
        teacherId: '$_id.teacher',
        subjectId: '$_id.subject',
        teacherName: { $arrayElemAt: ['$teacherDetails.name', 0] },
        subjectName: { $arrayElemAt: ['$subjectDetails.name', 0] },
        feedbackCount: 1,
        // Project the individual average ratings
        averageRatings: {
          clarity: { $round: ['$avgClarity', 2] },
          engagement: { $round: ['$avgEngagement', 2] },
          pace: { $round: ['$avgPace', 2] },
          knowledge: { $round: ['$avgKnowledge', 2] },
        },
      },
    },
    { $sort: { feedbackCount: -1 } },
  ]);

  return summary;
};

/**
 * Get a detailed report for a specific teacher
 * @param {string} teacherId - The teacher's user ID
 * @param {Object} filters - Optional filters (subjectId, semester)
 * @returns {Promise<Object>} Teacher report with attendance and feedback data
 * @throws {Error} If teacher not found
 */
export const getTeacherReport = async (teacherId, filters = {}) => {
  const { subjectId, semester } = filters;

  const matchQuery = { teacher: new mongoose.Types.ObjectId(teacherId) };
  if (subjectId) matchQuery.subject = new mongoose.Types.ObjectId(subjectId);
  if (semester) matchQuery.semester = parseInt(semester, 10);

  // 1. Aggregate attendance data for the teacher
  const attendancePromise = ClassSession.aggregate([
    { $match: matchQuery },
    { $unwind: '$attendanceRecords' },
    {
      $group: {
        _id: '$subject',
        totalSessions: { $addToSet: '$_id' }, // Count unique sessions
        totalStudents: { $sum: 1 },
        presentStudents: {
          $sum: { $cond: [{ $eq: ['$attendanceRecords.status', true] }, 1, 0] },
        },
      },
    },
    {
      $lookup: {
        from: 'subjects',
        localField: '_id',
        foreignField: '_id',
        as: 'subjectDetails',
      },
    },
    {
      $project: {
        _id: 0,
        subjectId: '$_id',
        subjectName: { $arrayElemAt: ['$subjectDetails.name', 0] },
        sessionCount: { $size: '$totalSessions' },
        attendancePercentage: {
          $round: [
            { $multiply: [{ $divide: ['$presentStudents', '$totalStudents'] }, 100] },
            2,
          ],
        },
      },
    },
  ]);

  // 2. Aggregate feedback data for the teacher
  const feedbackPromise = Feedback.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$subject',
        feedbackCount: { $sum: 1 },
        avgClarity: { $avg: '$ratings.clarity' },
        avgEngagement: { $avg: '$ratings.engagement' },
      },
    },
    {
      $lookup: {
        from: 'subjects',
        localField: '_id',
        foreignField: '_id',
        as: 'subjectDetails',
      },
    },
    {
      $project: {
        _id: 0,
        subjectId: '$_id',
        feedbackCount: 1,
        avgClarity: { $round: ['$avgClarity', 2] },
        avgEngagement: { $round: ['$avgEngagement', 2] },
      },
    },
  ]);

  // 3. Get Teacher's own details
  const teacherDetailsPromise = User.findById(teacherId).select(
    'name teacherDetails.staffId teacherDetails.department'
  );

  const [attendance, feedback, teacher] = await Promise.all([
    attendancePromise,
    feedbackPromise,
    teacherDetailsPromise,
  ]);

  if (!teacher) {
    throw new Error('Teacher not found');
  }

  return { teacher, attendance, feedback };
};

/**
 * Get a detailed attendance report for a specific student
 * @param {string} studentId - The student's user ID
 * @returns {Promise<Object>} Student report with attendance data
 * @throws {Error} If student not found
 */
export const getStudentReport = async (studentId) => {
  const studentObjectId = new mongoose.Types.ObjectId(studentId);

  // 1. Get student's details
  const studentDetailsPromise = User.findById(studentObjectId).select(
    'name studentDetails'
  );

  // 2. Aggregate the student's attendance across all their classes
  const attendancePromise = ClassSession.aggregate([
    { $match: { 'attendanceRecords.student': studentObjectId } },
    { $unwind: '$attendanceRecords' },
    { $match: { 'attendanceRecords.student': studentObjectId } },
    {
      $group: {
        _id: '$subject',
        totalClasses: { $sum: 1 },
        attendedClasses: {
          $sum: { $cond: [{ $eq: ['$attendanceRecords.status', true] }, 1, 0] },
        },
      },
    },
    {
      $lookup: {
        from: 'subjects',
        localField: '_id',
        foreignField: '_id',
        as: 'subjectDetails',
      },
    },
    {
      $project: {
        _id: 0,
        subjectId: '$_id',
        subjectName: { $arrayElemAt: ['$subjectDetails.name', 0] },
        totalClasses: 1,
        attendedClasses: 1,
        attendancePercentage: {
          $round: [
            { $multiply: [{ $divide: ['$attendedClasses', '$totalClasses'] }, 100] },
            2,
          ],
        },
      },
    },
    { $sort: { attendancePercentage: 1 } },
  ]);

  const [student, attendance] = await Promise.all([
    studentDetailsPromise,
    attendancePromise,
  ]);

  if (!student) {
    throw new Error('Student not found');
  }

  return { student, attendance };
};
