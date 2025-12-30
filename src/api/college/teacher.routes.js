import express from 'express';

import { protect } from '../_common/middleware/auth.middleware.js';

import { hasRole } from '../_common/middleware/rbac.middleware.js';
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

// Allow teachers and admins to access class creation data (for sharing materials)
router.get('/class-creation-data', protect, hasRole(['teacher', 'admin']), getClassCreationData);

// Apply protect and teacher-only middleware to remaining routes
router.use(protect, hasRole(['teacher']));
router.post('/class-sessions', createClassSession);
router.get('/class-sessions', getTeacherSessionsHistory);

router.route('/class-sessions/:sessionId/roster')
    .get(getSessionRoster)
    .patch(finalizeAttendance);

router.get('/feedback-summary/:classSessionId', getFeedbackSummaryForSession);

router.put('/session-reflection', upsertSessionReflection);

    
   
export default router;