import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';

import User from '../../../models/userModel.js';


/**
 * Protect Routes - requires valid JWT
 * Attaches authenticated user to req.user
 * Must be used before any route that requires authentication
 */
export const protect = asyncHandler(async (req, res, next) => {
    let token;

  // 1. Prefer token from httpOnly cookie
  if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  // 2. Fallback: Authorization header (for API clients)
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // 3. Fallback: token in request body (form submissions)
  if (!token && req.body && req.body.token) {
    token = req.body.token;
  }

  if (!token) {
    // Expected: unauthenticated request. Send 401 JSON and end response.
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // Get user from the token and attach to request, minus password
  const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    // Basic ZTA check: password change invalidates existing tokens
    if (user.passwordChangedAt && decoded.iat * 1000 < user.passwordChangedAt.getTime()) {
      return res.status(401).json({ message: 'User password was recently changed. Please log in again.' });
    }

    // Attach user to req for downstream handlers
    req.user = user;

    // Strong session check: require token to contain a jti (tokenId) and verify that the tokenId exists
    // in the user's active sessions. This ensures server-side revocation is immediate.
    if (!decoded || !decoded.jti) {
      // Tokens without jti are considered legacy/invalid — force re-login
      return res.status(401).json({ message: 'Session token invalid. Please log in again.' });
    }

    const hasSessionByToken = (user.sessions || []).some((s) => s.tokenId === decoded.jti);
    if (!hasSessionByToken) {
      return res.status(401).json({ message: 'Session revoked. Please log in again.' });
    }
    // Verified, move to the next middleware
    next();
  } catch (error) {
    console.error('Auth error:', error?.message || error);
    // Token verification failed or other expected auth error.
    return res.status(401).json({ message: 'Not authorized, token failed or expired' });
  }
});


/**
 * Socket.IO Authentication Middleware
 * Validates JWT for WebSocket connections
 * Attaches authenticated user to socket.user
 */
export const socketAuthMiddleware = async (socket, next) => {
  try {
    console.log('--- New socket connection attempt ---');
    // Accept token from handshake.auth.token, Authorization header, OR cookie header
    let authToken = socket.handshake?.auth?.token || null;

    // Authorization header
    if (!authToken && socket.handshake?.headers?.authorization && socket.handshake.headers.authorization.startsWith('Bearer ')) {
      authToken = socket.handshake.headers.authorization.split(' ')[1];
    }

    // Cookie header (parse manually to avoid adding dependency)
    if (!authToken && socket.handshake?.headers?.cookie) {
      const cookieHeader = socket.handshake.headers.cookie;
      const parsed = {};
      cookieHeader.split(';').forEach((c) => {
        const idx = c.indexOf('=');
        if (idx > -1) {
          const key = c.slice(0, idx).trim();
          const val = c.slice(idx + 1).trim();
          parsed[key] = decodeURIComponent(val);
        }
      });
      authToken = parsed.jwt || null;
    }

    if (!authToken) {
      // Detailed debug: include handshake.auth, headers and cookie snippet to help diagnose client handshake
      const debugInfo = {
        socketId: socket.id,
        handshakeAuth: socket.handshake?.auth || null,
        origin: socket.handshake?.headers?.origin || null,
        cookieHeader: socket.handshake?.headers?.cookie ? socket.handshake.headers.cookie.slice(0, 200) : null,
        headers: Object.keys(socket.handshake?.headers || {}).reduce((acc, k) => {
          // include only a subset of headers to reduce noise
          if (['authorization', 'cookie', 'origin', 'referer', 'user-agent', 'host'].includes(k)) acc[k] = socket.handshake.headers[k];
          return acc;
        }, {}),
      };

      console.warn('Socket auth failed: no token provided', debugInfo);
      return next(new Error('Authentication error: No token provided.'));
    }

    // Verify signature + expiration
    let decoded;
    try {
      decoded = jwt.verify(authToken, process.env.JWT_SECRET);
    } catch (err) {
      // Provide richer logging to help debugging token failures
      const errInfo = { name: err.name, message: err.message };
      // Log a short token fingerprint (not the full token) to correlate client logs without exposing secrets
      const tokenFingerprint = authToken ? `${authToken.slice(0, 8)}...${authToken.slice(-8)}` : null;
      console.warn('Middleware FAIL: JWT verification failed', { socketId: socket.id, err: errInfo, tokenFingerprint });
      if (err.name === 'TokenExpiredError') {        
        console.warn('Socket auth failed: token expired', { socketId: socket.id });
        return next(new Error('Authentication error: Token expired.'));
      }
      console.warn('Socket auth failed: invalid token', { socketId: socket.id });
      return next(new Error('Authentication error.'));
    }

    console.log('Middleware: Token verified successfully.', { userId: decoded.id });
    // Load user from DB (select minus password)
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      console.warn(`Middleware FAIL: User not found for ID: ${decoded.id}`);
      console.warn('Socket auth failed: user not found', { userId: decoded.id });
      return next(new Error('Authentication error.'));
    }

    // Optional: check account state
    if (!user.isVerified || !user.isActive) {
      console.warn('Socket auth failed: account inactive/banned', { userId: user._id, isVerified: user.isVerified, isActive: user.isActive });
      return next(new Error('Authentication error.'));
    }

    // Strong session check: require token to contain a jti (tokenId) and verify it exists in user's sessions
    if (!decoded || !decoded.jti) {
      console.warn('Socket auth failed: token missing jti');
      return next(new Error('Authentication error: invalid token.'));
    }
    const hasSessionByToken = (user.sessions || []).some((s) => s.tokenId === decoded.jti);
    if (!hasSessionByToken) {
      console.warn('Socket auth failed: session revoked for tokenId', { userId: user._id, tokenId: decoded.jti });
      return next(new Error('Authentication error: session revoked.'));
    }

    console.log('--- Middleware SUCCESS: Attaching user to socket. ---');
    // Attach user to socket for later handlers
    socket.user = user;
    return next();
  } catch (err) {
      console.error('Unexpected error in socketAuthMiddleware', err);
      return next(new Error('Authentication error.'));
  }
};
