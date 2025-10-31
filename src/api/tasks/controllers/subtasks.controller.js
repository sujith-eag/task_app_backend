/**
 * Subtasks Controller
 * HTTP request handlers for subtask management
 */

import asyncHandler from 'express-async-handler';
import * as subtasksService from '../services/subtasks.service.js';

/**
 * @desc    Add a subtask to a task
 * @route   POST /api/tasks/:id/subtasks
 * @access  Private
 */
export const addSubTask = asyncHandler(async (req, res) => {
    const task = await subtasksService.addSubTask(
        req.params.id,
        req.user.id,
        req.body
    );
    res.status(200).json(task);
});

/**
 * @desc    Update a subtask
 * @route   PUT /api/tasks/:id/subtasks/:subTaskId
 * @access  Private
 */
export const updateSubTask = asyncHandler(async (req, res) => {
    const task = await subtasksService.updateSubTask(
        req.params.id,
        req.params.subTaskId,
        req.user.id,
        req.body
    );
    res.status(200).json(task);
});

/**
 * @desc    Delete a subtask
 * @route   DELETE /api/tasks/:id/subtasks/:subTaskId
 * @access  Private
 */
export const deleteSubTask = asyncHandler(async (req, res) => {
    const task = await subtasksService.deleteSubTask(
        req.params.id,
        req.params.subTaskId,
        req.user.id
    );
    res.status(200).json(task);
});

/**
 * @desc    Get subtask completion statistics
 * @route   GET /api/tasks/:id/subtasks/stats
 * @access  Private
 */
export const getSubTaskStats = asyncHandler(async (req, res) => {
    const stats = await subtasksService.getSubTaskStats(
        req.params.id,
        req.user.id
    );
    res.status(200).json(stats);
});
