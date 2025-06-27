import express from 'express';

const router = express.Router();

import { registerUser, loginUser, getCurrentUser } from '../controllers/userController.js';

router.post('/', registerUser)
router.post('/login', loginUser)
router.get('/current', getCurrentUser)

export default router;