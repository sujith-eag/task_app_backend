import express from 'express';
const router = express.Router();

import {
  getTasks,
  setTasks,
  updateTasks,
  deleteTasks,
  addSubTask,
  updateSubTask,
  deleteSubTask,
} from '../controllers/taskController.js';

import protect from '../middleware/authMiddleware.js';

// --- Main Task Routes ---
// Chain GET and POST for the base route '/'
router.route('/')
  .get(protect, getTasks)
  .post(protect, setTasks);

// Chain PUT and DELETE for the '/:id' route
router.route('/:id')
  .put(protect, updateTasks)
  .delete(protect, deleteTasks);

// --- Sub-Task Routes ---
// Add a sub-task to a specific task
router.post('/:id/subtasks', protect, addSubTask);

// Update or delete a specific sub-task
router.route('/:id/subtasks/:subTaskId')
  .put(protect, updateSubTask)
  .delete(protect, deleteSubTask);

export default router;