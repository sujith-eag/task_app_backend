import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';

import User from '../models/userModel.js';

// Protect Routes requires valid JWT
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Checking for token in Authorization header
  if (req.headers.authorization 
    && req.headers.authorization.startsWith('Bearer')) {

      try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token and attach to request, minus password
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        res.status(401);
        throw new Error('Not authorized');
      }
      // Verified, Move to the Route
      next();
    } catch (error) {
      console.error('Auth error:', error.message);
      res.status(401);
      throw new Error('Not authorized, token failed or expired');
      }
    } 
  
    if(!token) {
        res.status(401);
        throw new Error('Not authorized, no token');
    }
});
