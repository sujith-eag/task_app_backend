import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { isAdmin, isAdminOrHOD } from '../middleware/roleMiddleware.js';
import { 
    getPendingApplications,
    reviewApplication,
    promoteToFaculty,
    getAttendanceStats,
    getFeedbackSummary,
    updateTeacherAssignments,
    getAllTeachers
} from '../controllers/adminController.js';

const router = express.Router();

// --- Application & User Management (Admin Only) ---
router.route('/applications')
    .get(protect, isAdmin, getPendingApplications);

router.route('/applications/:userId/review')
    .patch(protect, isAdmin, reviewApplication);

router.route('/users/:userId/promote')
    .patch(protect, isAdmin, promoteToFaculty);

router.route('/teachers').get(protect, isAdmin, getAllTeachers);    

// --- Route for managing teacher assignments ---
router.route('/teachers/:teacherId/assignments')
    .post(protect, isAdmin, updateTeacherAssignments);

    
// --- Reporting & Statistics (Admin & HOD) ---
router.route('/attendance-stats')
    .get(protect, isAdminOrHOD, getAttendanceStats);

router.route('/feedback-summary')
    .get(protect, isAdminOrHOD, getFeedbackSummary);


export default router;