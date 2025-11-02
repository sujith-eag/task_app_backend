/**
 * Tasks Routes
 * RESTful API routes for task and subtask management
 */

import express from 'express';
import * as tasksController from '../controllers/tasks.controller.js';
import * as subtasksController from '../controllers/subtasks.controller.js';
import * as validators from '../validators/tasks.validator.js';
import { protect } from '../../_common/middleware/auth.middleware.js';
// validators include validation middleware; standalone `validate` import removed

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// ========================================
// TASK ROUTES
// ========================================

/**
 * @route   GET /api/tasks
 * @desc    Get all tasks for logged-in user with filtering
 * @query   status, priority, sortBy
 * @access  Private
 */
router.get(
    '/',
    validators.validateTaskQuery,
    tasksController.getTasks
);

/**
 * @route   GET /api/tasks/stats
 * @desc    Get task statistics for logged-in user
 * @access  Private
 */
router.get('/stats', tasksController.getTaskStats);

/**
 * @route   POST /api/tasks
 * @desc    Create a new task
 * @access  Private
 */
router.post(
    '/',
    validators.validateCreateTask,
    tasksController.createTask
);

/**
 * @route   POST /api/tasks/bulk
 * @desc    Create multiple tasks at once
 * @access  Private
 */
router.post(
    '/bulk',
    validators.validateBulkCreate,
    tasksController.createBulkTasks
);

/**
 * @route   GET /api/tasks/:id
 * @desc    Get a single task by ID
 * @access  Private
 */
router.get(
    '/:id',
    validators.validateTaskId,
    tasksController.getTask
);

/**
 * @route   PUT /api/tasks/:id
 * @desc    Update a task
 * @access  Private
 */
router.put(
    '/:id',
    validators.validateUpdateTask,
    tasksController.updateTask
);

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Delete a task
 * @access  Private
 */
router.delete(
    '/:id',
    validators.validateTaskId,
    tasksController.deleteTask
);

// ========================================
// SUBTASK ROUTES
// ========================================

/**
 * @route   GET /api/tasks/:id/subtasks/stats
 * @desc    Get subtask completion statistics
 * @access  Private
 */
router.get(
    '/:id/subtasks/stats',
    validators.validateTaskId,
    subtasksController.getSubTaskStats
);

/**
 * @route   POST /api/tasks/:id/subtasks
 * @desc    Add a subtask to a task
 * @access  Private
 */
router.post(
    '/:id/subtasks',
    validators.validateCreateSubTask,
    subtasksController.addSubTask
);

/**
 * @route   PUT /api/tasks/:id/subtasks/:subTaskId
 * @desc    Update a subtask
 * @access  Private
 */
router.put(
    '/:id/subtasks/:subTaskId',
    validators.validateUpdateSubTask,
    subtasksController.updateSubTask
);

/**
 * @route   DELETE /api/tasks/:id/subtasks/:subTaskId
 * @desc    Delete a subtask
 * @access  Private
 */
router.delete(
    '/:id/subtasks/:subTaskId',
    validators.validateSubTaskIds,
    subtasksController.deleteSubTask
);

export default router;
