import asyncHandler from 'express-async-handler';
import * as teacherAssignmentsService from '../services/teacher-assignments.service.js';

// ============================================================================
// Teacher Assignment Controllers
// ============================================================================

/**
 * @desc    Add or update a teacher's subject assignments
 * @route   POST /api/admin/teacher-assignments/:teacherId
 * @access  Private/Admin
 */
export const updateTeacherAssignments = asyncHandler(async (req, res) => {
  const { teacherId } = req.params;
  const assignmentData = req.body;

  const result = await teacherAssignmentsService.updateTeacherAssignments(
    teacherId,
    assignmentData
  );

  res.status(201).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Delete a teacher's subject assignment
 * @route   DELETE /api/admin/teacher-assignments/:teacherId/:assignmentId
 * @access  Private/Admin
 */
export const deleteTeacherAssignment = asyncHandler(async (req, res) => {
  const { teacherId, assignmentId } = req.params;

  const result = await teacherAssignmentsService.deleteTeacherAssignment(
    teacherId,
    assignmentId
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});
