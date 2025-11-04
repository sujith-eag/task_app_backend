import asyncHandler from '../../_common/http/asyncHandler.js';
import * as authService from '../services/auth.service.js';
import { logAuthEvent } from '../services/auth.log.service.js';
import sessionRegistry from '../../_common/socket/sessionRegistry.js';
import { getAuthCookieOptions } from '../../_common/utils/cookieUtils.js';

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
  // Pass 'res' so the service can set the httpOnly cookie
  const user = await authService.loginUserService(req.body, res);
  res.status(200).json({ message: 'Login successful', user });
});


/**
 * @desc    Logout user (clear cookie and remove session)
 * @route   POST /api/auth/logout
 * @access  Public (even if token is expired, we want to clear the cookie)
 */
export const logoutUser = asyncHandler(async (req, res) => {
  const { deviceId } = req.body || {};

  // Best-effort: if we have an authenticated user and a deviceId, remove that session record.
  try {
    if (req.user && deviceId && Array.isArray(req.user.sessions)) {
      try {
        const sessionExists = req.user.sessions.some((s) => s.deviceId === deviceId);
        if (sessionExists) {
        // Remove session for this device
          req.user.sessions = req.user.sessions.filter((s) => s.deviceId !== deviceId);
          await req.user.save();
          try {
            await logAuthEvent({
              userId: req.user._id,
              eventType: 'SESSION_DESTROYED',
              context: { deviceId, reason: 'User-initiated logout' },
              actor: req.user.email,
              ip: req.ip || null,
            }, req);
          } catch (e) {
            // swallow logging errors
          }
        }
      } catch (e) {
        // Failed to persist session removal; continue to clear cookie anyway.
        console.error('Failed to remove session on logout:', e);
      }
    }
  } catch (e) {
    // Unexpected error in logout session removal - log and continue to clear cookie
    console.error('Error during logout session removal:', e);
  }

  // Compute cookie options to match login cookie attributes so the browser will remove the same cookie.
  const cookieOptions = getAuthCookieOptions();
  cookieOptions.expires = new Date(0);

  // Clear the jwt cookie (best-effort). Use res.clearCookie where supported.
  try {
    res.cookie('jwt', 'loggedout', cookieOptions);
  } catch (e) {
    try { res.clearCookie('jwt', cookieOptions); } catch (ee) { /* ignore */ }
  }

  // Emit an auth event for logout (best-effort)
  try {
    await logAuthEvent({ eventType: 'LOGOUT', actor: req.user?.email || req.body?.email || 'unknown', userId: req.user?._id || null, severity: 'info', req });
  } catch (e) {}

  return res.status(200).json({ success: true, message: 'Logged out' });
});


/**
 * @desc    Return current authenticated user
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = asyncHandler(async (req, res) => {
  // req.user is set by protect middleware
  if (!req.user) {
    res.status(401);
    throw new Error('Not authenticated');
  }

  // Return fresh user data without sensitive fields
  const user = req.user;
  res.status(200).json({ user });
});

/**
 * @desc    List sessions for current user
 * @route   GET /api/auth/sessions
 * @access  Private
 */
export const listSessions = asyncHandler(async (req, res) => {
  if (!req.user) {
    res.status(401);
    throw new Error('Not authenticated');
  }

  const sessions = (req.user.sessions || []).map((s) => ({
    deviceId: s.deviceId,
    ipAddress: s.ipAddress,
    userAgent: s.userAgent,
    createdAt: s.createdAt,
    lastUsedAt: s.lastUsedAt,
  }));

  res.status(200).json({ sessions });
});


/**
 * @desc    Revoke a session by deviceId for current user
 * @route   DELETE /api/auth/sessions/:deviceId
 * @access  Private
 */
export const revokeSession = asyncHandler(async (req, res) => {
  if (!req.user) {
    res.status(401);
    throw new Error('Not authenticated');
  }

  const { deviceId } = req.params;
  if (!deviceId) {
    res.status(400);
    throw new Error('deviceId is required');
  }

  const beforeCount = (req.user.sessions || []).length;
  // Attempt to disconnect any live sockets associated with this session before removing it
  try {
    await sessionRegistry.disconnectDeviceSockets(req.user._id?.toString(), deviceId);
  } catch (e) {
    // ignore disconnect errors
  }

  req.user.sessions = (req.user.sessions || []).filter((s) => s.deviceId !== deviceId);
  const afterCount = req.user.sessions.length;
  await req.user.save();

  try {
    await logAuthEvent({
      userId: req.user._id,
      eventType: 'SESSION_DESTROYED',
      context: { deviceId },
      actor: req.user.email,
      req,
    });
  } catch (e) {
    // swallow logging errors
  }

  res.status(200).json({ message: 'Session revoked', removed: beforeCount - afterCount });
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
