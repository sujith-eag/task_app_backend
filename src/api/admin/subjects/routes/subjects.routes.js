import express from 'express';
import * as subjectsController from '../controllers/subjects.controller.js';
import {
  validate,
  createSubjectSchema,
  updateSubjectSchema,
  semesterQuerySchema,
  subjectIdParamSchema,
} from '../validators/subjects.validator.js';

const router = express.Router();

// ============================================================================
// Subject Routes
// ============================================================================

/**
 * @route   POST /api/admin/subjects
 * @desc    Create a new subject
 * @access  Private/Admin
 * 
 * @route   GET /api/admin/subjects
 * @desc    Get all subjects (with optional semester filter)
 * @access  Private/Admin
 */
router
  .route('/')
  .post(validate(createSubjectSchema, 'body'), subjectsController.createSubject)
  .get(validate(semesterQuerySchema, 'query'), subjectsController.getSubjects);

/**
 * @route   GET /api/admin/subjects/:id
 * @desc    Get a single subject by ID
 * @access  Private/Admin
 * 
 * @route   PUT /api/admin/subjects/:id
 * @desc    Update a subject
 * @access  Private/Admin
 * 
 * @route   DELETE /api/admin/subjects/:id
 * @desc    Delete a subject
 * @access  Private/Admin
 */
router
  .route('/:id')
  .get(
    validate(subjectIdParamSchema, 'params'),
    subjectsController.getSubjectById
  )
  .put(
    validate(subjectIdParamSchema, 'params'),
    validate(updateSubjectSchema, 'body'),
    subjectsController.updateSubject
  )
  .delete(
    validate(subjectIdParamSchema, 'params'),
    subjectsController.deleteSubject
  );

export default router;
