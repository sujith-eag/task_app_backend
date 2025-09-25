import asyncHandler from 'express-async-handler';
import Joi from 'joi';
import User from '../models/userModel.js';


// Joi schema for validating faculty promotion data
const facultyPromotionSchema = Joi.object({
    role: Joi.string().valid('teacher', 'hod').required(),
    staffId: Joi.string().trim().required(),
    department: Joi.string().trim().required(),
});

// @desc    Get all pending student applications
// @route   GET /api/admin/applications
// @access  Private/Admin
export const getPendingApplications = asyncHandler(async (req, res) => {
    const applications = await User.find({
        'studentDetails.applicationStatus': 'pending'
    }).select('name email studentDetails');

    res.status(200).json(applications);
});


// @desc    Approve or reject a student application
// @route   PATCH /api/admin/applications/:userId/review
// @access  Private/Admin
export const reviewApplication = asyncHandler(async (req, res) => {
    const { action } = req.body; // 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
        res.status(400);
        throw new Error("Invalid action. Must be 'approve' or 'reject'.");
    }

    const user = await User.findById(req.params.userId);

    if (!user) {
        res.status(404);
        throw new Error('User not found.');
    }

    if (user.studentDetails.applicationStatus !== 'pending') {
        res.status(400);
        throw new Error('This application is not in a pending state.');
    }

    if (action === 'approve') {
        user.role = 'student';
        user.studentDetails.applicationStatus = 'approved';
        user.studentDetails.isStudentVerified = true;
    } else { // 'reject'
        user.studentDetails.applicationStatus = 'rejected';
        // clear the submitted details
        user.studentDetails.usn = undefined;
        user.studentDetails.batch = undefined;
        user.studentDetails.section = undefined;
    }
    
    await user.save();

    res.status(200).json({
        message: `Application for ${user.name} has been ${action}d.`,
        user: {
            id: user._id,
            role: user.role,
            applicationStatus: user.studentDetails.applicationStatus,
        },
    });
});


// @desc    Promote a user to a faculty role (teacher/hod)
// @route   PATCH /api/v1/admin/users/:userId/promote
// @access  Private/Admin
export const promoteToFaculty = asyncHandler(async (req, res) => {
    const { error, value } = facultyPromotionSchema.validate(req.body);
    if (error) {
        res.status(400);
        throw new Error(error.details[0].message);
    }

    const { role, staffId, department } = value;
    const user = await User.findById(req.params.userId);

    if (!user) {
        res.status(404);
        throw new Error('User not found.');
    }

    // Check if staffId is already in use
    const staffIdExists = await User.findOne({ 'teacherDetails.staffId': staffId });
    if (staffIdExists && staffIdExists._id.toString() !== user._id.toString()) {
        res.status(400);
        throw new Error('This Staff ID is already assigned to another user.');
    }

    user.role = role;
    user.teacherDetails = {
        staffId,
        department,
        subjectsTaught: user.teacherDetails?.subjectsTaught || [], // Preserve subjects if already a teacher
    };
    
    // Clear student data if they were a student before promotion
    user.studentDetails = {
        applicationStatus: 'not_applied'
    };

    await user.save();

    res.status(200).json({
        message: `${user.name} has been promoted to ${role}.`,
        user: {
            id: user._id,
            role: user.role,
            teacherDetails: user.teacherDetails,
        }
    });
});