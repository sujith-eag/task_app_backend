/**
 * AI Tasks Service
 * Business logic for AI-powered task generation
 */

import Task from '../../../models/taskModel.js';
import Prompt from '../../../models/promptModel.js';
import User from '../../../models/userModel.js';
import { generateTasksFromPrompt, generateOrRefineTasks } from '../../../services/llm.service.js';

const REFINEMENT_LIMIT = parseInt(process.env.CONVERSATION_REFINEMENT_LIMIT, 10) || 5;
const MAX_PROMPT_LENGTH = 1000;

/**
 * Get AI-generated task plan preview or refine existing plan
 */
export const getAIPlanPreview = async (userId, previewData) => {
    const { prompt: refinementPrompt, editedPlan, history, sessionId } = previewData;

    // Validation
    if (!refinementPrompt || typeof refinementPrompt !== 'string') {
        const error = new Error('Please provide a valid prompt');
        error.statusCode = 400;
        throw error;
    }

    if (refinementPrompt.length > MAX_PROMPT_LENGTH) {
        const error = new Error('Prompt is too long');
        error.statusCode = 400;
        throw error;
    }

    if (!sessionId) {
        const error = new Error('A unique session ID is required for the conversation');
        error.statusCode = 400;
        throw error;
    }

    // Check refinement limit
    const refinementCount = history ? Math.floor(history.length / 2) : 0;
    if (refinementCount >= REFINEMENT_LIMIT) {
        const error = new Error(`You have reached the refinement limit of ${REFINEMENT_LIMIT} for this task plan`);
        error.statusCode = 429; // Too Many Requests
        throw error;
    }

    const isInitialPrompt = !history || history.length === 0;

    // Save the user's prompt
    await Prompt.create({
        user: userId,
        promptText: refinementPrompt,
        sessionId: sessionId,
        isInitialPrompt: isInitialPrompt,
    });

    // Increment daily usage count (only for initial prompts)
    if (isInitialPrompt) {
        await User.findByIdAndUpdate(userId, {
            $inc: { 'aiGenerations.count': 1 }
        });
    }

    // Build full prompt for AI
    let fullPromptForAI = refinementPrompt;
    if (editedPlan) {
        fullPromptForAI = `
            Based on the following updated plan: ${JSON.stringify(editedPlan)}. 
            Now apply this refinement: ${refinementPrompt}
        `;
    }

    // Call the conversational LLM service
    const result = await generateOrRefineTasks(fullPromptForAI, history);

    return {
        plan: result.plan,
        history: result.history,
        refinementCount: Math.floor(result.history.length / 2),
        refinementLimit: REFINEMENT_LIMIT
    };
};

/**
 * Generate and save tasks from AI prompt
 */
export const generateAndSaveTasks = async (userId, prompt) => {
    if (!prompt) {
        const error = new Error('Please provide a prompt');
        error.statusCode = 400;
        throw error;
    }

    // Get structured task data from LLM service
    const aiGeneratedPlan = await generateTasksFromPrompt(prompt);

    if (!aiGeneratedPlan || !aiGeneratedPlan.tasks || aiGeneratedPlan.tasks.length === 0) {
        const error = new Error('The AI could not generate a valid plan. Please try a different prompt');
        error.statusCode = 500;
        throw error;
    }

    // Add user ID to each task
    const tasksToCreate = aiGeneratedPlan.tasks.map(task => ({
        ...task,
        user: userId,
        status: 'To Do',
    }));

    // Save all tasks to database
    const newTasks = await Task.insertMany(tasksToCreate);

    return newTasks;
};

/**
 * Get AI usage statistics for a user
 */
export const getUserAIStats = async (userId) => {
    const user = await User.findById(userId).select('aiGenerations');
    
    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    // Get prompt history count
    const totalPrompts = await Prompt.countDocuments({ user: userId });
    const initialPrompts = await Prompt.countDocuments({ user: userId, isInitialPrompt: true });
    const refinementPrompts = totalPrompts - initialPrompts;

    // Get unique sessions
    const sessions = await Prompt.distinct('sessionId', { user: userId });

    return {
        dailyUsage: user.aiGenerations,
        totalPrompts,
        initialPrompts,
        refinementPrompts,
        totalSessions: sessions.length,
        averageRefinementsPerSession: sessions.length > 0 
            ? Math.round(refinementPrompts / sessions.length * 10) / 10 
            : 0
    };
};

/**
 * Get prompt history for a user
 */
export const getUserPromptHistory = async (userId, filters = {}) => {
    const { sessionId, limit = 50 } = filters;

    const query = { user: userId };
    if (sessionId) {
        query.sessionId = sessionId;
    }

    const prompts = await Prompt.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));

    return prompts;
};

/**
 * Get prompts grouped by session
 */
export const getSessionHistory = async (userId) => {
    const sessions = await Prompt.aggregate([
        { $match: { user: userId } },
        {
            $group: {
                _id: '$sessionId',
                prompts: { $push: '$$ROOT' },
                count: { $sum: 1 },
                lastUsed: { $max: '$createdAt' }
            }
        },
        { $sort: { lastUsed: -1 } },
        { $limit: 20 } // Last 20 sessions
    ]);

    return sessions;
};

/**
 * Clear old prompt history (cleanup utility)
 */
export const clearOldPrompts = async (userId, daysOld = 30) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await Prompt.deleteMany({
        user: userId,
        createdAt: { $lt: cutoffDate }
    });

    return {
        deletedCount: result.deletedCount
    };
};
