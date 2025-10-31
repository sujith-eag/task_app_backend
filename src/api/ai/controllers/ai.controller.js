/**
 * AI Controller
 * HTTP request handlers for AI-powered features
 */

import asyncHandler from 'express-async-handler';
import * as aiService from '../services/ai.service.js';

/**
 * @desc    Get a preview of an AI-generated task plan or refine an existing one
 * @route   POST /api/ai/tasks/preview
 * @access  Private
 */
export const getAIPlanPreview = asyncHandler(async (req, res) => {
    const result = await aiService.getAIPlanPreview(req.user.id, req.body);
    res.status(200).json(result);
});

/**
 * @desc    Generate tasks and sub-tasks from a user prompt using an LLM
 * @route   POST /api/ai/tasks/generate
 * @access  Private
 */
export const generateTasksWithAI = asyncHandler(async (req, res) => {
    const { prompt } = req.body;
    const newTasks = await aiService.generateAndSaveTasks(req.user.id, prompt);
    res.status(201).json(newTasks);
});

/**
 * @desc    Get AI usage statistics for the current user
 * @route   GET /api/ai/stats
 * @access  Private
 */
export const getAIStats = asyncHandler(async (req, res) => {
    const stats = await aiService.getUserAIStats(req.user.id);
    res.status(200).json(stats);
});

/**
 * @desc    Get prompt history for the current user
 * @route   GET /api/ai/prompts/history
 * @access  Private
 */
export const getPromptHistory = asyncHandler(async (req, res) => {
    const { sessionId, limit } = req.query;
    const prompts = await aiService.getUserPromptHistory(req.user.id, {
        sessionId,
        limit
    });
    res.status(200).json(prompts);
});

/**
 * @desc    Get session history grouped by sessionId
 * @route   GET /api/ai/sessions
 * @access  Private
 */
export const getSessionHistory = asyncHandler(async (req, res) => {
    const sessions = await aiService.getSessionHistory(req.user.id);
    res.status(200).json(sessions);
});

/**
 * @desc    Clear old prompt history
 * @route   DELETE /api/ai/prompts/history
 * @access  Private
 */
export const clearOldPrompts = asyncHandler(async (req, res) => {
    const { daysOld = 30 } = req.query;
    const result = await aiService.clearOldPrompts(req.user.id, parseInt(daysOld));
    res.status(200).json(result);
});
