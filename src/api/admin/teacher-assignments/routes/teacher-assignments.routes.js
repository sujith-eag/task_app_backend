import express from 'express';
import * as teacherAssignmentsController from '../controllers/teacher-assignments.controller.js';
import {
  validate,
  teacherAssignmentSchema,
  teacherIdParamSchema,
  assignmentIdParamSchema,
} from '../validators/teacher-assignments.validator.js';

const router = express.Router();

// ============================================================================
// Teacher Assignment Routes
// ============================================================================

/**
 * @route   POST /api/admin/teacher-assignments/:teacherId
 * @desc    Add or update a teacher's subject assignments
 * @access  Private/Admin
 */
router.post(
  '/:teacherId',
  validate(teacherIdParamSchema, 'params'),
  validate(teacherAssignmentSchema, 'body'),
  teacherAssignmentsController.updateTeacherAssignments
);

/**
 * @route   DELETE /api/admin/teacher-assignments/:teacherId/:assignmentId
 * @desc    Delete a teacher's subject assignment
 * @access  Private/Admin
 */
router.delete(
  '/:teacherId/:assignmentId',
  validate(assignmentIdParamSchema, 'params'),
  teacherAssignmentsController.deleteTeacherAssignment
);

export default router;
