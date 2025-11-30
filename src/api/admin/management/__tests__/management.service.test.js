/**
 * Management Service Tests
 * Unit tests for admin user management functionality
 */

import mongoose from 'mongoose';
import * as managementService from '../services/management.service.js';
import User from '../../../../models/userModel.js';
import {
  createTestAdmin,
  createTestStudent,
  createTestTeacher,
  createTestUser,
  createTestSubject,
  createMockRequest,
} from '../../../../test/utils.js';

describe('Management Service', () => {
  let admin;
  let mockReq;

  beforeEach(async () => {
    admin = await createTestAdmin();
    mockReq = createMockRequest({ user: admin });
  });

  describe('getUsersByRole', () => {
    it('should return empty array when no users with role exist', async () => {
      const result = await managementService.getUsersByRole('student');
      
      // Only the admin exists, no students
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data).toHaveLength(0);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.total).toBe(0);
    });

    it('should return all students with pagination', async () => {
      await createTestStudent({ name: 'Student 1' });
      await createTestStudent({ name: 'Student 2' });

      const result = await managementService.getUsersByRole('student');

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
    });

    it('should return all teachers', async () => {
      await createTestTeacher({ name: 'Teacher 1' });
      await createTestTeacher({ name: 'Teacher 2' });

      const result = await managementService.getUsersByRole('teacher');

      expect(result.data).toHaveLength(2);
    });

    it('should only return verified users', async () => {
      await createTestStudent({ name: 'Verified Student', isVerified: true });
      await createTestStudent({ name: 'Unverified Student', isVerified: false });

      const result = await managementService.getUsersByRole('student');

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Verified Student');
    });

    it('should return selected fields only', async () => {
      await createTestStudent();

      const result = await managementService.getUsersByRole('student');

      expect(result.data[0]).toHaveProperty('name');
      expect(result.data[0]).toHaveProperty('email');
      // Password should not be included (undefined or not present)
      expect(result.data[0].password).toBeUndefined();
    });

    it('should support search by name', async () => {
      await createTestStudent({ name: 'John Doe' });
      await createTestStudent({ name: 'Jane Smith' });

      const result = await managementService.getUsersByRole('student', { search: 'john' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('John Doe');
    });

    it('should support pagination', async () => {
      // Create 5 students
      for (let i = 1; i <= 5; i++) {
        await createTestStudent({ name: `Student ${i}` });
      }

      const page1 = await managementService.getUsersByRole('student', { page: 1, limit: 2 });
      const page2 = await managementService.getUsersByRole('student', { page: 2, limit: 2 });

      expect(page1.data).toHaveLength(2);
      expect(page1.pagination.totalPages).toBe(3);
      expect(page1.pagination.hasMore).toBe(true);
      
      expect(page2.data).toHaveLength(2);
      expect(page2.pagination.page).toBe(2);
    });
  });

  describe('getAllTeachers', () => {
    it('should return all teachers and HODs with pagination', async () => {
      await createTestTeacher({ name: 'Teacher 1', roles: ['teacher'] });
      await createTestTeacher({ name: 'HOD 1', roles: ['hod'] });

      const result = await managementService.getAllTeachers();

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should populate teacher assignments', async () => {
      const subject = await createTestSubject();
      await createTestTeacher({
        name: 'Teacher with Assignment',
        teacherDetails: {
          staffId: 'STAFF-123',
          department: 'CS',
          assignments: [{ subject: subject._id, section: 'A', semester: 3 }],
        },
      });

      const result = await managementService.getAllTeachers();

      expect(result.data).toHaveLength(1);
      expect(result.data[0].teacherDetails.assignments).toHaveLength(1);
    });

    it('should support search by name or staffId', async () => {
      await createTestTeacher({ name: 'John Teacher', teacherDetails: { staffId: 'STAFF-001', department: 'CS' } });
      await createTestTeacher({ name: 'Jane Teacher', teacherDetails: { staffId: 'STAFF-002', department: 'CS' } });

      const result = await managementService.getAllTeachers({ search: 'john' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('John Teacher');
    });
  });

  describe('updateStudentEnrollment', () => {
    let student;
    let subject1;
    let subject2;

    beforeEach(async () => {
      student = await createTestStudent({ 
        studentDetails: { semester: 3, enrolledSubjects: [] }
      });
      subject1 = await createTestSubject({ semester: 3, name: 'Subject 1' });
      subject2 = await createTestSubject({ semester: 3, name: 'Subject 2' });
    });

    it('should update student enrollment with valid subjects', async () => {
      const result = await managementService.updateStudentEnrollment(
        student._id.toString(),
        [subject1._id, subject2._id]
      );

      expect(result.message).toBe('Student enrollment updated successfully.');
      expect(result.enrolledSubjects).toHaveLength(2);
    });

    it('should allow empty enrollment', async () => {
      // First enroll in some subjects
      await managementService.updateStudentEnrollment(
        student._id.toString(),
        [subject1._id]
      );

      // Then remove all enrollments
      const result = await managementService.updateStudentEnrollment(
        student._id.toString(),
        []
      );

      expect(result.enrolledSubjects).toHaveLength(0);
    });

    it('should throw error for non-existent student', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      await expect(
        managementService.updateStudentEnrollment(fakeId, [subject1._id])
      ).rejects.toThrow('Student not found');
    });

    it('should throw error for non-student user', async () => {
      const regularUser = await createTestUser();

      await expect(
        managementService.updateStudentEnrollment(regularUser._id.toString(), [subject1._id])
      ).rejects.toThrow('Student not found');
    });

    it('should throw error for subjects not matching semester', async () => {
      const wrongSemesterSubject = await createTestSubject({ semester: 4 });

      await expect(
        managementService.updateStudentEnrollment(
          student._id.toString(),
          [wrongSemesterSubject._id]
        )
      ).rejects.toThrow("One or more subjects do not match the student's current semester");
    });
  });

  describe('promoteToFaculty', () => {
    let regularUser;

    beforeEach(async () => {
      regularUser = await createTestUser({ name: 'User to Promote' });
    });

    it('should promote user to teacher role', async () => {
      const result = await managementService.promoteToFaculty(
        regularUser._id.toString(),
        {
          role: 'teacher',
          staffId: 'STAFF-NEW-001',
          department: 'Computer Science',
        },
        admin,
        mockReq
      );

      expect(result.message).toContain('promoted to teacher');
      expect(result.user.roles).toContain('teacher');
      expect(result.user.teacherDetails.staffId).toBe('STAFF-NEW-001');
    });

    it('should promote user to HOD role', async () => {
      const result = await managementService.promoteToFaculty(
        regularUser._id.toString(),
        {
          role: 'hod',
          staffId: 'STAFF-HOD-001',
          department: 'Computer Science',
        },
        admin,
        mockReq
      );

      expect(result.user.roles).toContain('hod');
    });

    it('should throw error for non-existent user', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      await expect(
        managementService.promoteToFaculty(
          fakeId,
          { role: 'teacher', staffId: 'STAFF-001', department: 'CS' },
          admin,
          mockReq
        )
      ).rejects.toThrow('User not found');
    });

    it('should throw error for duplicate staff ID', async () => {
      const existingTeacher = await createTestTeacher({
        teacherDetails: { staffId: 'STAFF-EXISTING', department: 'CS' },
      });

      await expect(
        managementService.promoteToFaculty(
          regularUser._id.toString(),
          { role: 'teacher', staffId: 'STAFF-EXISTING', department: 'CS' },
          admin,
          mockReq
        )
      ).rejects.toThrow('Staff ID is already assigned');
    });

    it('should clear student details when promoting a student', async () => {
      const student = await createTestStudent({
        studentDetails: {
          usn: 'USN123',
          semester: 3,
          batch: 2024,
          section: 'A',
        },
      });

      await managementService.promoteToFaculty(
        student._id.toString(),
        { role: 'teacher', staffId: 'STAFF-EX-STUDENT', department: 'CS' },
        admin,
        mockReq
      );

      const updatedUser = await User.findById(student._id);

      expect(updatedUser.roles).toContain('teacher');
      expect(updatedUser.studentDetails.applicationStatus).toBe('not_applied');
    });
  });

  describe('updateStudentDetails', () => {
    let student;

    beforeEach(async () => {
      student = await createTestStudent({
        studentDetails: {
          usn: 'USN-OLD',
          batch: 2024,
          section: 'A',
          semester: 3,
          enrolledSubjects: [],
        },
      });
    });

    it('should update USN', async () => {
      const result = await managementService.updateStudentDetails(
        student._id.toString(),
        { usn: 'USN-NEW' }
      );

      expect(result.studentDetails.usn).toBe('USN-NEW');
    });

    it('should update batch', async () => {
      const result = await managementService.updateStudentDetails(
        student._id.toString(),
        { batch: 2025 }
      );

      expect(result.studentDetails.batch).toBe(2025);
    });

    it('should update section', async () => {
      const result = await managementService.updateStudentDetails(
        student._id.toString(),
        { section: 'B' }
      );

      expect(result.studentDetails.section).toBe('B');
    });

    it('should clear enrollments when semester changes', async () => {
      // First enroll in a subject
      const subject = await createTestSubject({ semester: 3 });
      student.studentDetails.enrolledSubjects = [subject._id];
      await student.save();

      // Update semester
      const result = await managementService.updateStudentDetails(
        student._id.toString(),
        { semester: 4 }
      );

      expect(result.studentDetails.semester).toBe(4);
      expect(result.studentDetails.enrolledSubjects).toHaveLength(0);
    });

    it('should not clear enrollments when semester stays the same', async () => {
      const subject = await createTestSubject({ semester: 3 });
      student.studentDetails.enrolledSubjects = [subject._id];
      await student.save();

      // Update other field, keep semester
      const result = await managementService.updateStudentDetails(
        student._id.toString(),
        { section: 'B' }
      );

      expect(result.studentDetails.enrolledSubjects).toHaveLength(1);
    });

    it('should throw error for non-existent student', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      await expect(
        managementService.updateStudentDetails(fakeId, { usn: 'NEW' })
      ).rejects.toThrow('Student not found');
    });

    it('should throw error for non-student user', async () => {
      const teacher = await createTestTeacher();

      await expect(
        managementService.updateStudentDetails(teacher._id.toString(), { usn: 'NEW' })
      ).rejects.toThrow('Student not found');
    });
  });
});
