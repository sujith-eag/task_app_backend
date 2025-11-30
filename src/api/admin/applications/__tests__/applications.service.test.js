/**
 * Applications Service Tests
 * Unit tests for admin application review functionality
 */

import mongoose from 'mongoose';
import * as applicationsService from '../services/applications.service.js';
import User from '../../../../models/userModel.js';
import {
  createTestAdmin,
  createPendingApplication,
  createMockRequest,
} from '../../../../test/utils.js';

describe('Applications Service', () => {
  let admin;

  beforeEach(async () => {
    admin = await createTestAdmin();
  });

  describe('getPendingApplications', () => {
    it('should return empty array when no pending applications', async () => {
      const result = await applicationsService.getPendingApplications();
      
      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(0);
    });

    it('should return all pending applications', async () => {
      // Create multiple pending applications
      await createPendingApplication({ name: 'Student 1' });
      await createPendingApplication({ name: 'Student 2' });
      await createPendingApplication({ name: 'Student 3' });

      const result = await applicationsService.getPendingApplications();

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('email');
      expect(result[0]).toHaveProperty('studentDetails');
    });

    it('should not return approved applications', async () => {
      await createPendingApplication({ 
        name: 'Pending Student',
        studentDetails: { applicationStatus: 'pending' }
      });
      
      await createPendingApplication({ 
        name: 'Approved Student',
        studentDetails: { applicationStatus: 'approved' }
      });

      const result = await applicationsService.getPendingApplications();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Pending Student');
    });

    it('should not return rejected applications', async () => {
      await createPendingApplication({ 
        name: 'Pending Student',
        studentDetails: { applicationStatus: 'pending' }
      });
      
      await createPendingApplication({ 
        name: 'Rejected Student',
        studentDetails: { applicationStatus: 'rejected' }
      });

      const result = await applicationsService.getPendingApplications();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Pending Student');
    });

    it('should return only selected fields', async () => {
      await createPendingApplication();

      const result = await applicationsService.getPendingApplications();

      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('email');
      expect(result[0]).toHaveProperty('studentDetails');
      // Should not have password or other sensitive fields
      expect(result[0]).not.toHaveProperty('password');
      expect(result[0]).not.toHaveProperty('sessions');
    });
  });

  describe('reviewApplication', () => {
    let pendingStudent;
    let mockReq;

    beforeEach(async () => {
      pendingStudent = await createPendingApplication();
      mockReq = createMockRequest({ user: admin });
    });

    describe('approve action', () => {
      it('should approve a pending application', async () => {
        const result = await applicationsService.reviewApplication(
          pendingStudent._id.toString(),
          'approve',
          admin,
          mockReq
        );

        expect(result).toHaveProperty('message', 'Application approved successfully');
        expect(result).toHaveProperty('applicationStatus', 'approved');
        expect(result.roles).toContain('student');
      });

      it('should update user roles to student', async () => {
        await applicationsService.reviewApplication(
          pendingStudent._id.toString(),
          'approve',
          admin,
          mockReq
        );

        // Fetch updated user
        const updatedUser = await User.findById(pendingStudent._id);

        expect(updatedUser.roles).toContain('student');
        expect(updatedUser.studentDetails.isStudentVerified).toBe(true);
      });

      it('should set applicationStatus to approved', async () => {
        await applicationsService.reviewApplication(
          pendingStudent._id.toString(),
          'approve',
          admin,
          mockReq
        );

        const updatedUser = await User.findById(pendingStudent._id);

        expect(updatedUser.studentDetails.applicationStatus).toBe('approved');
      });
    });

    describe('reject action', () => {
      it('should reject a pending application', async () => {
        const result = await applicationsService.reviewApplication(
          pendingStudent._id.toString(),
          'reject',
          admin,
          mockReq
        );

        expect(result).toHaveProperty('message', 'Application rejectd successfully');
        expect(result).toHaveProperty('applicationStatus', 'rejected');
      });

      it('should clear student details on rejection', async () => {
        await applicationsService.reviewApplication(
          pendingStudent._id.toString(),
          'reject',
          admin,
          mockReq
        );

        const updatedUser = await User.findById(pendingStudent._id);

        expect(updatedUser.studentDetails.applicationStatus).toBe('rejected');
        expect(updatedUser.studentDetails.usn).toBeNull();
        expect(updatedUser.studentDetails.batch).toBeNull();
        expect(updatedUser.studentDetails.section).toBeNull();
      });
    });

    describe('error cases', () => {
      it('should throw error for non-existent user', async () => {
        const fakeId = '507f1f77bcf86cd799439011';

        await expect(
          applicationsService.reviewApplication(fakeId, 'approve', admin, mockReq)
        ).rejects.toThrow('User not found');
      });

      it('should throw error for already reviewed application', async () => {
        // First approve
        await applicationsService.reviewApplication(
          pendingStudent._id.toString(),
          'approve',
          admin,
          mockReq
        );

        // Try to approve again
        await expect(
          applicationsService.reviewApplication(
            pendingStudent._id.toString(),
            'approve',
            admin,
            mockReq
          )
        ).rejects.toThrow('Application has already been reviewed');
      });

      it('should throw error for rejected then approve attempt', async () => {
        // First reject
        await applicationsService.reviewApplication(
          pendingStudent._id.toString(),
          'reject',
          admin,
          mockReq
        );

        // Try to approve
        await expect(
          applicationsService.reviewApplication(
            pendingStudent._id.toString(),
            'approve',
            admin,
            mockReq
          )
        ).rejects.toThrow('Application has already been reviewed');
      });
    });
  });
});
