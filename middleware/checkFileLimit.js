import asyncHandler from 'express-async-handler';
import File from '../models/fileModel.js'

const per_user_file_limit = process.env.FILE_LIMIT_PER_USER;

export const checkFileLimit = asyncHandler(async (req, res, next) => {
    // This middleware must run after the 'protect' middleware
    // so req.user is available
    if (!req.user) {
        res.status(401);
        throw new Error('Not authorized');
    }

    // Count how many files the user already owns
    const userFileCount = await File.countDocuments({ user: req.user.id });
    
    // Check if the user has reached the limit
    if (userFileCount >= per_user_file_limit) {
        res.status(403); // 403 Forbidden
        throw new Error(`Storage limit reached. You cannot own more than ${per_user_file_limit} files.`);
    }

    // Will not reach multer if limit exceeded
    next();
});