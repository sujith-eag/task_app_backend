import express from 'express';

import { protect } from '../_common/middleware/auth.middleware.js';
import { isAdmin } from '../_common/middleware/rbac.middleware.js';

import {
    createSubject,
    getSubjects,
    getSubjectById,
    updateSubject,
    deleteSubject
    } from './subject.controller.js';

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