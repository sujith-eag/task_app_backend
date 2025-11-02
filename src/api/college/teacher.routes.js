import express from 'express';

import { protect } from '../_common/middleware/auth.middleware.js';

import { isTeacher } from '../_common/middleware/rbac.middleware.js';
import {
    getClassCreationData,
    createClassSession,
    getSessionRoster,
    finalizeAttendance,
    getTeacherSessionsHistory,
    upsertSessionReflection,
    getFeedbackSummaryForSession,
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

router.get('/feedback-summary/:classSessionId', getFeedbackSummaryForSession);

router.put('/session-reflection', upsertSessionReflection);

    
   
export default router;