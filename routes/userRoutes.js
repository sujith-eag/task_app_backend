import express from 'express';
const router = express.Router();

import { registerUser, loginUser, verifyEmail } from '../controllers/authController.js';
import { 
    getCurrentUser, updateCurrentUser, changePassword,
    getDiscoverableUsers, updateUserAvatar,
    } from '../controllers/userController.js';
import { forgotPassword, resetPassword } from '../controllers/passwordController.js';

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
router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);

// --- Password Reset Routes (Public) ---
router.post('/forgotpassword', authLimiter, forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);

// --- User Profile Routes (Private) ---
router.route('/me')
    .get(protect, getCurrentUser)
    .put(protect, updateCurrentUser);

router.get('/verifyemail/:token', verifyEmail);
router.get('/discoverable', protect, getDiscoverableUsers);
router.put('/password', protect, changePassword);

// router.put('/me/avatar', protect, avatarUpload, updateUserAvatar);
router.put( '/me/avatar',
    protect,
    avatarUpload,
    updateUserAvatar,
    avatarErrorHandler, // To catch when error Occurrs, before reaching Global
);


export default router;