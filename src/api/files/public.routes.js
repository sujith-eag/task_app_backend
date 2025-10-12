import express from 'express';
const router = express.Router();

import { publicApiLimiter } from '../../middleware/rateLimiter.middleware.js';
import { getPublicDownloadLink } from './public.controller.js';

// Apply strict rate limiting to this public route
// POST /api/public/download
router.post('/download', publicApiLimiter, getPublicDownloadLink);

export default router;