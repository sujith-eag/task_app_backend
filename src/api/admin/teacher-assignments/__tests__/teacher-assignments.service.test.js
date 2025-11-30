/**
 * Teacher Assignments Service Tests
 * Unit tests for admin teacher assignment operations
 */

import mongoose from 'mongoose';
import {
  updateTeacherAssignments,
  deleteTeacherAssignment,
} from '../services/teacher-assignments.service.js';
import User from '../../../../models/userModel.js';
import { createTestUser, createTestSubject } from '../../../../test/utils.js';

describe('Teacher Assignments Service', () => {
  let teacher, subject;

  beforeEach(async () => {
    subject = await createTestSubject({ semester: 3 });
    teacher = await createTestUser({
      role: 'teacher',
      teacherDetails: {
        department: 'Computer Science',
        assignments: [],
      },
    });
  });

  // ============================================================================
  // updateTeacherAssignments Tests
  // ============================================================================
  describe('updateTeacherAssignments', () => {
    it('should add a new assignment to teacher', async () => {
      const assignmentData = {
        subject: subject._id.toString(),
        sections: ['A', 'B'],
        batch: 2024,
        semester: 3,
      };

      const result = await updateTeacherAssignments(
        teacher._id.toString(),
        assignmentData
      );

      expect(result.message).toBe('Teacher assignment updated successfully.');
      expect(result.teacherDetails.assignments).toHaveLength(1);
    });

    it('should allow assignments for HOD users', async () => {
      const hod = await createTestUser({
        role: 'hod',
        teacherDetails: {
          department: 'Computer Science',
          assignments: [],
        },
      });

      const assignmentData = {
        subject: subject._id.toString(),
        sections: ['A'],
        batch: 2024,
        semester: 3,
      };

      const result = await updateTeacherAssignments(
        hod._id.toString(),
        assignmentData
      );

      expect(result.message).toBe('Teacher assignment updated successfully.');
    });

    it('should throw error for invalid subject ID', async () => {
      const fakeSubjectId = new mongoose.Types.ObjectId();
      const assignmentData = {
        subject: fakeSubjectId.toString(),
        sections: ['A'],
        batch: 2024,
        semester: 3,
      };

      await expect(
        updateTeacherAssignments(teacher._id.toString(), assignmentData)
      ).rejects.toThrow('Invalid Subject ID. Subject does not exist.');
    });

    it('should throw error for semester mismatch', async () => {
      const assignmentData = {
        subject: subject._id.toString(),
        sections: ['A'],
        batch: 2024,
        semester: 5, // Subject is semester 3
      };

      await expect(
        updateTeacherAssignments(teacher._id.toString(), assignmentData)
      ).rejects.toThrow(/Semester mismatch/);
    });

    it('should throw error for non-teacher user', async () => {
      const student = await createTestUser({ role: 'student' });

      const assignmentData = {
        subject: subject._id.toString(),
        sections: ['A'],
        batch: 2024,
        semester: 3,
      };

      await expect(
        updateTeacherAssignments(student._id.toString(), assignmentData)
      ).rejects.toThrow('Teacher not found.');
    });

    it('should throw error for duplicate assignment', async () => {
      const assignmentData = {
        subject: subject._id.toString(),
        sections: ['A'],
        batch: 2024,
        semester: 3,
      };

      // Add first assignment
      await updateTeacherAssignments(teacher._id.toString(), assignmentData);

      // Try to add duplicate
      await expect(
        updateTeacherAssignments(teacher._id.toString(), assignmentData)
      ).rejects.toThrow('This exact assignment already exists for this teacher.');
    });

    it('should allow same subject with different sections', async () => {
      const assignment1 = {
        subject: subject._id.toString(),
        sections: ['A'],
        batch: 2024,
        semester: 3,
      };

      const assignment2 = {
        subject: subject._id.toString(),
        sections: ['B'],
        batch: 2024,
        semester: 3,
      };

      await updateTeacherAssignments(teacher._id.toString(), assignment1);
      const result = await updateTeacherAssignments(
        teacher._id.toString(),
        assignment2
      );

      expect(result.teacherDetails.assignments).toHaveLength(2);
    });

    it('should populate subject details in response', async () => {
      const assignmentData = {
        subject: subject._id.toString(),
        sections: ['A'],
        batch: 2024,
        semester: 3,
      };

      const result = await updateTeacherAssignments(
        teacher._id.toString(),
        assignmentData
      );

      const assignment = result.teacherDetails.assignments[0];
      expect(assignment.subject.name).toBeDefined();
      expect(assignment.subject.subjectCode).toBeDefined();
    });
  });

  // ============================================================================
  // deleteTeacherAssignment Tests
  // ============================================================================
  describe('deleteTeacherAssignment', () => {
    it('should delete an existing assignment', async () => {
      // First add an assignment
      teacher.teacherDetails.assignments.push({
        subject: subject._id,
        sections: ['A'],
        batch: 2024,
        semester: 3,
      });
      await teacher.save();

      const assignmentId =
        teacher.teacherDetails.assignments[0]._id.toString();

      const result = await deleteTeacherAssignment(
        teacher._id.toString(),
        assignmentId
      );

      expect(result.message).toBe('Assignment removed successfully.');

      // Verify deletion
      const updatedTeacher = await User.findById(teacher._id);
      expect(updatedTeacher.teacherDetails.assignments).toHaveLength(0);
    });

    it('should throw error for non-existent teacher', async () => {
      const fakeTeacherId = new mongoose.Types.ObjectId();
      const fakeAssignmentId = new mongoose.Types.ObjectId();

      await expect(
        deleteTeacherAssignment(
          fakeTeacherId.toString(),
          fakeAssignmentId.toString()
        )
      ).rejects.toThrow('Faculty member not found.');
    });

    it('should throw error for non-existent assignment', async () => {
      const fakeAssignmentId = new mongoose.Types.ObjectId();

      await expect(
        deleteTeacherAssignment(
          teacher._id.toString(),
          fakeAssignmentId.toString()
        )
      ).rejects.toThrow('Assignment not found for this faculty member.');
    });

    it('should throw error when trying to delete from student', async () => {
      const student = await createTestUser({ role: 'student' });
      const fakeAssignmentId = new mongoose.Types.ObjectId();

      await expect(
        deleteTeacherAssignment(
          student._id.toString(),
          fakeAssignmentId.toString()
        )
      ).rejects.toThrow('Faculty member not found.');
    });

    it('should only delete the specified assignment', async () => {
      const subject2 = await createTestSubject({ subjectCode: 'CS102' });

      // Add two assignments
      teacher.teacherDetails.assignments.push(
        { subject: subject._id, sections: ['A'], batch: 2024, semester: 3 },
        { subject: subject2._id, sections: ['B'], batch: 2024, semester: 3 }
      );
      await teacher.save();

      const assignmentIdToDelete =
        teacher.teacherDetails.assignments[0]._id.toString();

      await deleteTeacherAssignment(
        teacher._id.toString(),
        assignmentIdToDelete
      );

      const updatedTeacher = await User.findById(teacher._id);
      expect(updatedTeacher.teacherDetails.assignments).toHaveLength(1);
      expect(
        updatedTeacher.teacherDetails.assignments[0].subject.toString()
      ).toBe(subject2._id.toString());
    });
  });
});
