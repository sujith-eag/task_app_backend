import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';


export const socketAuthMiddleware = async (socket, next) => {
  try {
    // Frontend will send the token in the 'auth' payload
    const token = socket.handshake.auth?.token 
               || socket.handshake.headers?.authorization?.split(" ")[1];

    if (!token) {
      return next(new Error('Authentication error: No Token Provided'));
    }
    
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find the user and attach it to the socket object for future use
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) {
      return next(new Error('Authentication error: No User found'));
    }

    socket.user = user; // attach to socket for later use
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new Error('Authentication error: Token expired.'));
    }
    return next(new Error('Authentication error: Invalid token'));
  }
};
