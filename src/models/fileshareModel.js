import mongoose from 'mongoose';

const fileShareSchema = new mongoose.Schema({
	fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: true },
	userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
	expiresAt: { type: Date, default: null }
});
// Create indexes for fast lookups
fileShareSchema.index({ fileId: 1, userId: 1 }, { unique: true });
fileShareSchema.index({ userId: 1, fileId: 1 });

const FileShare = mongoose.model('FileShare', fileShareSchema);

export default FileShare;
