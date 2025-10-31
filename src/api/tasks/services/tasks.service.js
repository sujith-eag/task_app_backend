/**
 * Tasks Service
 * Business logic for task management
 */

import Task from '../../../models/taskModel.js';

/**
 * Get all tasks for a user with filtering and sorting
 */
export const getUserTasks = async (userId, filters = {}) => {
    const { status, priority, sortBy = 'createdAt:desc' } = filters;
    
    // Build query filter
    const query = { user: userId };
    if (status) query.status = status;
    if (priority) query.priority = priority;
    
    // Parse sorting
    let sort = {};
    if (sortBy) {
        const [field, order] = sortBy.split(':');
        sort[field] = order === 'asc' ? 1 : -1;
    } else {
        sort = { createdAt: -1 }; // Default sort
    }
    
    return await Task.find(query).sort(sort);
};

/**
 * Get a single task by ID
 */
export const getTaskById = async (taskId, userId) => {
    const task = await Task.findById(taskId);
    
    if (!task) {
        throw new Error('Task not found');
    }
    
    // Verify ownership
    if (task.user.toString() !== userId) {
        const error = new Error('User not authorized to access this task');
        error.statusCode = 403;
        throw error;
    }
    
    return task;
};

/**
 * Create a new task
 */
export const createTask = async (userId, taskData) => {
    const { title, description, dueDate, priority, status, tags } = taskData;
    
    if (!title) {
        const error = new Error('Title is required for the task');
        error.statusCode = 400;
        throw error;
    }
    
    const task = await Task.create({
        user: userId,
        title,
        description,
        dueDate,
        priority,
        status,
        tags,
    });
    
    return task;
};

/**
 * Create multiple tasks at once (bulk creation)
 */
export const createBulkTasks = async (userId, tasks) => {
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        const error = new Error('Please provide a valid array of tasks');
        error.statusCode = 400;
        throw error;
    }
    
    const MAX_AI_TASKS = 15;
    if (tasks.length > MAX_AI_TASKS) {
        const error = new Error(`Cannot create more than ${MAX_AI_TASKS} tasks at once`);
        error.statusCode = 400;
        throw error;
    }
    
    // Add user ID and default status to each task
    const tasksToCreate = tasks.map(task => ({
        ...task,
        user: userId,
        status: task.status || 'To Do',
    }));
    
    // Bulk insert
    const newTasks = await Task.insertMany(tasksToCreate);
    return newTasks;
};

/**
 * Update a task
 */
export const updateTask = async (taskId, userId, updateData) => {
    const task = await Task.findById(taskId);
    
    if (!task) {
        const error = new Error('Task not found');
        error.statusCode = 404;
        throw error;
    }
    
    // Verify ownership
    if (task.user.toString() !== userId) {
        const error = new Error('User not authorized to update this task');
        error.statusCode = 403;
        throw error;
    }
    
    const updatedTask = await Task.findByIdAndUpdate(
        taskId, 
        updateData, 
        { new: true, runValidators: true }
    );
    
    return updatedTask;
};

/**
 * Delete a task
 */
export const deleteTask = async (taskId, userId) => {
    const task = await Task.findById(taskId);
    
    if (!task) {
        const error = new Error('Task not found');
        error.statusCode = 404;
        throw error;
    }
    
    // Verify ownership
    if (task.user.toString() !== userId) {
        const error = new Error('User not authorized to delete this task');
        error.statusCode = 403;
        throw error;
    }
    
    await task.deleteOne();
    return { id: taskId };
};

/**
 * Get task statistics for a user
 */
export const getTaskStats = async (userId) => {
    const stats = await Task.aggregate([
        { $match: { user: userId } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);
    
    // Get priority distribution
    const priorityStats = await Task.aggregate([
        { $match: { user: userId } },
        {
            $group: {
                _id: '$priority',
                count: { $sum: 1 }
            }
        }
    ]);
    
    // Get overdue tasks count
    const overdueTasks = await Task.countDocuments({
        user: userId,
        dueDate: { $lt: new Date() },
        status: { $ne: 'Done' }
    });
    
    return {
        byStatus: stats,
        byPriority: priorityStats,
        overdue: overdueTasks,
        total: await Task.countDocuments({ user: userId })
    };
};
