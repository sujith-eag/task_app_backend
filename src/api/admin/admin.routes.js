import express from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import { isAdmin, isAdminOrHOD } from '../../middleware/role.middleware.js';

import { 
    getPendingApplications,
    reviewApplication,
    getUsersByRole,
    promoteToFaculty,
    getAttendanceStats,
    getFeedbackReport,
    getFeedbackSummary,
    updateTeacherAssignments,
    deleteTeacherAssignment,
    getAllTeachers,
    updateStudentDetails,
    updateStudentEnrollment,
    getStudentReport,
    getTeacherReport,
} from './admin.controller.js';


const router = express.Router();


// --- Application & User Management (Admin Only) ---
router.route('/applications')
    .get(protect, isAdmin, getPendingApplications);

router.route('/applications/:userId/review')
    .patch(protect, isAdmin, reviewApplication);

router.route('/users')
    .get(protect, isAdmin, getUsersByRole);

router.route('/users/:userId/promote')
    .patch(protect, isAdmin, promoteToFaculty);

router.route('/teachers')
    .get(protect, isAdmin, getAllTeachers);    



// --- Route for managing teacher assignments ---
router.route('/teachers/:teacherId/assignments')
    .post(protect, isAdmin, updateTeacherAssignments);

router.route('/teachers/:teacherId/assignments/:assignmentId')
    .delete(protect, isAdmin, deleteTeacherAssignment);


// --- Route for managing students data ---
router.route('/students/:studentId')
    .put(protect, isAdmin, updateStudentDetails);

router.route('/students/:studentId/enrollment')
    .put(protect, isAdmin, updateStudentEnrollment);


// --- Reporting & Statistics (Admin & HOD) ---
router.route('/attendance-stats')
    .get(protect, isAdminOrHOD, getAttendanceStats);

router.route('/feedback-summary')
    .get(protect, isAdminOrHOD, getFeedbackSummary);

router.get('/reports/teacher/:teacherId', protect, isAdminOrHOD, getTeacherReport);
router.get('/reports/student/:studentId', protect, isAdminOrHOD, getStudentReport);
router.get('/feedback-report/:classSessionId', protect, isAdminOrHOD, getFeedbackReport);


export default router;