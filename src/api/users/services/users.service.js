import bcrypt from 'bcryptjs';
import User from '../../../models/userModel.js';
import File from '../../../models/fileModel.js';
import { uploadAvatar, deleteFile } from '../../../services/s3/s3.service.js';
import { populateTemplate } from '../../../utils/emailTemplate.js';
import { sendEmail } from '../../../services/email.service.js';
import { QUOTAS } from '../../_common/middleware/quota.middleware.js';
import { logAudit } from '../../_common/services/audit.service.js';

/**
 * Get current user's full profile
 * 
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User profile data
 */
export const getUserProfile = async (userId) => {
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
        throw new Error('User not found');
    }
    
    return {
        id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
        avatar: user.avatar,
        bio: user.bio,
        preferences: user.preferences,
        studentDetails: user.studentDetails,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
};

/**
 * Update user profile
 * 
 * @param {string} userId - User ID
 * @param {Object} updates - Profile updates (name, bio, preferences)
 * @returns {Promise<Object>} Updated user profile
 */
export const updateUserProfile = async (userId, updates, req = null) => {
    const user = await User.findById(userId);
    
    if (!user) {
        throw new Error('User not found');
    }

    // capture before snapshot
    const before = user.toObject();

    // Update fields if provided
    if (updates.name) {
        user.name = updates.name;
    }

    if (updates.bio !== undefined) {
        user.bio = updates.bio;
    }

    // Merge preferences to avoid overwriting nested fields
    if (updates.preferences) {
        user.preferences = { ...user.preferences, ...updates.preferences };
    }

    const updatedUser = await user.save();

    // write audit log (best-effort)
    await logAudit({
        actor: req?.user || user,
        action: 'PROFILE_UPDATED',
        entityType: 'User',
        entityId: updatedUser._id,
        before,
        after: updatedUser,
        req,
    });

    return {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        roles: updatedUser.roles,
        avatar: updatedUser.avatar,
        bio: updatedUser.bio,
        preferences: updatedUser.preferences,
    };
};

/**
 * Change user password
 * 
 * @param {string} userId - User ID
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<void>}
 */
export const changeUserPassword = async (userId, currentPassword, newPassword, req = null) => {
    // Find user with password field
    const user = await User.findById(userId).select('+password');
    
    if (!user) {
        throw new Error('User not found');
    }
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
        const error = new Error('Incorrect current password');
        error.statusCode = 401;
        throw error;
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    // capture before snapshot (sanitized by audit service)
    const before = user.toObject();

    user.password = await bcrypt.hash(newPassword, salt);
    
    // Update password change timestamp
    user.passwordChangedAt = new Date();
    
    // Reset login attempt counters for security
    user.failedLoginAttempts = 0;
    user.lockoutExpires = null;
    
    await user.save();

    // audit password change (do not include raw password values)
    await logAudit({
        actor: req?.user || user,
        action: 'PASSWORD_CHANGED',
        entityType: 'User',
        entityId: user._id,
        before,
        after: user,
        req,
    });
};

/**
 * Get list of discoverable users
 * Returns users who have enabled discoverability and are verified
 * 
 * @param {string} currentUserId - ID of user making the request (to exclude them)
 * @returns {Promise<Array>} List of discoverable users
 */
export const getDiscoverableUsers = async (currentUserId) => {
    const users = await User.find({
        'preferences.isDiscoverable': true,
        'isVerified': true,
        '_id': { $ne: currentUserId } // Exclude the user making the request
    }).select('name avatar bio'); // Selecting only public-facing fields for privacy
    
    return users;
};

/**
 * Update user avatar
 * Deletes old avatar from S3 and uploads new one
 * 
 * @param {string} userId - User ID
 * @param {Object} file - Multer file object
 * @returns {Promise<string>} New avatar URL
 */
export const updateAvatar = async (userId, file, req = null) => {
    const user = await User.findById(userId);
    
    if (!user) {
        throw new Error('User not found');
    }

    const before = user.toObject();
    // Delete old avatar from S3 if exists
    if (user.avatar) {
        try {
            // Extract S3 key from URL
            const oldAvatarUrl = new URL(user.avatar);
            const oldS3Key = oldAvatarUrl.pathname.substring(1); // Remove leading '/'
            await deleteFile(oldS3Key);
        } catch (error) {
            console.error('Failed to delete old avatar from S3:', error);
            // Non-fatal, continue with upload
        }
    }
    
    // Upload new avatar to S3
    const newS3Key = await uploadAvatar(file, userId);
    
    // Construct full public URL
    const newAvatarUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_S3_BUCKET_REGION}.amazonaws.com/${newS3Key}`;
    
    // Update user's avatar field
    user.avatar = newAvatarUrl;
    await user.save();

    await logAudit({
        actor: req?.user || user,
        action: 'AVATAR_UPDATED',
        entityType: 'User',
        entityId: user._id,
        before,
        after: user,
        req,
    });
    
    return newAvatarUrl;
};

/**
 * Submit student application
 * 
 * @param {string} userId - User ID
 * @param {Object} applicationData - Application data (usn, section, batch, semester)
 * @returns {Promise<Object>} Updated user with application
 */
export const submitStudentApplication = async (userId, applicationData, req = null) => {
    const { usn, section, batch, semester } = applicationData;
    
    // Check if USN is already in use
    const usnExists = await User.findOne({
        'studentDetails.usn': usn,
        'studentDetails.applicationStatus': 'approved'
    });
    
    if (usnExists) {
        throw new Error('This USN is already registered to an approved student');
    }
    
    // Update user with application data
    const user = await User.findById(userId);
    
    if (!user) {
        throw new Error('User not found');
    }

    const before = user.toObject();

    user.studentDetails = {
        ...user.studentDetails,
        usn,
        section,
        batch,
        semester,
        applicationStatus: 'pending',
    };

    await user.save();

    await logAudit({
        actor: req?.user || user,
        action: 'STUDENT_APPLICATION_SUBMITTED',
        entityType: 'User',
        entityId: user._id,
        before,
        after: user,
        req,
    });
    
    // Send confirmation email in background (don't await)
    sendApplicationConfirmationEmail(user).catch(error => {
        console.error('Failed to send application confirmation email:', error);
    });
    
    return user;
};

/**
 * Send application confirmation email
 * 
 * @param {Object} user - User object
 * @returns {Promise<void>}
 */
const sendApplicationConfirmationEmail = async (user) => {
    try {
        const templateData = { name: user.name };
        const htmlMessage = await populateTemplate('studentApplicationPending.html', templateData);
        
        await sendEmail({
            to: user.email,
            subject: 'Your Student Application is Under Review',
            html: htmlMessage,
            text: `Hello ${user.name}, we have received your application to become a student. It is now under review.`
        });
        
        console.log(`Confirmation email sent to ${user.email}`);
    } catch (error) {
        console.error('Failed to send confirmation email:', error);
        throw error;
    }
};

/**
 * Get user's storage usage and quota
 * 
 * @param {string} userId - User ID
 * @param {string} userRole - User role
 * @returns {Promise<Object>} Storage usage and quota information
 */
export const getStorageUsage = async (userId, userRole) => {
    const quota = QUOTAS[userRole] || QUOTAS.user;
    
    const usage = await File.aggregate([
        { $match: { user: userId, context: 'personal' } },
        {
            $group: {
                _id: null,
                totalSize: { $sum: '$size' },
                fileCount: { $sum: 1 }
            }
        }
    ]);
    
    const { totalSize, fileCount } = usage[0] || { totalSize: 0, fileCount: 0 };
    
    return {
        usageBytes: totalSize,
        quotaBytes: quota.maxSizeMB === Infinity ? null : quota.maxSizeMB * 1024 * 1024,
        fileCount: fileCount,
        fileLimit: quota.maxFiles,
        usagePercent: quota.maxSizeMB === Infinity 
            ? 0 
            : Math.round((totalSize / (quota.maxSizeMB * 1024 * 1024)) * 100),
    };
};
