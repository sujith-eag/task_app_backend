import express from 'express';

import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  addSubTask,
  updateSubTask,
  deleteSubTask,
} from '../controllers/taskController.js';

import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect); // applies to all routes below


// -- Core Task Routes --

router.route('/')  // Chain GET and POST for the base route '/'
  .get(getTasks)     // GET /api/tasks – list all for logged-in user  .post( createTask);
  .post(createTask); // POST /api/tasks – create new task

router.route('/:id')  // Chain PUT and DELETE for the '/:id' route
  .put(updateTask)    // PUT /api/tasks/:id – update
  .delete(deleteTask) // DELETE /api/tasks/:id – delete


// --- Sub-Task Routes ---

router.route('/:id/subtasks')  
  .post( addSubTask)    // Add a sub-task to a specific task

router.route('/:id/subtasks/:subTaskId')
  .put( updateSubTask)        // update subtask
  .delete( deleteSubTask);    // delete subtask

// router.post('/:id/subtasks', protect, addSubTask);

export default router;