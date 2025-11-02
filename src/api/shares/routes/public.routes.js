import express from 'express';
import { getPublicDownloadLink } from '../controllers/public.controller.js';
import {
  publicDownloadSchema,
  validate,
} from '../validators/shares.validators.js';

const router = express.Router();

// ============================================================================
// Public Routes (No Authentication Required)
// ============================================================================

/**
 * POST /api/public/download
 * Get download link using public share code
 * No authentication required
 */
router.post(
  '/download',
  validate(publicDownloadSchema, 'body'),
  getPublicDownloadLink
);

// Backwards-compatible route used by older frontend code: /api/public/files/download
router.post(
  '/files/download',
  validate(publicDownloadSchema, 'body'),
  getPublicDownloadLink
);

export default router;
