import express from 'express';
import * as authController from '../controllers/auth.controller.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  validate,
} from '../validators/auth.validators.js';
import { authLimiter } from '../../../middleware/rateLimiter.middleware.js';

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
