import asyncHandler from 'express-async-handler';

import Task from '../../models/taskModel.js';
import Prompt from '../../models/promptModel.js';
import User from '../../models/userModel.js';

import { runTestPrompt, 
    generateTasksFromPrompt,
    generateOrRefineTasks } from '../../services/llm.service.js';

    
// @desc    Get a preview of an AI-generated task plan or refine an existing one
// @route   POST /api/ai/tasks/preview
// @access  Private
export const getAIPlanPreview = asyncHandler(async (req, res) => {
    const { prompt: refinementPrompt, editedPlan, history, sessionId } = req.body;

    if (!refinementPrompt || typeof refinementPrompt !== 'string') {
        res.status(400);
        throw new Error('Please provide a valid prompt.');
    }
    if (refinementPrompt.length > 1000) {
        res.status(400);
        throw new Error('Prompt is too long.');
    }
    if (!sessionId) {
        res.status(400);
        throw new Error('A unique session ID is required for the conversation.');
    }

    const REFINEMENT_LIMIT = parseInt(process.env.CONVERSATION_REFINEMENT_LIMIT, 10) || 5;
    const refinementCount = history ? Math.floor(history.length / 2) : 0;
    if (refinementCount >= REFINEMENT_LIMIT) {
        res.status(429); // Too Many Requests
    throw new Error(`You have reached the refinement limit of ${REFINEMENT_LIMIT} for this task plan.`);
    }

    const isInitialPrompt = !history || history.length === 0;
    // --- Save the User's Prompt ---
    await Prompt.create({
        user: req.user.id,
        promptText: refinementPrompt,
        sessionId: sessionId,
        isInitialPrompt: isInitialPrompt,
    });

    // --- Increment Daily Usage Count (ONCE per session) ---
    if (isInitialPrompt) {
        await User.findByIdAndUpdate(req.user.id, { 
            $inc: { 'aiGenerations.count': 1 } 
        });
    }

    let fullPromptForAI = refinementPrompt;
    if (editedPlan) {
        fullPromptForAI = `
            Based on the following updated plan: ${JSON.stringify(editedPlan)}. 
            Now apply this refinement: ${refinementPrompt}
        `;
    }

    // Call the conversational service
    const result = await generateOrRefineTasks(fullPromptForAI, history);

    // Send the plan and the conversation history back to the frontend
    res.status(200).json({
        plan: result.plan,
        history: result.history,
        refinementCount: Math.floor(result.history.length / 2),
        refinementLimit: REFINEMENT_LIMIT
    });
});




// @desc    Generate tasks and sub-tasks from a user prompt using an LLM
// @route   POST /api/tasks/generate-with-ai
// @access  Private
export const generateTasksWithAI = asyncHandler(async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        res.status(400);
        throw new Error('Please provide a prompt.');
    }

    // 1. Get the structured task data from the LLM service
    const aiGeneratedPlan = await generateTasksFromPrompt(prompt);

    if (!aiGeneratedPlan || !aiGeneratedPlan.tasks || aiGeneratedPlan.tasks.length === 0) {
        res.status(500);
        throw new Error('The AI could not generate a valid plan. Please try a different prompt.');
    }

    // 2. Add the current user's ID to each task
    const tasksToCreate = aiGeneratedPlan.tasks.map(task => ({
        ...task,
        user: req.user.id, // Assign the task to the logged-in user
        status: 'To Do',   // Default status
    }));

    // 3. Save all the new tasks to the database
    const newTasks = await Task.insertMany(tasksToCreate);

    res.status(201).json(newTasks);
});



// @desc    Test the connection to the LLM service
// @route   GET /api/tasks/test-llm
// @access  Public (for now, for easy testing)
export const testLlmConnection = asyncHandler(async (req, res) => {
    const responseText = await runTestPrompt();
    res.status(200).send(responseText);
});


