import express from 'express';
const router = express.Router();
import { protect } from '../middleware/authMiddleware.js';
import { createOrGetConversation , getConversations, 
    getMessagesForConversation } from '../controllers/conversationController.js';

router.use(protect);
router.route('/').get(getConversations);   // GET /api/conversations
router.route('/').post(createOrGetConversation);  // POST /api/conversations
router.route('/:id/messages').get(getMessagesForConversation); // // GET /api/conversations/:id/messages to pull the chat history


export default router;

