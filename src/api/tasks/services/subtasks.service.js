/**
 * Subtasks Service
 * Business logic for subtask management within tasks
 */

import Task from '../../../models/taskModel.js';

/**
 * Verify task ownership and retrieve task
 */
const verifyTaskOwnership = async (taskId, userId) => {
    const task = await Task.findById(taskId);
    
    if (!task) {
        const error = new Error('Task not found');
        error.statusCode = 404;
        throw error;
    }
    
    if (task.user.toString() !== userId) {
        const error = new Error('User not authorized');
        error.statusCode = 403;
        throw error;
    }
    
    return task;
};

/**
 * Add a subtask to a task
 */
export const addSubTask = async (taskId, userId, subTaskData) => {
    const { text } = subTaskData;
    
    if (!text) {
        const error = new Error('Please provide text for the sub-task');
        error.statusCode = 400;
        throw error;
    }
    
    const task = await verifyTaskOwnership(taskId, userId);
    
    const newSubTask = {
        text,
        completed: false,
    };
    
    task.subTasks.push(newSubTask);
    await task.save();
    
    return task;
};

/**
 * Update a subtask
 */
export const updateSubTask = async (taskId, subTaskId, userId, updateData) => {
    const task = await verifyTaskOwnership(taskId, userId);
    
    const subTask = task.subTasks.id(subTaskId);
    if (!subTask) {
        const error = new Error('Subtask not found');
        error.statusCode = 404;
        throw error;
    }
    
    const { text, completed } = updateData;
    if (text !== undefined) subTask.text = text;
    if (completed !== undefined) subTask.completed = completed;
    
    await task.save();
    return task;
};

/**
 * Delete a subtask
 */
export const deleteSubTask = async (taskId, subTaskId, userId) => {
    const task = await verifyTaskOwnership(taskId, userId);
    
    const subTask = task.subTasks.id(subTaskId);
    if (!subTask) {
        const error = new Error('Sub-task not found');
        error.statusCode = 404;
        throw error;
    }
    
    subTask.deleteOne();
    await task.save();
    
    return task;
};

/**
 * Get completion statistics for subtasks
 */
export const getSubTaskStats = async (taskId, userId) => {
    const task = await verifyTaskOwnership(taskId, userId);
    
    const total = task.subTasks.length;
    const completed = task.subTasks.filter(st => st.completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return {
        total,
        completed,
        pending: total - completed,
        completionPercentage: percentage
    };
};
