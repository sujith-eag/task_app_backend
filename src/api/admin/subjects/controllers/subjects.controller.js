import asyncHandler from 'express-async-handler';
import * as subjectsService from '../services/subjects.service.js';

// ============================================================================
// Subject Controllers
// ============================================================================

/**
 * @desc    Create a new subject
 * @route   POST /api/admin/subjects
 * @access  Private/Admin
 */
export const createSubject = asyncHandler(async (req, res) => {
  const subjectData = req.body;

  const subject = await subjectsService.createSubject(subjectData);

  res.status(201).json({
    success: true,
    data: subject,
  });
});

/**
 * @desc    Get all subjects, with optional filtering by semester
 * @route   GET /api/admin/subjects
 * @access  Private/Admin
 */
export const getSubjects = asyncHandler(async (req, res) => {
  const filters = req.query;

  const subjects = await subjectsService.getSubjects(filters);

  res.status(200).json({
    success: true,
    count: subjects.length,
    data: subjects,
  });
});

/**
 * @desc    Get a single subject by ID
 * @route   GET /api/admin/subjects/:id
 * @access  Private/Admin
 */
export const getSubjectById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const subject = await subjectsService.getSubjectById(id);

  res.status(200).json({
    success: true,
    data: subject,
  });
});

/**
 * @desc    Update a subject
 * @route   PUT /api/admin/subjects/:id
 * @access  Private/Admin
 */
export const updateSubject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const updatedSubject = await subjectsService.updateSubject(id, updateData);

  res.status(200).json({
    success: true,
    data: updatedSubject,
  });
});

/**
 * @desc    Delete a subject
 * @route   DELETE /api/admin/subjects/:id
 * @access  Private/Admin
 */
export const deleteSubject = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await subjectsService.deleteSubject(id);

  res.status(200).json({
    success: true,
    data: result,
  });
});
