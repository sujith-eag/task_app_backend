import express from 'express';
import { getPublicDownloadLink } from '../controllers/public.controller.js';
import { downloadPublicFolder } from '../controllers/public.controller.js';
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

// Public folder download (streaming zip) - provide { code } in body
router.post(
  '/folders/:id/download',
  validate(publicDownloadSchema, 'body'),
  downloadPublicFolder
);

// Allow GET with ?code=... for direct-link browser visits (convenience)
router.get('/folders/:id/download', (req, res, next) => {
  // Copy query.code into body so the controller can reuse the same logic.
  req.body = { code: req.query.code };
  return downloadPublicFolder(req, res, next);
});

export default router;
