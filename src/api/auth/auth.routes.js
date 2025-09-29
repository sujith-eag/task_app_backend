import express from 'express';
const router = express.Router();

import { registerUser, loginUser, verifyEmail } from './auth.controller.js';
import { forgotPassword, resetPassword } from './password.controller.js';

// --- middleware ---
import { authLimiter } from '../../middleware/rateLimiter.middleware.js'

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