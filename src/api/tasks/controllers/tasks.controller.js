/**
 * Tasks Controller
 * HTTP request handlers for task management
 */

import asyncHandler from 'express-async-handler';
import * as tasksService from '../services/tasks.service.js';

/**
 * @desc    Get tasks with filtering and sorting
 * @route   GET /api/tasks
 * @access  Private
 */
export const getTasks = asyncHandler(async (req, res) => {
    const { status, priority, sortBy } = req.query;
    
    const tasks = await tasksService.getUserTasks(req.user.id, {
        status,
        priority,
        sortBy
    });
    
    res.status(200).json(tasks);
});

/**
 * @desc    Get a single task by ID
 * @route   GET /api/tasks/:id
 * @access  Private
 */
export const getTask = asyncHandler(async (req, res) => {
    const task = await tasksService.getTaskById(req.params.id, req.user.id);
    res.status(200).json(task);
});

/**
 * @desc    Create a new task
 * @route   POST /api/tasks
 * @access  Private
 */
export const createTask = asyncHandler(async (req, res) => {
    // Debug: log request body in non-production to aid diagnosing 400s
    try {
        if (process.env.NODE_ENV !== 'production') {
            console.debug('[createTask] user:', req.user?.id, 'body:', JSON.stringify(req.body));
        }
    } catch (e) {
        /* ignore logging errors */
    }
    const task = await tasksService.createTask(req.user.id, req.body);
    res.status(201).json(task);
});

/**
 * @desc    Create multiple tasks at once
 * @route   POST /api/tasks/bulk
 * @access  Private
 */
export const createBulkTasks = asyncHandler(async (req, res) => {
    const { tasks } = req.body;
    const newTasks = await tasksService.createBulkTasks(req.user.id, tasks);
    res.status(201).json(newTasks);
});

/**
 * @desc    Update a task
 * @route   PUT /api/tasks/:id
 * @access  Private
 */
export const updateTask = asyncHandler(async (req, res) => {
    const updatedTask = await tasksService.updateTask(
        req.params.id, 
        req.user.id, 
        req.body
    );
    res.status(200).json(updatedTask);
});

/**
 * @desc    Delete a task
 * @route   DELETE /api/tasks/:id
 * @access  Private
 */
export const deleteTask = asyncHandler(async (req, res) => {
    const result = await tasksService.deleteTask(req.params.id, req.user.id);
    res.status(200).json(result);
});

/**
 * @desc    Get task statistics
 * @route   GET /api/tasks/stats
 * @access  Private
 */
export const getTaskStats = asyncHandler(async (req, res) => {
    const stats = await tasksService.getTaskStats(req.user.id);
    res.status(200).json(stats);
});
