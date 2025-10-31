import express from 'express';
import subjectsController from './subjects.controller.js';

const router = express.Router();

/**
 * Subjects Routes (Admin Domain)
 * 
 * Subject CRUD operations - administrative function
 * Migrated from src/api/college/subject.routes.js
 * 
 * All routes require admin authentication (handled by parent router)
 */

// Create and list subjects
router.route('/')
  .post(subjectsController.createSubject)
  .get(subjectsController.getSubjects);

// Get, update, and delete specific subject
router.route('/:id')
  .get(subjectsController.getSubjectById)
  .patch(subjectsController.updateSubject)
  .delete(subjectsController.deleteSubject);

// Get subject usage statistics
router.get('/:id/usage', subjectsController.getSubjectUsage);

export default router;
