import express from 'express';
const router = express.Router();

import { registerUser, loginUser, verifyEmail } from '../controllers/authController.js';
import { 
    getCurrentUser, updateCurrentUser, changePassword,
    getDiscoverableUsers, updateUserAvatar, applyAsStudent
    } from '../controllers/userController.js';
import { forgotPassword, resetPassword } from '../controllers/passwordController.js';

// --- middleware ---
import { protect } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';

import { MulterError } from 'multer';
import avatarUpload from '../middleware/avatarUploadMiddleware.js';
const avatarErrorHandler = (err, req, res, next) => {
    if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Avatar image is too large. Maximum size is 5MB.' });
    }
    next(err);
};


// =================================================================
// --- PUBLIC ROUTES ---
// =================================================================

// --- Authentication Routes (Public) ---
router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);

// Email Verification
router.get('/verifyemail/:token', verifyEmail);

// --- Password Reset Routes (Public) ---
router.post('/forgotpassword', authLimiter, forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);


// =================================================================
// --- PRIVATE ROUTES (Require Authentication) ---
// =================================================================


// All routes below this point are protected
router.use(protect);

// --- User Profile Routes (Private) ---
router.route('/me')
    .get(getCurrentUser)
    .put(updateCurrentUser);

router.put('/password', changePassword);

router.put( '/me/avatar',
    avatarUpload,
    updateUserAvatar,
    avatarErrorHandler, // To catch when error Occurrs, before reaching Global
);

// User Discovery
router.get('/discoverable', getDiscoverableUsers);

// Student Application
router.post('/apply-student', applyAsStudent);


export default router;