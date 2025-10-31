import asyncHandler from 'express-async-handler';
import User from '../../../models/userModel.js';

const DAILY_LIMIT = parseInt(process.env.DAILY_AI_GENERATION_LIMIT, 10) || 10;

/**
 * Middleware to check and enforce daily AI generation limits
 * Prevents abuse of AI resources by limiting requests per user per day
 * Automatically resets the count after 24 hours
 * 
 * Must be used AFTER the 'protect' middleware
 */
export const checkAIDailyLimit = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const lastReset = user.aiGenerations?.lastReset || new Date(0);

    // Reset if 24h passed since last reset
    if (new Date() - lastReset > oneDay) {
        user.aiGenerations.count = 0;
        user.aiGenerations.lastReset = new Date();
        await user.save();
    }

    // Check if the user has reached their daily limit
    if (user.aiGenerations.count >= DAILY_LIMIT) {
        res.status(429); // 429 Too Many Requests
        throw new Error(`You have reached your daily limit of ${DAILY_LIMIT} AI generations.`);
    }

    next();
});
