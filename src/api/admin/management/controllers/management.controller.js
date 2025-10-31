import asyncHandler from 'express-async-handler';
import * as managementService from '../services/management.service.js';

// ============================================================================
// User Management Controllers
// ============================================================================

/**
 * @desc    Get users by their role (verified only)
 * @route   GET /api/admin/management/users?role=user
 * @access  Private/Admin
 */
export const getUsersByRole = asyncHandler(async (req, res) => {
  const { role } = req.query;

  const users = await managementService.getUsersByRole(role);

  res.status(200).json({
    success: true,
    count: users.length,
    data: users,
  });
});

/**
 * @desc    Get all users with the teacher or hod role
 * @route   GET /api/admin/management/teachers
 * @access  Private/Admin
 */
export const getAllTeachers = asyncHandler(async (req, res) => {
  const teachers = await managementService.getAllTeachers();

  res.status(200).json({
    success: true,
    count: teachers.length,
    data: teachers,
  });
});

/**
 * @desc    Update a student's enrolled subjects
 * @route   PUT /api/admin/management/students/:studentId/enrollment
 * @access  Private/Admin
 */
export const updateStudentEnrollment = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const { subjectIds } = req.body;

  const result = await managementService.updateStudentEnrollment(
    studentId,
    subjectIds
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Promote a user to a faculty role (teacher/hod)
 * @route   PATCH /api/admin/management/users/:userId/promote
 * @access  Private/Admin
 */
export const promoteToFaculty = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const promotionData = req.body;

  const result = await managementService.promoteToFaculty(userId, promotionData);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Update a student's details by an admin
 * @route   PUT /api/admin/management/students/:studentId
 * @access  Private/Admin
 */
export const updateStudentDetails = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const updateData = req.body;

  const result = await managementService.updateStudentDetails(
    studentId,
    updateData
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});
