// middleware/socketAuthMiddleware.js
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

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