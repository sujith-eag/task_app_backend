import express from 'express';
const router = express.Router();
import { protect } from '../../middleware/auth.middleware.js';
import { checkAIDailyLimit } from '../../middleware/checkAIDailyLimit.js'
import { 
    generateTasksWithAI, 
    getAIPlanPreview } from './ai.controller.js';


// All routes in this file are protected
router.use(protect);

router.post('/tasks/preview',checkAIDailyLimit , getAIPlanPreview);
router.post('/tasks/generate', checkAIDailyLimit, generateTasksWithAI);

export default router;
