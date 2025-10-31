import { asyncHandler } from '../../_common/http/asyncHandler.js';
import * as sharesService from '../services/shares.service.js';

// ============================================================================
// Public Access Controllers (No Authentication Required)
// ============================================================================

/**
 * @desc    Get a download link for a publicly shared file
 * @route   POST /api/public/download
 * @access  Public
 */
export const getPublicDownloadLink = asyncHandler(async (req, res) => {
  const { code } = req.body;

  const result = await sharesService.getPublicDownloadLinkService(code);

  res.status(200).json(result);
});
