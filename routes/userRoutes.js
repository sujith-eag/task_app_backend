import express from 'express';
const router = express.Router();

import protect from '../middleware/authMiddleware.js';

import { registerUser, loginUser, getCurrentUser } from '../controllers/userController.js';


router.post('/', registerUser)
router.post('/login', loginUser)
router.get('/current', protect, getCurrentUser)

export default router;