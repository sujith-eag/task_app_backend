/**
 * Tasks Validators
 * Input validation middleware for task-related requests
 */

import { body, param, query } from 'express-validator';

/**
 * Validate task creation
 */
export const validateCreateTask = [
    body('title')
        .notEmpty()
        .withMessage('Title is required')
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Title must be between 1 and 200 characters'),
    
    body('description')
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage('Description must not exceed 2000 characters'),
    
    body('dueDate')
        .optional()
        .isISO8601()
        .withMessage('Due date must be a valid date'),
    
    body('priority')
        .optional()
        .isIn(['Low', 'Medium', 'High'])
        .withMessage('Priority must be Low, Medium, or High'),
    
    body('status')
        .optional()
        .isIn(['To Do', 'In Progress', 'Done'])
        .withMessage('Status must be To Do, In Progress, or Done'),
    
    body('tags')
        .optional()
        .isArray()
        .withMessage('Tags must be an array'),
    
    body('tags.*')
        .optional()
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('Each tag must be between 1 and 50 characters')
];

/**
 * Validate task update
 */
export const validateUpdateTask = [
    param('id')
        .isMongoId()
        .withMessage('Invalid task ID'),
    
    body('title')
        .optional()
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Title must be between 1 and 200 characters'),
    
    body('description')
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage('Description must not exceed 2000 characters'),
    
    body('dueDate')
        .optional()
        .isISO8601()
        .withMessage('Due date must be a valid date'),
    
    body('priority')
        .optional()
        .isIn(['Low', 'Medium', 'High'])
        .withMessage('Priority must be Low, Medium, or High'),
    
    body('status')
        .optional()
        .isIn(['To Do', 'In Progress', 'Done'])
        .withMessage('Status must be To Do, In Progress, or Done'),
    
    body('tags')
        .optional()
        .isArray()
        .withMessage('Tags must be an array'),
    
    body('tags.*')
        .optional()
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('Each tag must be between 1 and 50 characters')
];

/**
 * Validate bulk task creation
 */
export const validateBulkCreate = [
    body('tasks')
        .isArray({ min: 1 })
        .withMessage('Tasks must be a non-empty array'),
    
    body('tasks.*.title')
        .notEmpty()
        .withMessage('Each task must have a title')
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Title must be between 1 and 200 characters'),
    
    body('tasks.*.description')
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage('Description must not exceed 2000 characters'),
    
    body('tasks.*.dueDate')
        .optional()
        .isISO8601()
        .withMessage('Due date must be a valid date'),
    
    body('tasks.*.priority')
        .optional()
        .isIn(['Low', 'Medium', 'High'])
        .withMessage('Priority must be Low, Medium, or High'),
    
    body('tasks.*.tags')
        .optional()
        .isArray()
        .withMessage('Tags must be an array')
];

/**
 * Validate task ID parameter
 */
export const validateTaskId = [
    param('id')
        .isMongoId()
        .withMessage('Invalid task ID')
];

/**
 * Validate task query parameters
 */
export const validateTaskQuery = [
    query('status')
        .optional()
        .isIn(['To Do', 'In Progress', 'Done'])
        .withMessage('Status must be To Do, In Progress, or Done'),
    
    query('priority')
        .optional()
        .isIn(['Low', 'Medium', 'High'])
        .withMessage('Priority must be Low, Medium, or High'),
    
    query('sortBy')
        .optional()
        .matches(/^(title|dueDate|priority|status|createdAt|updatedAt):(asc|desc)$/)
        .withMessage('sortBy must be in format field:order (e.g., dueDate:asc)')
];

/**
 * Validate subtask creation
 */
export const validateCreateSubTask = [
    param('id')
        .isMongoId()
        .withMessage('Invalid task ID'),
    
    body('text')
        .notEmpty()
        .withMessage('Subtask text is required')
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Subtask text must be between 1 and 200 characters')
];

/**
 * Validate subtask update
 */
export const validateUpdateSubTask = [
    param('id')
        .isMongoId()
        .withMessage('Invalid task ID'),
    
    param('subTaskId')
        .isMongoId()
        .withMessage('Invalid subtask ID'),
    
    body('text')
        .optional()
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Subtask text must be between 1 and 200 characters'),
    
    body('completed')
        .optional()
        .isBoolean()
        .withMessage('Completed must be a boolean value')
];

/**
 * Validate subtask ID parameters
 */
export const validateSubTaskIds = [
    param('id')
        .isMongoId()
        .withMessage('Invalid task ID'),
    
    param('subTaskId')
        .isMongoId()
        .withMessage('Invalid subtask ID')
];
