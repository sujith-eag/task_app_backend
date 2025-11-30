import asyncHandler from 'express-async-handler';
import * as managementService from '../services/management.service.js';

// ============================================================================
// User Management Controllers
// ============================================================================

/**
 * @desc    Get users by their role with pagination and search
 * @route   GET /api/admin/management/users?role=user&page=1&limit=20&search=john
 * @access  Private/Admin
 */
export const getUsersByRole = asyncHandler(async (req, res) => {
  const { role, page = 1, limit = 20, search = '', sortBy = 'name', sortOrder = 'asc' } = req.query;

  const result = await managementService.getUsersByRole(role, {
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 20,
    search,
    sortBy,
    sortOrder,
  });

  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

/**
 * @desc    Get all teachers/HODs with pagination and search
 * @route   GET /api/admin/management/teachers?page=1&limit=20&search=john
 * @access  Private/Admin
 */
export const getAllTeachers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = '' } = req.query;

  const result = await managementService.getAllTeachers({
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 20,
    search,
  });

  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination,
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

  const result = await managementService.promoteToFaculty(userId, promotionData, req.user, req);

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


/**
 * @desc    List sessions across users (admin)
 * @route   GET /api/admin/management/sessions
 * @access  Private/Admin
 */
export const listAllSessions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, deviceId, ip, email, role } = req.query;

  const result = await managementService.listAllSessions({
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 20,
    deviceId,
    ip,
    email,
    role,
  });

  res.status(200).json({ success: true, meta: { total: result.total, page: result.page, pageSize: result.pageSize }, data: result.data });
});
