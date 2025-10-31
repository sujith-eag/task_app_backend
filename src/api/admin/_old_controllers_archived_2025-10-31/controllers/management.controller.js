import asyncHandler from 'express-async-handler';
import Joi from 'joi';
import User from '../../../models/userModel.js';
import Subject from '../../../models/subjectModel.js';
import { populateTemplate } from '../../../utils/emailTemplate.js';
import { sendEmail } from '../../../services/email.service.js';


const updateStudentSchema = Joi.object({
    usn: Joi.string().trim().optional(),
    batch: Joi.number().integer().min(2000).optional(),
    section: Joi.string().trim().valid('A', 'B', 'C').optional(),
    semester: Joi.number().integer().min(1).max(4).optional()
}).min(1).messages({
    'object.min': 'At least one field (usn, batch, semester or section) must be provided to update.'
});

const updateEnrollmentSchema = Joi.object({
    subjectIds: Joi.array().items(Joi.string().hex().length(24)).required()
});

const facultyPromotionSchema = Joi.object({
    role: Joi.string().valid('teacher', 'hod').required(),
    staffId: Joi.string().trim().required(),
    department: Joi.string().trim().required(),
});


// @desc    Get users by their role (verified only)
// @route   GET /api/admin/users?role=user
// @access  Private/Admin
export const getUsersByRole = asyncHandler(async (req, res) => {
    const { role } = req.query;

    if (!role) {
        res.status(400);
        throw new Error('A "role" query parameter is required ( ?role=user).');
    }

    const validRoles = ['user', 'student', 'teacher', 'hod'];
    if (!validRoles.includes(role)) {
        res.status(400);
        throw new Error(`Invalid role specified. Must be one of: ${validRoles.join(', ')}`);
    }

    // Find users and select fields relevant for management lists    
    const users = await User.find({ 
        role: role,
        isVerified: true,
    }).select('name email studentDetails');

    res.status(200).json(users);
});


// @desc    Update a student's enrolled subjects
// @route   PUT /api/admin/students/:studentId/enrollment
// @access  Private/Admin
export const updateStudentEnrollment = asyncHandler(async (req, res) => {
    const { error, value } = updateEnrollmentSchema.validate(req.body);
    if (error) {
        res.status(400);
        throw new Error(error.details[0].message);
    }

    const student = await User.findById(req.params.studentId);

    if (!student || student.role !== 'student') {
        res.status(404);
        throw new Error('Student not found.');
    }

    // CRITICAL: Validation Logic to check Semester    
    if (value.subjectIds.length > 0) {
        const studentSemester = student.studentDetails.semester;
        if (!studentSemester) {
            res.status(400);
            throw new Error('Cannot enroll subjects for a student with no assigned semester.');
        }

        const subjectsToEnroll = await Subject.find({ '_id': { $in: value.subjectIds } });

        // Ensure all found subjects match the student's semester        
        const allSubjectsMatchSemester = subjectsToEnroll.every(
            subject => subject.semester === studentSemester
        );

        if (!allSubjectsMatchSemester) {
            res.status(400);
            throw new Error('One or more subjects do not match the student\'s current semester.');
        }
    }

    // Replace the existing enrolled subjects with the new array    
    student.studentDetails.enrolledSubjects = value.subjectIds;
    
    await student.save();
    
    res.status(200).json({
        message: 'Student enrollment updated successfully.',
        enrolledSubjects: student.studentDetails.enrolledSubjects
    });
});


// @desc    Promote a user to a faculty role (teacher/hod)
// @route   PATCH /api/admin/users/:userId/promote
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
        assignments: [],
    };
    
    // Clear student data if they were a student before promotion
    user.studentDetails = {
        applicationStatus: 'not_applied'
    };

    await user.save();

    // --- Send Promotion Email ---
    try {
        const templateData = {
            name: user.name,
            newRole: user.role,
            loginUrl: `${process.env.FRONTEND_URL}/login`
        };
        const htmlMessage = await populateTemplate('facultyPromotion.html', templateData);
        
        await sendEmail({
            to: user.email,
            subject: 'Your Account Role has been Updated',
            html: htmlMessage,
            text: `Hello ${user.name}, your account has been promoted to the ${newRole} role.`
        });
    } catch (emailError) {
        console.error("Failed to send promotion email:", emailError);
    }
     
    res.status(200).json({
        message: `${user.name} has been promoted to ${role}.`,
        user: {
            id: user._id,
            role: user.role,
            teacherDetails: user.teacherDetails,
        }
    }); 
});


// @desc    Update a student's details by an admin
// @route   PUT /api/admin/students/:studentId
// @access  Private/Admin
export const updateStudentDetails = asyncHandler(async (req, res) => {
    // Validate the incoming data
    const { error, value } = updateStudentSchema.validate(req.body);
    if (error) {
        res.status(400);
        throw new Error(error.details[0].message);
    }

    // Find the user and confirm they are a student
    const student = await User.findById(req.params.studentId);

    if (!student || student.role !== 'student') {
        res.status(404);
        throw new Error('Student not found.');
    }

    // EDGE CASE: If semester is being changed, wipe existing enrollments.
    const newSemester = value.semester;
    const currentSemester = student.studentDetails.semester;
    if (newSemester && newSemester !== currentSemester) {
        student.studentDetails.enrolledSubjects = [];
    }    
    
    // Update only the provided details
    Object.assign(student.studentDetails, value);
    
    await student.save();

    // Respond with the updated details
    res.status(200).json({
        message: 'Student details updated successfully.',
        studentDetails: student.studentDetails
    });
});