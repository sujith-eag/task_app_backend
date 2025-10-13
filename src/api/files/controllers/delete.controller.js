import asyncHandler from 'express-async-handler';

import { deleteFile as deleteFromS3 } from '../../../services/s3.service.js';
import File from '../../../models/fileModel.js';



// @desc    Delete a file
// @route   DELETE /api/files/delete/:id
// @access  Private
export const deleteFile = asyncHandler(async (req, res) => {
    const loggedInUserId = req.user.id;
    const fileId = req.params.id;

    // Find the file in the database
    const file = await File.findById(fileId);
    if (!file) {
        res.status(404);
        throw new Error('File not found.');
    }

    // Verify the user is the owner of the file.
    // A user the file is shared with CANNOT delete it.
    if (file.user.toString() !== loggedInUserId) {
        res.status(403);
        throw new Error('You do not have permission to delete this file.');
    }

    // Delete the file from the S3 bucket first.
    await deleteFromS3(file.s3Key);

    // After successful S3 deletion, delete the record from the database.
    await File.findByIdAndDelete(fileId);

    res.status(200).json({ message: 'File deleted successfully.' });
});



// @desc    Delete multiple files
// @route   DELETE /api/files/delete
// @access  Private
export const bulkDeleteFiles = asyncHandler(async (req, res) => {
    const { fileIds } = req.body; // Expect an array of file IDs

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
        res.status(400);
        throw new Error('File IDs must be provided as an array.');
    }

    // Find all files that match the IDs AND belong to the logged-in user
    const filesToDelete = await File.find({
        '_id': { $in: fileIds },
        'user': req.user.id
    });

    // Security Check: If the number of found files doesn't match the number of requested IDs,
    // it means the user tried to delete a file they don't own.
    if (filesToDelete.length !== fileIds.length) {
        res.status(403);
        throw new Error('You do not have permission to delete one or more of the selected files.');
    }

    // Proceed with deletion
    // 1. Delete from S3 in parallel
    const deleteS3Promises = filesToDelete.map(file => deleteFromS3(file.s3Key));
    await Promise.all(deleteS3Promises);

    // 2. Delete from MongoDB in a single operation
    await File.deleteMany({
        '_id': { $in: fileIds },
        'user': req.user.id
    });

    res.status(200).json({ message: `${filesToDelete.length} files deleted successfully.` });
});

