import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { isTeacher } from '../middleware/roleMiddleware.js';
import {
    getClassCreationData,
    createClassSession,
    getSessionRoster,
    finalizeAttendance,
    getTeacherSessionsHistory
} from '../controllers/teacherController.js';

const router = express.Router();

// Apply protect and isTeacher middleware to all routes in this file
router.use(protect, isTeacher);

// Routes
router.get('/class-creation-data', getClassCreationData);
router.post('/class-sessions', createClassSession);
router.get('/class-sessions', getTeacherSessionsHistory);

router.route('/class-sessions/:sessionId/roster')
    .get(getSessionRoster)
    .patch(finalizeAttendance);

export default router;