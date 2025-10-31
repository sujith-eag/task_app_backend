import { asyncHandler } from '../../_common/http/asyncHandler.js';
import * as authService from '../services/auth.service.js';

// ============================================================================
// Authentication Controllers
// ============================================================================

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const registerUser = asyncHandler(async (req, res) => {
  const result = await authService.registerUserService(req.body);
  res.status(201).json(result);
});

/**
 * @desc    Authenticate a user (login)
 * @route   POST /api/auth/login
 * @access  Public
 */
export const loginUser = asyncHandler(async (req, res) => {
  const result = await authService.loginUserService(req.body);
  res.status(200).json(result);
});

/**
 * @desc    Verify user's email address
 * @route   GET /api/auth/verifyemail/:token
 * @access  Public
 */
export const verifyEmail = asyncHandler(async (req, res) => {
  const result = await authService.verifyEmailService(req.params.token);
  res.status(200).json(result);
});

// ============================================================================
// Password Reset Controllers
// ============================================================================

/**
 * @desc    Forgot password - generates and sends reset token
 * @route   POST /api/auth/forgotpassword
 * @access  Public
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPasswordService(req.body.email);
  res.status(200).json(result);
});

/**
 * @desc    Reset password using token
 * @route   PUT /api/auth/resetpassword/:resettoken
 * @access  Public
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPasswordService(
    req.params.resettoken,
    req.body.password
  );
  res.status(200).json(result);
});
