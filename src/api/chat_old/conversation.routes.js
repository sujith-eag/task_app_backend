import express from 'express';

const router = express.Router();

import { protect } from '../_common/middleware/auth.middleware.js';
import { createOrGetConversation , getConversations, 
    getMessagesForConversation } from './conversation.controller.js';

    
router.use(protect);
router.route('/').get(getConversations);   // GET /api/conversations
router.route('/').post(createOrGetConversation);  // POST /api/conversations
router.route('/:id/messages').get(getMessagesForConversation); // // GET /api/conversations/:id/messages to pull the chat history


export default router;

