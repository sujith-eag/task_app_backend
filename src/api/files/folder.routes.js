import express from 'express';
const router = express.Router();

import { protect } from '../../middleware/auth.middleware.js';
import { createFolder, moveItem } from './folder.controller.js';

// All routes in this file are protected
router.use(protect);

// Route for creating a folder
router.post('/', createFolder);

// Route for moving a file or folder. PATCH /api/folders/:itemId/move
router.patch('/:itemId/move', moveItem);

export default router;