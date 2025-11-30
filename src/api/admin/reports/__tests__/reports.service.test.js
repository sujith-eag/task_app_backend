/**
 * Reports Service Tests
 * Unit tests for admin reports and analytics operations
 */

import mongoose from 'mongoose';
import {
  getAttendanceStats,
  getFeedbackReport,
  getFeedbackSummary,
  getTeacherReport,
  getStudentReport,
} from '../services/reports.service.js';
import ClassSession from '../../../../models/classSessionModel.js';
import Feedback from '../../../../models/feedbackModel.js';
import TeacherSessionReflection from '../../../../models/teacherSessionReflectionModel.js';
import { createTestUser, createTestSubject } from '../../../../test/utils.js';

describe('Reports Service', () => {
  let teacher, student, subject;

  beforeEach(async () => {
    // Create common test data
    teacher = await createTestUser({ role: 'teacher', name: 'Test Teacher' });
    student = await createTestUser({ role: 'student', name: 'Test Student' });
    subject = await createTestSubject({ name: 'Test Subject', semester: 3 });
  });

  // ============================================================================
  // Helper to create a class session with attendance
  // ============================================================================
  const createClassSession = async (overrides = {}) => {
    const session = await ClassSession.create({
      teacher: teacher._id,
      subject: subject._id,
      semester: 3,
      section: 'A',
      batch: 2024,
      type: 'Theory',
      startTime: new Date(),
      attendanceRecords: [
        { student: student._id, status: true },
      ],
      ...overrides,
    });
    return session;
  };

  // ============================================================================
  // Helper to create feedback
  // ============================================================================
  const createFeedback = async (classSessionId, overrides = {}) => {
    const feedback = await Feedback.create({
      classSession: classSessionId,
      teacher: teacher._id,
      subject: subject._id,
      batch: 2024,
      semester: 3,
      ratings: {
        clarity: 4,
        engagement: 5,
        pace: 4,
        knowledge: 5,
      },
      positiveFeedback: 'Great class',
      improvementSuggestions: 'More examples',
      ...overrides,
    });
    return feedback;
  };

  // ============================================================================
  // getAttendanceStats Tests
  // ============================================================================
  describe('getAttendanceStats', () => {
    it('should return attendance statistics', async () => {
      await createClassSession();

      const result = await getAttendanceStats({});

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by teacherId', async () => {
      const otherTeacher = await createTestUser({ role: 'teacher' });
      await createClassSession();
      await createClassSession({ teacher: otherTeacher._id });

      const result = await getAttendanceStats({ teacherId: teacher._id.toString() });

      expect(result.length).toBeGreaterThanOrEqual(1);
      result.forEach((stat) => {
        expect(stat.teacherId.toString()).toBe(teacher._id.toString());
      });
    });

    it('should filter by semester', async () => {
      await createClassSession({ semester: 3 });
      await createClassSession({ semester: 4 });

      const result = await getAttendanceStats({ semester: '3' });

      result.forEach((stat) => {
        expect(stat.semester).toBe(3);
      });
    });

    it('should calculate attendance percentage correctly', async () => {
      const student2 = await createTestUser({ role: 'student' });
      await createClassSession({
        attendanceRecords: [
          { student: student._id, status: true },
          { student: student2._id, status: false },
        ],
      });

      const result = await getAttendanceStats({});

      expect(result[0].attendancePercentage).toBe(50);
      expect(result[0].totalStudents).toBe(2);
      expect(result[0].presentStudents).toBe(1);
    });
  });

  // ============================================================================
  // getFeedbackReport Tests
  // ============================================================================
  describe('getFeedbackReport', () => {
    it('should return feedback report for a session', async () => {
      const session = await createClassSession();
      await createFeedback(session._id);

      const result = await getFeedbackReport(session._id.toString());

      expect(result.sessionDetails).toBeDefined();
      expect(result.studentFeedbackSummary).toBeDefined();
      expect(result.studentFeedbackSummary.feedbackCount).toBe(1);
    });

    it('should throw error for non-existent session', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      await expect(getFeedbackReport(fakeId.toString())).rejects.toThrow(
        'Class session not found.'
      );
    });

    it('should return empty feedback summary when no feedback exists', async () => {
      const session = await createClassSession();

      const result = await getFeedbackReport(session._id.toString());

      expect(result.studentFeedbackSummary.feedbackCount).toBe(0);
    });

    it('should aggregate average ratings correctly', async () => {
      const session = await createClassSession();
      const student2 = await createTestUser({ role: 'student' });

      // Create two feedback entries
      await createFeedback(session._id, {
        ratings: { clarity: 4, engagement: 4, pace: 4, knowledge: 4 },
      });
      await createFeedback(session._id, {
        student: student2._id,
        ratings: { clarity: 5, engagement: 5, pace: 5, knowledge: 5 },
      });

      const result = await getFeedbackReport(session._id.toString());

      expect(result.studentFeedbackSummary.averageRatings.clarity).toBe(4.5);
      expect(result.studentFeedbackSummary.averageRatings.engagement).toBe(4.5);
    });

    it('should include teacher reflection if exists', async () => {
      const session = await createClassSession();
      await TeacherSessionReflection.create({
        classSession: session._id,
        teacher: teacher._id,
        selfAssessment: {
          effectiveness: 4,
          studentEngagement: 4,
          pace: 'Just Right',
        },
        sessionHighlights: 'Class went well',
        challengesFaced: 'Time management',
      });

      const result = await getFeedbackReport(session._id.toString());

      expect(result.teacherReflection).toBeDefined();
      expect(result.teacherReflection.sessionHighlights).toBe('Class went well');
    });
  });

  // ============================================================================
  // getFeedbackSummary Tests
  // ============================================================================
  describe('getFeedbackSummary', () => {
    it('should return feedback summary', async () => {
      const session = await createClassSession();
      await createFeedback(session._id);

      const result = await getFeedbackSummary({});

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by teacherId', async () => {
      const session = await createClassSession();
      await createFeedback(session._id);

      const result = await getFeedbackSummary({ teacherId: teacher._id.toString() });

      result.forEach((item) => {
        expect(item.teacherId.toString()).toBe(teacher._id.toString());
      });
    });

    it('should include feedback count per teacher-subject', async () => {
      const session = await createClassSession();
      await createFeedback(session._id);
      await createFeedback(session._id, {
        student: (await createTestUser({ role: 'student' }))._id,
      });

      const result = await getFeedbackSummary({});

      expect(result[0].feedbackCount).toBe(2);
    });
  });

  // ============================================================================
  // getTeacherReport Tests
  // ============================================================================
  describe('getTeacherReport', () => {
    it('should return teacher report with attendance and feedback', async () => {
      const session = await createClassSession();
      await createFeedback(session._id);

      const result = await getTeacherReport(teacher._id.toString());

      expect(result.teacher).toBeDefined();
      expect(result.attendance).toBeDefined();
      expect(result.feedback).toBeDefined();
    });

    it('should throw error for non-existent teacher', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      await expect(getTeacherReport(fakeId.toString())).rejects.toThrow(
        'Teacher not found'
      );
    });

    it('should include session count in attendance', async () => {
      await createClassSession();
      await createClassSession({ topic: 'Session 2' });

      const result = await getTeacherReport(teacher._id.toString());

      expect(result.attendance[0].sessionCount).toBe(2);
    });

    it('should filter by subjectId', async () => {
      const subject2 = await createTestSubject({ subjectCode: 'CS102' });
      await createClassSession();
      await createClassSession({ subject: subject2._id });

      const result = await getTeacherReport(teacher._id.toString(), {
        subjectId: subject._id.toString(),
      });

      expect(result.attendance).toHaveLength(1);
      expect(result.attendance[0].subjectId.toString()).toBe(subject._id.toString());
    });
  });

  // ============================================================================
  // getStudentReport Tests
  // ============================================================================
  describe('getStudentReport', () => {
    it('should return student report with attendance data', async () => {
      await createClassSession();

      const result = await getStudentReport(student._id.toString());

      expect(result.student).toBeDefined();
      expect(result.attendance).toBeDefined();
    });

    it('should throw error for non-existent student', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      await expect(getStudentReport(fakeId.toString())).rejects.toThrow(
        'Student not found'
      );
    });

    it('should calculate attendance percentage correctly', async () => {
      // Student present in 2 out of 3 sessions
      await createClassSession({
        attendanceRecords: [{ student: student._id, status: true }],
      });
      await createClassSession({
        topic: 'Session 2',
        attendanceRecords: [{ student: student._id, status: true }],
      });
      await createClassSession({
        topic: 'Session 3',
        attendanceRecords: [{ student: student._id, status: false }],
      });

      const result = await getStudentReport(student._id.toString());

      expect(result.attendance[0].totalClasses).toBe(3);
      expect(result.attendance[0].attendedClasses).toBe(2);
      expect(result.attendance[0].attendancePercentage).toBeCloseTo(66.67, 1);
    });

    it('should include student details', async () => {
      const result = await getStudentReport(student._id.toString());

      expect(result.student.name).toBe('Test Student');
    });
  });
});
