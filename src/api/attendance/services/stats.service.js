import AttendanceRecord from '../../../models/attendanceRecordModel.js';
import ClassSession from '../../../models/classSessionModel.js';
import User from '../../../models/userModel.js';
import mongoose from 'mongoose';

/**
 * Stats Service (Phase 0 - Attendance Domain)
 * 
 * Handles attendance statistics, analytics, and reporting
 */

class StatsService {
  /**
   * Get student's overall attendance statistics
   * @param {string} studentId - Student user ID
   * @returns {Promise<object>}
   */
  async getStudentOverallStats(studentId) {
    const stats = await AttendanceRecord.aggregate([
      { $match: { student: new mongoose.Types.ObjectId(studentId) } },
      {
        $group: {
          _id: null,
          totalClasses: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          },
          lateCount: {
            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
          },
          absentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalClasses: 1,
          presentCount: 1,
          lateCount: 1,
          absentCount: 1,
          attendancePercentage: {
            $cond: [
              { $eq: ['$totalClasses', 0] },
              0,
              {
                $round: [
                  { $multiply: [{ $divide: ['$presentCount', '$totalClasses'] }, 100] },
                  2
                ]
              }
            ]
          }
        }
      }
    ]);
    
    return stats[0] || {
      totalClasses: 0,
      presentCount: 0,
      lateCount: 0,
      absentCount: 0,
      attendancePercentage: 0
    };
  }

  /**
   * Get student's attendance statistics by subject
   * @param {string} studentId - Student user ID
   * @returns {Promise<Array>}
   */
  async getStudentStatsBySubject(studentId) {
    const stats = await AttendanceRecord.aggregate([
      { $match: { student: new mongoose.Types.ObjectId(studentId) } },
      {
        $group: {
          _id: '$subject',
          totalClasses: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          },
          lateCount: {
            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
          },
          absentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'subjects',
          localField: '_id',
          foreignField: '_id',
          as: 'subjectDetails'
        }
      },
      { $unwind: '$subjectDetails' },
      {
        $project: {
          _id: 0,
          subjectId: '$_id',
          subjectName: '$subjectDetails.name',
          subjectCode: '$subjectDetails.code',
          totalClasses: 1,
          presentCount: 1,
          lateCount: 1,
          absentCount: 1,
          attendancePercentage: {
            $round: [
              { $multiply: [{ $divide: ['$presentCount', '$totalClasses'] }, 100] },
              2
            ]
          }
        }
      },
      { $sort: { subjectName: 1 } }
    ]);
    
    return stats;
  }

  /**
   * Get attendance statistics for a class section
   * @param {object} classParams - { batch, semester, section, subjectId }
   * @param {string} teacherId - Teacher user ID (for authorization)
   * @returns {Promise<Array>}
   */
  async getClassStats(classParams, teacherId) {
    const { batch, semester, section, subjectId } = classParams;
    
    // Verify teacher is assigned to this class
    const teacher = await User.findById(teacherId);
    if (!teacher || !teacher.teacherDetails) {
      throw new Error('Teacher not found or invalid role');
    }
    
    const isAssigned = teacher.teacherDetails.assignments.some(a =>
      a.subject.toString() === subjectId &&
      a.batch === batch &&
      a.semester === semester &&
      a.section === section
    );
    
    if (!isAssigned) {
      throw new Error('Teacher is not assigned to this class');
    }
    
    // Get attendance statistics for each student
    const stats = await AttendanceRecord.aggregate([
      {
        $match: {
          batch,
          semester,
          section,
          subject: new mongoose.Types.ObjectId(subjectId)
        }
      },
      {
        $group: {
          _id: '$student',
          totalClasses: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          },
          lateCount: {
            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
          },
          absentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'studentDetails'
        }
      },
      { $unwind: '$studentDetails' },
      {
        $project: {
          _id: 0,
          studentId: '$_id',
          studentName: '$studentDetails.name',
          usn: '$studentDetails.studentDetails.usn',
          avatar: '$studentDetails.avatar',
          totalClasses: 1,
          presentCount: 1,
          lateCount: 1,
          absentCount: 1,
          attendancePercentage: {
            $round: [
              { $multiply: [{ $divide: ['$presentCount', '$totalClasses'] }, 100] },
              2
            ]
          }
        }
      },
      { $sort: { studentName: 1 } }
    ]);
    
    return stats;
  }

  /**
   * Get attendance trend over time for a student
   * @param {string} studentId - Student user ID
   * @param {string} subjectId - Subject ID (optional)
   * @param {object} dateRange - { startDate, endDate }
   * @returns {Promise<Array>}
   */
  async getStudentTrend(studentId, subjectId = null, dateRange = {}) {
    const matchStage = {
      student: new mongoose.Types.ObjectId(studentId)
    };
    
    if (subjectId) {
      matchStage.subject = new mongoose.Types.ObjectId(subjectId);
    }
    
    if (dateRange.startDate || dateRange.endDate) {
      matchStage.createdAt = {};
      if (dateRange.startDate) matchStage.createdAt.$gte = new Date(dateRange.startDate);
      if (dateRange.endDate) matchStage.createdAt.$lte = new Date(dateRange.endDate);
    }
    
    const trend = await AttendanceRecord.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'classsessions',
          localField: 'classSession',
          foreignField: '_id',
          as: 'sessionDetails'
        }
      },
      { $unwind: '$sessionDetails' },
      {
        $project: {
          date: {
            $dateToString: { format: '%Y-%m-%d', date: '$sessionDetails.createdAt' }
          },
          status: 1
        }
      },
      {
        $group: {
          _id: '$date',
          totalClasses: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          totalClasses: 1,
          presentCount: 1,
          attendanceRate: {
            $round: [
              { $multiply: [{ $divide: ['$presentCount', '$totalClasses'] }, 100] },
              2
            ]
          }
        }
      }
    ]);
    
    return trend;
  }

  /**
   * Get session-wise attendance summary
   * @param {string} sessionId - Class session ID
   * @returns {Promise<object>}
   */
  async getSessionSummary(sessionId) {
    return AttendanceRecord.getSessionSummary(sessionId);
  }

  /**
   * Get low attendance students (below threshold)
   * @param {number} threshold - Attendance percentage threshold (e.g., 75)
   * @param {object} classParams - { batch, semester, section, subjectId }
   * @returns {Promise<Array>}
   */
  async getLowAttendanceStudents(threshold, classParams) {
    const { batch, semester, section, subjectId } = classParams;
    
    const matchStage = {
      batch,
      semester,
      section
    };
    
    if (subjectId) {
      matchStage.subject = new mongoose.Types.ObjectId(subjectId);
    }
    
    const students = await AttendanceRecord.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$student',
          totalClasses: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          studentId: '$_id',
          totalClasses: 1,
          presentCount: 1,
          attendancePercentage: {
            $round: [
              { $multiply: [{ $divide: ['$presentCount', '$totalClasses'] }, 100] },
              2
            ]
          }
        }
      },
      {
        $match: {
          attendancePercentage: { $lt: threshold }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'studentId',
          foreignField: '_id',
          as: 'studentDetails'
        }
      },
      { $unwind: '$studentDetails' },
      {
        $project: {
          _id: 0,
          studentId: 1,
          studentName: '$studentDetails.name',
          usn: '$studentDetails.studentDetails.usn',
          email: '$studentDetails.email',
          totalClasses: 1,
          presentCount: 1,
          attendancePercentage: 1
        }
      },
      { $sort: { attendancePercentage: 1 } }
    ]);
    
    return students;
  }

  /**
   * Export attendance data for reporting
   * @param {object} params - { batch, semester, section, subjectId, startDate, endDate }
   * @returns {Promise<Array>}
   */
  async exportAttendanceData(params) {
    const { batch, semester, section, subjectId, startDate, endDate } = params;
    
    const matchStage = {
      batch,
      semester,
      section
    };
    
    if (subjectId) {
      matchStage.subject = new mongoose.Types.ObjectId(subjectId);
    }
    
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }
    
    const data = await AttendanceRecord.find(matchStage)
      .populate('student', 'name studentDetails.usn email')
      .populate('subject', 'name code')
      .populate('classSession', 'topic sessionType createdAt')
      .populate('teacher', 'name')
      .sort({ createdAt: -1 });
    
    return data.map(record => ({
      sessionDate: record.classSession.createdAt,
      subjectName: record.subject.name,
      subjectCode: record.subject.code,
      topic: record.classSession.topic,
      sessionType: record.classSession.sessionType,
      teacherName: record.teacher.name,
      studentName: record.student.name,
      usn: record.student.studentDetails.usn,
      status: record.status,
      markedAt: record.markedAt,
      markedMethod: record.markedMethod
    }));
  }
}

export default new StatsService();
