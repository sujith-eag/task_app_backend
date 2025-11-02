/**
 * Tasks Validators (Joi)
 */
import Joi from 'joi';
import validate from '../../_common/middleware/validation.middleware.js';

const mongoId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).message('Invalid ID format');

const tag = Joi.string().trim().min(1).max(50);

const baseTaskFields = {
  title: Joi.string().trim().min(1).max(200),
  description: Joi.string().trim().max(2000).allow('', null),
  dueDate: Joi.date().iso().allow(null),
  priority: Joi.string().valid('Low', 'Medium', 'High'),
  status: Joi.string().valid('To Do', 'In Progress', 'Done'),
  tags: Joi.array().items(tag)
};

export const validateCreateTask = [
  validate({ body: Joi.object({
    title: baseTaskFields.title.required().messages({ 'any.required': 'Title is required' }),
    description: baseTaskFields.description.optional(),
    dueDate: baseTaskFields.dueDate.optional(),
    priority: baseTaskFields.priority.optional(),
    status: baseTaskFields.status.optional(),
    tags: baseTaskFields.tags.optional()
  }) })
];

export const validateUpdateTask = [
  validate({
    params: Joi.object({ id: mongoId.required() }),
    body: Joi.object({
      title: baseTaskFields.title.optional(),
      description: baseTaskFields.description.optional(),
      dueDate: baseTaskFields.dueDate.optional(),
      priority: baseTaskFields.priority.optional(),
      status: baseTaskFields.status.optional(),
      tags: baseTaskFields.tags.optional()
    }).min(1)
  })
];

export const validateBulkCreate = [
  validate({ body: Joi.object({
    tasks: Joi.array().items(Joi.object({
      title: Joi.string().trim().min(1).max(200).required(),
      description: Joi.string().trim().max(2000).optional(),
      dueDate: Joi.date().iso().optional(),
      priority: Joi.string().valid('Low', 'Medium', 'High').optional(),
      tags: Joi.array().items(tag).optional()
    })).min(1).required()
  }) })
];

export const validateTaskId = [
  validate({ params: Joi.object({ id: mongoId.required() }) })
];

export const validateTaskQuery = [
  validate({ query: Joi.object({
    status: Joi.string().valid('To Do', 'In Progress', 'Done').optional(),
    priority: Joi.string().valid('Low', 'Medium', 'High').optional(),
    sortBy: Joi.string().pattern(/^(title|dueDate|priority|status|createdAt|updatedAt):(asc|desc)$/).optional()
  }) })
];

export const validateCreateSubTask = [
  validate({ params: Joi.object({ id: mongoId.required() }), body: Joi.object({ text: Joi.string().trim().min(1).max(200).required() }) })
];

export const validateUpdateSubTask = [
  validate({ params: Joi.object({ id: mongoId.required(), subTaskId: mongoId.required() }), body: Joi.object({ text: Joi.string().trim().min(1).max(200).optional(), completed: Joi.boolean().optional() }).min(1) })
];

export const validateSubTaskIds = [
  validate({ params: Joi.object({ id: mongoId.required(), subTaskId: mongoId.required() }) })
];
