import express from 'express';
const router = express.Router();
import { protect } from '../_common/middleware/auth.middleware.js';
import { checkAIDailyLimit } from '../_common/middleware/aiLimit.middleware.js'
import { 
    generateTasksWithAI, 
    getAIPlanPreview } from './ai.controller.js';


// All routes in this file are protected
router.use(protect);

router.post('/tasks/preview',checkAIDailyLimit , getAIPlanPreview);
router.post('/tasks/generate', checkAIDailyLimit, generateTasksWithAI);

export default router;
