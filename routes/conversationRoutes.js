import express from 'express';
const router = express.Router();
import { protect } from '../middleware/authMiddleware.js';
import { createOrGetConversation , getConversations } from '../controllers/conversationController.js';

router.use(protect);
router.route('/').get(getConversations);   // GET /api/conversations
router.route('/').post(createOrGetConversation);  // POST /api/conversations

export default router;