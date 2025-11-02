/**
 * AI Routes
 * RESTful API routes for AI-powered features
 */

import express from 'express';
import * as aiController from '../controllers/ai.controller.js';
import * as validators from '../validators/ai.validator.js';
import { protect } from '../../_common/middleware/auth.middleware.js';
import { checkAIDailyLimit } from '../../_common/middleware/aiLimit.middleware.js';
import { validate } from '../../_common/middleware/validation.middleware.js';

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// ========================================
// AI TASK GENERATION ROUTES
// ========================================

/**
 * @route   POST /api/ai/tasks/preview
 * @desc    Get AI-generated task plan preview or refine existing plan
 * @access  Private (with daily limit check)
 */
router.post(
    '/tasks/preview',
    checkAIDailyLimit,
    validators.validatePlanPreview,
    validate,
    aiController.getAIPlanPreview
);

/**
 * @route   POST /api/ai/tasks/generate
 * @desc    Generate and save tasks from AI prompt
 * @access  Private (with daily limit check)
 */
router.post(
    '/tasks/generate',
    checkAIDailyLimit,
    validators.validateTaskGeneration,
    validate,
    aiController.generateTasksWithAI
);

// ========================================
// AI USAGE STATISTICS ROUTES
// ========================================

/**
 * @route   GET /api/ai/stats
 * @desc    Get AI usage statistics for current user
 * @access  Private
 */
router.get(
    '/stats',
    aiController.getAIStats
);

// ========================================
// PROMPT HISTORY ROUTES
// ========================================

/**
 * @route   GET /api/ai/prompts/history
 * @desc    Get prompt history for current user
 * @access  Private
 */
router.get(
    '/prompts/history',
    validators.validatePromptHistory,
    validate,
    aiController.getPromptHistory
);

/**
 * @route   GET /api/ai/sessions
 * @desc    Get session history grouped by sessionId
 * @access  Private
 */
router.get(
    '/sessions',
    aiController.getSessionHistory
);

/**
 * @route   DELETE /api/ai/prompts/history
 * @desc    Clear old prompt history
 * @access  Private
 */
router.delete(
    '/prompts/history',
    validators.validateClearPrompts,
    validate,
    aiController.clearOldPrompts
);

export default router;
