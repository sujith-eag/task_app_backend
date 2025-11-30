/**
 * Dashboard Service Tests
 * 
 * Tests for dashboard statistics and analytics functionality
 */

import mongoose from 'mongoose';
import * as dashboardService from '../services/dashboard.service.js';
import User from '../../../../models/userModel.js';
import Subject from '../../../../models/subjectModel.js';
import ClassSession from '../../../../models/classSessionModel.js';
import Feedback from '../../../../models/feedbackModel.js';
import {
  createTestStudent,
  createTestTeacher,
  createTestSubject,
  createTestUser,
  createPendingApplication,
} from '../../../../test/utils.js';

describe('Dashboard Service', () => {
  describe('getDashboardStats', () => {
    it('should return zero counts when database is empty', async () => {
      const result = await dashboardService.getDashboardStats();

      expect(result).toHaveProperty('stats');
      expect(result.stats.students.total).toBe(0);
      expect(result.stats.teachers.total).toBe(0);
      expect(result.stats.subjects.total).toBe(0);
      expect(result.stats.pendingApplications.total).toBe(0);
    });

    it('should count verified students correctly', async () => {
      // Create verified students using helper
      await createTestStudent({ name: 'Student 1' });
      await createTestStudent({ name: 'Student 2' });
      // Unverified should not count - use helper with override
      await createTestStudent({ 
        name: 'Student 3', 
        isVerified: false 
      });

      const result = await dashboardService.getDashboardStats();

      expect(result.stats.students.total).toBe(2);
    });

    it('should count verified teachers and HODs correctly', async () => {
      await createTestTeacher({ name: 'Teacher 1' });
      await createTestTeacher({ name: 'Teacher 2' });
      // Unverified should not count
      await createTestTeacher({ 
        name: 'Teacher 3', 
        isVerified: false 
      });

      const result = await dashboardService.getDashboardStats();

      expect(result.stats.teachers.total).toBe(2);
    });

    it('should count pending applications correctly', async () => {
      // Use helper for pending applications
      await createPendingApplication({ name: 'Pending 1' });
      await createPendingApplication({ name: 'Pending 2' });

      const result = await dashboardService.getDashboardStats();

      expect(result.stats.pendingApplications.total).toBe(2);
    });

    it('should count subjects correctly', async () => {
      await createTestSubject({ name: 'Math', subjectCode: 'MATH101' });
      await createTestSubject({ name: 'Physics', subjectCode: 'PHY101' });

      const result = await dashboardService.getDashboardStats();

      expect(result.stats.subjects.total).toBe(2);
    });

    it('should include trend data', async () => {
      const result = await dashboardService.getDashboardStats();

      expect(result.stats.students).toHaveProperty('trend');
      expect(result.stats.students).toHaveProperty('last30Days');
      expect(result.stats.teachers).toHaveProperty('trend');
      expect(result.stats.sessions).toHaveProperty('trend');
      expect(result.stats.feedback).toHaveProperty('trend');
    });
  });

  describe('getAttendanceTrend', () => {
    it('should return empty array when no sessions exist', async () => {
      const result = await dashboardService.getAttendanceTrend();

      expect(result).toEqual([]);
    });

    it('should return attendance trend data', async () => {
      const teacher = await createTestTeacher();
      const subject = await createTestSubject();
      const student = await createTestStudent();

      // Create session within last 7 days - include required 'type' field
      const today = new Date();
      await ClassSession.create({
        teacher: teacher._id,
        subject: subject._id,
        semester: 1,
        batch: 2024,
        section: 'A',
        startTime: today,
        type: 'Theory', // Required field - exact enum value
        attendanceRecords: [
          { student: student._id, status: true },
        ],
      });

      const result = await dashboardService.getAttendanceTrend();

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('total');
      expect(result[0]).toHaveProperty('present');
      expect(result[0]).toHaveProperty('percentage');
    });
  });

  describe('getFeedbackDistribution', () => {
    it('should return empty distribution when no feedback exists', async () => {
      const result = await dashboardService.getFeedbackDistribution();

      expect(result.summary.totalFeedback).toBe(0);
      expect(result.breakdown).toBeDefined();
    });

    it('should return feedback distribution with ratings', async () => {
      const teacher = await createTestTeacher();
      const subject = await createTestSubject();
      const student = await createTestStudent();

      const session = await ClassSession.create({
        teacher: teacher._id,
        subject: subject._id,
        semester: 1,
        batch: 2024,
        section: 'A',
        startTime: new Date(),
        type: 'Theory', // Required field - exact enum value
        attendanceRecords: [],
      });

      await Feedback.create({
        teacher: teacher._id,
        subject: subject._id,
        classSession: session._id,
        batch: 2024,
        semester: 1,
        ratings: {
          clarity: 4,
          engagement: 5,
          pace: 4,
          knowledge: 5,
        },
      });

      const result = await dashboardService.getFeedbackDistribution();

      expect(result.summary.totalFeedback).toBe(1);
      expect(result.summary.averageRatings).toHaveProperty('clarity');
      expect(result.summary.averageRatings).toHaveProperty('engagement');
    });
  });

  describe('getRecentActivity', () => {
    it('should return empty array when no activity exists', async () => {
      const result = await dashboardService.getRecentActivity();

      expect(result).toEqual([]);
    });

    it('should return recent applications', async () => {
      // Use helper for pending application
      await createPendingApplication({ name: 'Applicant' });

      const result = await dashboardService.getRecentActivity();

      expect(result.length).toBe(1);
      expect(result[0]).toHaveProperty('type', 'application');
      expect(result[0]).toHaveProperty('action', 'pending');
    });

    it('should limit results correctly', async () => {
      // Create 15 pending applications sequentially to avoid duplicate emails
      for (let i = 0; i < 15; i++) {
        await createPendingApplication({ name: `User ${i}` });
      }

      const result = await dashboardService.getRecentActivity(5);

      expect(result.length).toBe(5);
    });
  });

  describe('getStudentsBySemester', () => {
    it('should return empty array when no students exist', async () => {
      const result = await dashboardService.getStudentsBySemester();

      expect(result).toEqual([]);
    });

    it('should return student distribution by semester', async () => {
      // Use helpers with studentDetails override for semester
      await createTestStudent({ 
        name: 'S1',
        studentDetails: {
          usn: `USN-S1-${Date.now()}`,
          batch: 2024,
          section: 'A',
          semester: 1,
          applicationStatus: 'approved',
          isStudentVerified: true,
        }
      });
      await createTestStudent({ 
        name: 'S2',
        studentDetails: {
          usn: `USN-S2-${Date.now()}`,
          batch: 2024,
          section: 'A',
          semester: 1,
          applicationStatus: 'approved',
          isStudentVerified: true,
        }
      });
      await createTestStudent({ 
        name: 'S3',
        studentDetails: {
          usn: `USN-S3-${Date.now()}`,
          batch: 2024,
          section: 'A',
          semester: 3,
          applicationStatus: 'approved',
          isStudentVerified: true,
        }
      });

      const result = await dashboardService.getStudentsBySemester();

      expect(result.length).toBe(2);
      
      const sem1 = result.find(r => r.semester === 1);
      const sem3 = result.find(r => r.semester === 3);
      
      expect(sem1.count).toBe(2);
      expect(sem3.count).toBe(1);
    });

    it('should sort by semester', async () => {
      await createTestStudent({ 
        name: 'S1',
        studentDetails: {
          usn: `USN-S1-${Date.now()}`,
          batch: 2024,
          section: 'A',
          semester: 5,
          applicationStatus: 'approved',
          isStudentVerified: true,
        }
      });
      await createTestStudent({ 
        name: 'S2',
        studentDetails: {
          usn: `USN-S2-${Date.now()}`,
          batch: 2024,
          section: 'A',
          semester: 1,
          applicationStatus: 'approved',
          isStudentVerified: true,
        }
      });
      await createTestStudent({ 
        name: 'S3',
        studentDetails: {
          usn: `USN-S3-${Date.now()}`,
          batch: 2024,
          section: 'A',
          semester: 3,
          applicationStatus: 'approved',
          isStudentVerified: true,
        }
      });

      const result = await dashboardService.getStudentsBySemester();

      expect(result[0].semester).toBe(1);
      expect(result[1].semester).toBe(3);
      expect(result[2].semester).toBe(5);
    });
  });
});
