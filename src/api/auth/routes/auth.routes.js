import express from 'express';
import * as authController from '../controllers/auth.controller.js';
import { protect } from '../../_common/middleware/auth.middleware.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  validate,
} from '../validators/auth.validators.js';
import { authLimiter } from '../../_common/middleware/rateLimit.middleware.js';

const router = express.Router();

// ============================================================================
// PUBLIC ROUTES - Authentication
// ============================================================================

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  authController.registerUser
);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and get token
 * @access  Public
 */
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  authController.loginUser
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout and clear httpOnly cookie
 * @access  Public (clears cookie)
 */
router.post('/logout', authController.logoutUser);

/**
 * @route   GET /api/auth/sessions
 * @desc    List sessions for current user
 * @access  Private
 */
router.get('/sessions', protect, authController.listSessions);

/**
 * @route   DELETE /api/auth/sessions/:deviceId
 * @desc    Revoke a session by deviceId
 * @access  Private
 */
router.delete('/sessions/:deviceId', protect, authController.revokeSession);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
router.get('/me', protect, authController.getMe);

/**
 * @route   GET /api/auth/verifyemail/:token
 * @desc    Verify user's email address
 * @access  Public
 */
router.get('/verifyemail/:token', authController.verifyEmail);

// ============================================================================
// PUBLIC ROUTES - Password Reset
// ============================================================================

/**
 * @route   POST /api/auth/forgotpassword
 * @desc    Send password reset email
 * @access  Public
 */
router.post(
  '/forgotpassword',
  authLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

/**
 * @route   PUT /api/auth/resetpassword/:resettoken
 * @desc    Reset password using token
 * @access  Public
 */
router.put(
  '/resetpassword/:resettoken',
  validate(resetPasswordSchema),
  authController.resetPassword
);

export default router;
