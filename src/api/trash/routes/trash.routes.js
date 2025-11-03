import express from 'express';
import * as trashController from '../controllers/trash.controller.js';
import { protect } from '../../_common/middleware/auth.middleware.js';
import {
	loadFile,
	isFileOwner,
	isNotInTrash,
	isInTrash,
	bulkOperationLimit
} from '../policies/trash.policies.js';
import { validate, bulkOperationSchema } from '../validators/trash.validators.js';

const router = express.Router();

/**
 * GET /api/trash
 * List trashed items for the authenticated user
 */
router.get('/', protect, trashController.listTrash);

/**
 * GET /api/trash/stats
 * Return trash stats (count, totalSize)
 */
router.get('/stats', protect, trashController.getTrashStats);

// ---------------------------------------------------------------------------
// Soft-delete endpoints (Phase 2.2)
// ---------------------------------------------------------------------------
/**
 * DELETE /api/trash/soft-delete/:fileId
 * Middleware: protect -> loadFile -> isFileOwner -> isNotInTrash
 */
router.delete(
	'/soft-delete/:fileId',
	protect,
	loadFile,
	isFileOwner,
	isNotInTrash,
	trashController.softDeleteFile
);

/**
 * POST /api/trash/soft-delete/bulk
 * Middleware: protect -> validate(bulkOperationSchema) -> bulkOperationLimit
 */
router.post(
	'/soft-delete/bulk',
	protect,
	validate(bulkOperationSchema, 'body'),
	bulkOperationLimit,
	trashController.bulkSoftDelete
);

// ---------------------------------------------------------------------------
// Restore endpoints
// ---------------------------------------------------------------------------
/**
 * POST /api/trash/restore/:fileId
 * Middleware: protect -> loadFile -> isFileOwner -> isInTrash
 */
router.post(
	'/restore/:fileId',
	protect,
	loadFile,
	isFileOwner,
	isInTrash,
	trashController.restoreFile
);

/**
 * POST /api/trash/restore/bulk
 * Middleware: protect -> validate(bulkOperationSchema) -> bulkOperationLimit
 */
router.post(
	'/restore/bulk',
	protect,
	validate(bulkOperationSchema, 'body'),
	bulkOperationLimit,
	trashController.bulkRestore
);

// ---------------------------------------------------------------------------
// Purge (permanent delete) endpoints (Phase 2.4)
// ---------------------------------------------------------------------------
/**
 * DELETE /api/trash/purge/:fileId
 * Middleware: protect -> loadFile -> isFileOwner -> isInTrash
 */
router.delete(
	'/purge/:fileId',
	protect,
	loadFile,
	isFileOwner,
	isInTrash,
	trashController.purgeFile
);

/**
 * POST /api/trash/purge/bulk
 * Middleware: protect -> validate(bulkOperationSchema) -> bulkOperationLimit
 */
router.post(
	'/purge/bulk',
	protect,
	validate(bulkOperationSchema, 'body'),
	bulkOperationLimit,
	trashController.bulkPurge
);

/**
 * DELETE /api/trash/empty
 * Middleware: protect
 */
router.delete('/empty', protect, trashController.emptyTrash);

export default router;
