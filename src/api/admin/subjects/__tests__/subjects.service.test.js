/**
 * Subjects Service Tests
 * Unit tests for admin subject management operations
 */

import mongoose from 'mongoose';
import {
  createSubject,
  getSubjects,
  getSubjectById,
  updateSubject,
  deleteSubject,
} from '../services/subjects.service.js';
import Subject from '../../../../models/subjectModel.js';
import User from '../../../../models/userModel.js';
import { createTestUser, createTestSubject } from '../../../../test/utils.js';

describe('Subjects Service', () => {
  // ============================================================================
  // createSubject Tests
  // ============================================================================
  describe('createSubject', () => {
    it('should create a new subject successfully', async () => {
      const subjectData = {
        name: 'Data Structures',
        subjectCode: 'CS201',
        semester: 3,
        department: 'Computer Science',
      };

      const result = await createSubject(subjectData);

      expect(result).toBeDefined();
      expect(result.name).toBe(subjectData.name);
      expect(result.subjectCode).toBe(subjectData.subjectCode);
      expect(result.semester).toBe(subjectData.semester);
      expect(result.department).toBe(subjectData.department);
      expect(result._id).toBeDefined();
    });

    it('should throw error if subject code already exists', async () => {
      // Create first subject
      await createTestSubject({ subjectCode: 'CS101' });

      // Try to create another with same code
      const subjectData = {
        name: 'Another Subject',
        subjectCode: 'CS101',
        semester: 2,
        department: 'Computer Science',
      };

      await expect(createSubject(subjectData)).rejects.toThrow(
        'Subject with code CS101 already exists.'
      );
    });
  });

  // ============================================================================
  // getSubjects Tests
  // ============================================================================
  describe('getSubjects', () => {
    it('should return all subjects with pagination when no filter provided', async () => {
      await createTestSubject({ semester: 1 });
      await createTestSubject({ subjectCode: 'CS102', semester: 2 });
      await createTestSubject({ subjectCode: 'CS103', semester: 3 });

      const result = await getSubjects();

      expect(result.data).toHaveLength(3);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.total).toBe(3);
    });

    it('should filter subjects by semester', async () => {
      await createTestSubject({ subjectCode: 'CS101', semester: 3 });
      await createTestSubject({ subjectCode: 'CS102', semester: 3 });
      await createTestSubject({ subjectCode: 'CS103', semester: 4 });

      const result = await getSubjects({ semester: 3 });

      expect(result.data).toHaveLength(2);
      result.data.forEach((subject) => {
        expect(subject.semester).toBe(3);
      });
    });

    it('should return empty array when no subjects match filter', async () => {
      await createTestSubject({ semester: 1 });

      const result = await getSubjects({ semester: 8 });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should support search by name', async () => {
      await createTestSubject({ name: 'Data Structures', subjectCode: 'CS201' });
      await createTestSubject({ name: 'Algorithms', subjectCode: 'CS202' });

      const result = await getSubjects({ search: 'data' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Data Structures');
    });

    it('should support search by subject code', async () => {
      await createTestSubject({ name: 'Data Structures', subjectCode: 'CS201' });
      await createTestSubject({ name: 'Algorithms', subjectCode: 'CS202' });

      const result = await getSubjects({ search: 'CS202' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].subjectCode).toBe('CS202');
    });

    it('should support pagination', async () => {
      for (let i = 1; i <= 5; i++) {
        await createTestSubject({ name: `Subject ${i}`, subjectCode: `CS${100 + i}` });
      }

      const page1 = await getSubjects({ page: 1, limit: 2 });
      const page2 = await getSubjects({ page: 2, limit: 2 });

      expect(page1.data).toHaveLength(2);
      expect(page1.pagination.totalPages).toBe(3);
      expect(page1.pagination.hasMore).toBe(true);
      
      expect(page2.data).toHaveLength(2);
      expect(page2.pagination.page).toBe(2);
    });
  });

  // ============================================================================
  // getSubjectById Tests
  // ============================================================================
  describe('getSubjectById', () => {
    it('should return subject by ID', async () => {
      const subject = await createTestSubject({ name: 'Test Subject' });

      const result = await getSubjectById(subject._id);

      expect(result._id.toString()).toBe(subject._id.toString());
      expect(result.name).toBe('Test Subject');
    });

    it('should throw error for non-existent subject', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      await expect(getSubjectById(fakeId)).rejects.toThrow('Subject not found.');
    });
  });

  // ============================================================================
  // updateSubject Tests
  // ============================================================================
  describe('updateSubject', () => {
    it('should update subject fields', async () => {
      const subject = await createTestSubject({
        name: 'Old Name',
        department: 'Old Dept',
      });

      const result = await updateSubject(subject._id, {
        name: 'New Name',
        department: 'New Dept',
      });

      expect(result.name).toBe('New Name');
      expect(result.department).toBe('New Dept');
    });

    it('should throw error for non-existent subject', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      await expect(
        updateSubject(fakeId, { name: 'Test' })
      ).rejects.toThrow('Subject not found.');
    });

    it('should remove teacher assignments when semester changes', async () => {
      // Create subject with semester 3
      const subject = await createTestSubject({ semester: 3 });

      // Create teacher with assignment to this subject
      const teacher = await createTestUser({
        role: 'teacher',
        teacherDetails: {
          department: 'Computer Science',
          assignments: [
            {
              subject: subject._id,
              semester: 3,
              sections: ['A'],
            },
          ],
        },
      });

      // Update subject semester
      await updateSubject(subject._id, { semester: 4 });

      // Verify teacher assignment was removed
      const updatedTeacher = await User.findById(teacher._id);
      expect(updatedTeacher.teacherDetails.assignments).toHaveLength(0);
    });

    it('should remove student enrollments when semester changes', async () => {
      // Create subject with semester 3
      const subject = await createTestSubject({ semester: 3 });

      // Create student enrolled in this subject
      const student = await createTestUser({
        role: 'student',
        studentDetails: {
          semester: 3,
          section: 'A',
          enrolledSubjects: [subject._id],
        },
      });

      // Update subject semester
      await updateSubject(subject._id, { semester: 4 });

      // Verify student enrollment was removed
      const updatedStudent = await User.findById(student._id);
      expect(updatedStudent.studentDetails.enrolledSubjects).toHaveLength(0);
    });

    it('should not remove assignments when semester is unchanged', async () => {
      const subject = await createTestSubject({ semester: 3 });

      const teacher = await createTestUser({
        role: 'teacher',
        teacherDetails: {
          assignments: [
            {
              subject: subject._id,
              semester: 3,
              sections: ['A'],
            },
          ],
        },
      });

      // Update name only, not semester
      await updateSubject(subject._id, { name: 'Updated Name' });

      const updatedTeacher = await User.findById(teacher._id);
      expect(updatedTeacher.teacherDetails.assignments).toHaveLength(1);
    });
  });

  // ============================================================================
  // deleteSubject Tests
  // ============================================================================
  describe('deleteSubject', () => {
    it('should delete subject and return success message', async () => {
      const subject = await createTestSubject();

      const result = await deleteSubject(subject._id);

      expect(result.id.toString()).toBe(subject._id.toString());
      expect(result.message).toBe(
        'Subject and all its associations removed successfully.'
      );

      // Verify subject is deleted
      const deletedSubject = await Subject.findById(subject._id);
      expect(deletedSubject).toBeNull();
    });

    it('should throw error for non-existent subject', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      await expect(deleteSubject(fakeId)).rejects.toThrow('Subject not found.');
    });

    it('should remove teacher assignments when subject is deleted', async () => {
      const subject = await createTestSubject();

      const teacher = await createTestUser({
        role: 'teacher',
        teacherDetails: {
          assignments: [
            {
              subject: subject._id,
              semester: 3,
              sections: ['A'],
            },
          ],
        },
      });

      await deleteSubject(subject._id);

      const updatedTeacher = await User.findById(teacher._id);
      expect(updatedTeacher.teacherDetails.assignments).toHaveLength(0);
    });

    it('should remove student enrollments when subject is deleted', async () => {
      const subject = await createTestSubject();

      const student = await createTestUser({
        role: 'student',
        studentDetails: {
          semester: 3,
          section: 'A',
          enrolledSubjects: [subject._id],
        },
      });

      await deleteSubject(subject._id);

      const updatedStudent = await User.findById(student._id);
      expect(updatedStudent.studentDetails.enrolledSubjects).toHaveLength(0);
    });
  });
});
