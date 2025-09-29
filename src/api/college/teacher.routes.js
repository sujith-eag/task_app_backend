import express from 'express';

import { protect } from '../../middleware/auth.middleware.js';

import { isTeacher } from '../../middleware/role.middleware.js';
import {
    getClassCreationData,
    createClassSession,
    getSessionRoster,
    finalizeAttendance,
    getTeacherSessionsHistory
} from './teacher.controller.js';

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