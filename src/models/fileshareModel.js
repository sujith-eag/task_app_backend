import mongoose from 'mongoose';

const fileShareSchema = new mongoose.Schema({
	fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: true },
	userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
	expiresAt: { type: Date, default: null }
});
// Create indexes for fast lookups
fileShareSchema.index({ fileId: 1, userId: 1 }, { unique: true });
fileShareSchema.index({ userId: 1, fileId: 1 });

// Static helpers used by policies/services
/**
 * Check whether a user has a direct share for a file
 * @param {ObjectId|string} fileId
 * @param {ObjectId|string} userId
 * @returns {Promise<boolean>}
 */
fileShareSchema.statics.userHasAccess = async function (fileId, userId) {
	if (!fileId || !userId) return false;
	const exists = await this.exists({ fileId, userId });
	return !!exists;
};

/**
 * Find all FileShare docs for a given fileId
 * @param {ObjectId|string} fileId
 */
fileShareSchema.statics.findByFile = function (fileId) {
	return this.find({ fileId }).populate('userId', 'name avatar');
};

/**
 * Get list of FileShare entries for a user (files shared with the user)
 * @param {ObjectId|string} userId
 */
fileShareSchema.statics.getFilesSharedWithUser = function (userId) {
	return this.find({ userId }).populate('fileId');
};

/**
 * Delete expired FileShare entries (expiresAt < now)
 */
fileShareSchema.statics.cleanExpired = function () {
	const now = new Date();
	return this.deleteMany({ expiresAt: { $lte: now } });
};

const FileShare = mongoose.model('FileShare', fileShareSchema);

export default FileShare;
