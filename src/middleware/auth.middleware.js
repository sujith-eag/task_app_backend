import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';

import User from '../models/userModel.js';


// Protect Routes requires valid JWT
export const protect = asyncHandler(async (req, res, next) => {
    let token;

    // 1. Check for token in Authorization header (for standard API calls)
    if (req.headers.authorization 
        && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } 
    // 2. FALLBACK: Check for token in request body (for form submissions)
    else if (req.body.token) {
        token = req.body.token;
    }

    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no token provided');
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from the token and attach to request, minus password
        req.user = await User.findById(decoded.id).select('-password');

        if (!req.user) {
            res.status(401);
            throw new Error('Not authorized, user not found');
        }
        
        // Verified, move to the next middleware
        next();
    } catch (error) {
        console.error('Auth error:', error.message);
        res.status(401);
        throw new Error('Not authorized, token failed or expired');
    }
});



export const socketAuthMiddleware = async (socket, next) => {
  try {
    console.log('--- New socket connection attempt ---');
    // Accept token from socket.handshake.auth.token OR Authorization header
    const authToken =
      socket.handshake?.auth?.token ||
      (socket.handshake?.headers?.authorization?.startsWith('Bearer ')
        ? socket.handshake.headers.authorization.split(' ')[1]
        : null);

    if (!authToken) {
      console.warn('Socket auth failed: no token', { socketId: socket.id, headers: socket.handshake?.headers });
      return next(new Error('Authentication error: No token provided.'));
    }

    // Verify signature + expiration
    let decoded;
    try {
      decoded = jwt.verify(authToken, process.env.JWT_SECRET);
    } catch (err) {
      console.warn(`Middleware FAIL: JWT verification failed. Reason: ${err.name}`);
      if (err.name === 'TokenExpiredError') {        
        console.warn('Socket auth failed: token expired', { socketId: socket.id });
        return next(new Error('Authentication error: Token expired.'));
      }
      console.warn('Socket auth failed: invalid token', { socketId: socket.id, err });
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
      console.warn('Socket auth failed: account inactive/banned', { userId: user._id });
      return next(new Error('Authentication error.'));
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