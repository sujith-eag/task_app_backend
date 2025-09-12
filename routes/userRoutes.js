import express from 'express';
const router = express.Router();

import {
  registerUser,
  loginUser,
  getCurrentUser,
  forgotPassword,
  resetPassword,
} from '../controllers/userController.js';

import protect from '../middleware/authMiddleware.js';

// --- Authentication & User Routes ---
router.post('/', registerUser);
router.post('/login', loginUser);
router.get('/current', protect, getCurrentUser);

// --- Password Reset Routes ---
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);

export default router;