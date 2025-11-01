import asyncHandler from 'express-async-handler';
import File from '../../../models/fileModel.js';
import User from '../../../models/userModel.js';


/**
 * Central configuration for storage quotas by role.
 * Easy to manage and update quotas in one place.
 * Applies only to context: 'personal' files.
 */
export const QUOTAS = {
    user: {
        maxFiles: 20,
        maxSizeMB: 50
    },
    student: {
        maxFiles: 50,
        maxSizeMB: 200
    },
    teacher: {
        maxFiles: 100,
        maxSizeMB: 500
    },
    // HOD and Admin have no limits
    hod: {
        maxFiles: Infinity,
        maxSizeMB: Infinity
    },
    admin: {
        maxFiles: Infinity,
        maxSizeMB: Infinity
    }
};

/**
 * Middleware to check if a user has reached their storage quota based on their role.
 * Enforces both file count and total size limits.
 * Only applies to personal files (context: 'personal').
 * Uses highest-role logic: if a user is a teacher, they get teacher quotas.
 * 
 * Must be used AFTER the 'protect' middleware.
 */
export const checkStorageQuota = asyncHandler(async (req, res, next) => {
    // Determine effective role from roles array (most permissive)
    const roles = Array.isArray(req.user?.roles) ? req.user.roles : (req.user?.role ? [req.user.role] : ['user']);
    const precedence = ['admin', 'hod', 'teacher', 'student', 'user'];
    const userRole = precedence.find(r => roles.includes(r)) || 'user';
    const quota = QUOTAS[userRole] || QUOTAS.user; // Default to 'user' quota

    // If quota is unlimited, skip all checks
    if (quota.maxFiles === Infinity) {
        return next();
    }

    // --- Calculate Current Usage (Personal Files Only) ---
    const usage = await File.aggregate([
        { 
            $match: { 
                user: req.user._id,
                context: 'personal' // Only count personal files
            } 
        },
        {
            $group: {
                _id: null,
                totalSize: { $sum: '$size' },
                fileCount: { $sum: 1 }
            }
        }
    ]);

    const { totalSize, fileCount } = usage[0] || { totalSize: 0, fileCount: 0 };

    // --- Calculate Incoming Request Size ---
    const incomingFileCount = req.files ? req.files.length : 0;
    const incomingSize = req.files ? req.files.reduce((acc, file) => acc + file.size, 0) : 0;

    // --- Enforce Limits ---
    const quotaBytes = quota.maxSizeMB * 1024 * 1024;

    if (fileCount + incomingFileCount > quota.maxFiles) {
        res.status(403);
        throw new Error(`Storage limit reached. Your role (${userRole}) is limited to ${quota.maxFiles} files.`);
    }

    if (totalSize + incomingSize > quotaBytes) {
        res.status(403);
        throw new Error(`Storage limit reached. Your role (${userRole}) is limited to ${quota.maxSizeMB}MB.`);
    }

    next();
});
