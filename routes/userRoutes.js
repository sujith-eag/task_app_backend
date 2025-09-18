import express from 'express';
const router = express.Router();

import { registerUser, loginUser } from '../controllers/authController.js';
import { 
    getCurrentUser, updateCurrentUser, changePassword,
    getDiscoverableUsers, updateUserAvatar,
    } from '../controllers/userController.js';
import { forgotPassword, resetPassword } from '../controllers/passwordController.js';
import avatarUpload from '../middleware/avatarUploadMiddleware.js';

// --- middleware ---
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';

import { MulterError } from 'multer';
import avatarUpload from '../middleware/avatarUploadMiddleware.js';
const avatarErrorHandler = (err, req, res, next) => {
    if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Avatar image is too large. Maximum size is 5MB.' });
    }
    next(err);
};



// --- Authentication Routes (Public) ---
router.post('/', registerUser);
router.post('/login', authLimiter, loginUser);

// --- Password Reset Routes (Public) ---
router.post('/forgotpassword', authLimiter, forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);

// --- User Profile Routes (Private) ---
router.route('/me')
    .get(protect, getCurrentUser)
    .put(protect, updateCurrentUser);


router.get('/discoverable', protect, getDiscoverableUsers);
router.put('/password', protect, changePassword);

// router.put('/me/avatar', protect, avatarUpload, updateUserAvatar);
router.put( '/me/avatar',
    protect,
    (req, res, next) => {console.log('--- 1. Request has passed the "protect" middleware ---');next();},
    avatarErrorHandler,
    avatarUpload,
    updateUserAvatar
);


export default router;