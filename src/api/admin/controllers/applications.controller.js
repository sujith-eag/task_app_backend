import asyncHandler from 'express-async-handler';
import User from '../../../models/userModel.js';
import { populateTemplate } from '../../../utils/emailTemplate.js';
import { sendEmail } from '../../../services/email.service.js';


// @desc    Get all pending student applications
// @route   GET /api/admin/applications
// @access  Private/Admin
export const getPendingApplications = asyncHandler(async (req, res) => {
    const applications = await User.find({
        'studentDetails.applicationStatus': 'pending'
    })
    .select('name email studentDetails');    

    // Being explicit about which nested fields to select
    // .select('name email studentDetails.usn studentDetails.batch studentDetails.section');
    
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
    
    // --- Send Approval Email ---
    try {
        const templateData = {
            name: user.name,
            loginUrl: `${process.env.FRONTEND_URL}/login`
        };
        const htmlMessage = await populateTemplate('studentApplicationApproved.html', templateData);
        
        await sendEmail({
            to: user.email,
            subject: 'Your Student Application has been Approved!',
            html: htmlMessage,
            text: `Congratulations ${user.name}, your application has been approved! You can now log in.`
        });
    } catch (emailError) {
        console.error("Failed to send approval email:", emailError);
    }    
});