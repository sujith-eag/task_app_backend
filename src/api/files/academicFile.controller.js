import asyncHandler from 'express-async-handler';

import File from '../../models/fileModel.js';
import User from '../../models/userModel.js';


// Needs a Joi schema
// import Joi from 'joi';
// const shareFileSchema = Joi.object({


// @desc    Share a file with an entire class
// @route   POST /api/v1/files/:id/share-class
// @access  Private (Owner of the file)
export const shareFileWithClass = asyncHandler(async (req, res) => {
    const { subject, batch, semester, section } = req.body;
    const file = await File.findById(req.params.id);

    // Verify the file exists and the user is the owner
    if (!file) {
        res.status(404);
        throw new Error('File not found.');
    }
    if (file.user.toString() !== req.user.id) {
        res.status(403);
        throw new Error('You are not authorized to share this file.');
    }

    // Validate that the teacher is assigned to the subject they are sharing with
    const teacher = await User.findById(req.user.id);
    const isAssigned = teacher.teacherDetails.subjectsTaught.some(
        taughtSubject => taughtSubject.toString() === subject
    );
    if (!isAssigned) {
        res.status(403);
        throw new Error('You can only share files with classes you are assigned to teach.');
    }

    // Update the file with the class sharing details
    file.sharedWithClass = { subject, batch, semester, section };
    await file.save();

    res.status(200).json({ message: 'File has been shared with the class.' });
});