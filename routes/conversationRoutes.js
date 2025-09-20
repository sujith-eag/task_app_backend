import express from 'express';
const router = express.Router();
import { protect } from '../middleware/authMiddleware.js';
import { getConversations } from '../controllers/conversationController.js';

router.use(protect);
router.route('/').get(getConversations);

export default router;