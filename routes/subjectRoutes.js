import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/roleMiddleware.js';

import {
    createSubject,
    getSubjects,
    getSubjectById,
    updateSubject,
    deleteSubject
    } from '../controllers/subjectController.js';

const router = express.Router();

// All routes in this file are protected and require admin access
router.use(protect, isAdmin);

router.route('/')
    .post(createSubject)
    .get(getSubjects);
    
router.route('/:id')
    .get(getSubjectById)
    .put(updateSubject)
    .delete(deleteSubject);

export default router;