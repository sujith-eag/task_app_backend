import express from 'express';
import * as managementController from '../controllers/management.controller.js';
import {
  validate,
  updateStudentDetailsSchema,
  updateEnrollmentSchema,
  facultyPromotionSchema,
  roleQuerySchema,
  userIdParamSchema,
  studentIdParamSchema,
} from '../validators/management.validator.js';

const router = express.Router();

// ============================================================================
// User Management Routes
// ============================================================================

/**
 * @route   GET /api/admin/management/users?role=user
 * @desc    Get users by their role (verified only)
 * @access  Private/Admin
 */
router.get(
  '/users',
  validate(roleQuerySchema, 'query'),
  managementController.getUsersByRole
);

/**
 * @route   GET /api/admin/management/teachers
 * @desc    Get all users with the teacher or hod role
 * @access  Private/Admin
 */
router.get('/teachers', managementController.getAllTeachers);

/**
 * @route   PATCH /api/admin/management/users/:userId/promote
 * @desc    Promote a user to a faculty role (teacher/hod)
 * @access  Private/Admin
 */
router.patch(
  '/users/:userId/promote',
  validate(userIdParamSchema, 'params'),
  validate(facultyPromotionSchema, 'body'),
  managementController.promoteToFaculty
);

/**
 * @route   PUT /api/admin/management/students/:studentId
 * @desc    Update a student's details by an admin
 * @access  Private/Admin
 */
router.put(
  '/students/:studentId',
  validate(studentIdParamSchema, 'params'),
  validate(updateStudentDetailsSchema, 'body'),
  managementController.updateStudentDetails
);

/**
 * @route   PUT /api/admin/management/students/:studentId/enrollment
 * @desc    Update a student's enrolled subjects
 * @access  Private/Admin
 */
router.put(
  '/students/:studentId/enrollment',
  validate(studentIdParamSchema, 'params'),
  validate(updateEnrollmentSchema, 'body'),
  managementController.updateStudentEnrollment
);

export default router;
