import express from 'express';
const router = express.Router();

import { registerUser, loginUser, verifyEmail } from '../controllers/authController.js';
import { forgotPassword, resetPassword } from '../controllers/passwordController.js';

// --- middleware ---
import { authLimiter } from '../middleware/rateLimiter.js';


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

export default router;