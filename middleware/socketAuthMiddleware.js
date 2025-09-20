// middleware/socketAuthMiddleware.js
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

export const socketAuthMiddleware = async (socket, next) => {
  try {
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
      if (err.name === 'TokenExpiredError') {
        console.warn('Socket auth failed: token expired', { socketId: socket.id });
        return next(new Error('Authentication error: Token expired.'));
      }
      console.warn('Socket auth failed: invalid token', { socketId: socket.id, err });
      return next(new Error('Authentication error.'));
    }

    // Load user from DB (select minus password)
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      console.warn('Socket auth failed: user not found', { userId: decoded.id });
      return next(new Error('Authentication error.'));
    }

    // Optional: check account state
    if (user.isBanned || !user.isActive) {
      console.warn('Socket auth failed: account inactive/banned', { userId: user._id });
      return next(new Error('Authentication error.'));
    }

    // Attach user to socket for later handlers
    socket.user = user;
    return next();
  } catch (err) {
    console.error('Unexpected error in socketAuthMiddleware', err);
    return next(new Error('Authentication error.'));
  }
};