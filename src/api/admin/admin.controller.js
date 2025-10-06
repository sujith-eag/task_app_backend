import asyncHandler from 'express-async-handler';
import Joi from 'joi';
import User from '../../models/userModel.js';
import ClassSession from '../../models/classSessionModel.js';
import Feedback from '../../models/feedbackModel.js';
import Subject from '../../models/subjectModel.js';
import TeacherSessionReflection from '../../models/teacherSessionReflectionModel.js';

import { populateTemplate } from '../../utils/emailTemplate.js';
import { sendEmail } from '../../services/email.service.js';
import { use } from 'passport';


const updateStudentSchema = Joi.object({
    usn: Joi.string().trim().optional(),
    batch: Joi.number().integer().min(2000).optional(),
    section: Joi.string().trim().valid('A', 'B', 'C').optional(),
    semester: Joi.number().integer().min(1).max(4).optional()
}).min(1).messages({ // Requires at least one key to be present
    'object.min': 'At least one field (usn, batch, semester or section) must be provided to update.'
});

const updateEnrollmentSchema = Joi.object({
    subjectIds: Joi.array().items(Joi.string().hex().length(24)).required()
});

// Joi Schema for the initial promotion to a faculty role
const facultyPromotionSchema = Joi.object({
    role: Joi.string().valid('teacher', 'hod').required(),
    staffId: Joi.string().trim().required(),
    department: Joi.string().trim().required(),
});

// Joi Schema for adding/updating a teacher's subject assignment
const teacherAssignmentSchema = Joi.object({
    subject: Joi.string().hex().length(24).required(), // Subject ID
    sections: Joi.array().items(Joi.string()).min(1).required(), // e.g., ['A', 'B']
    batch: Joi.number().integer().required(),
    semester: Joi.number().integer().min(1).max(4).required()
});



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
    
    
    res.status(200).json({
        message: `Application for ${user.name} has been ${action}d.`,
        user: {
            id: user._id,
            role: user.role,
            applicationStatus: user.studentDetails.applicationStatus,
        },
    });
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


// @desc    Add or update a teacher's subject assignments
// @route   POST /api/admin/teachers/:teacherId/assignments
// @access  Private/Admin
export const updateTeacherAssignments = asyncHandler(async (req, res) => {
    const { error, value } = teacherAssignmentSchema.validate(req.body);
    if (error) {
        res.status(400);
        throw new Error(error.details[0].message);
    }

    // Validate that the subject exists before assigning it
    const subjectExists = await Subject.findById(value.subject);
    if (!subjectExists) {
        res.status(400);
        throw new Error('Invalid Subject ID. Subject does not exist.');
    }

    const teacher = await User.findById(req.params.teacherId);
    // Allow assigning subjects to both teachers and HODs
    if (!teacher || !['teacher', 'hod'].includes(teacher.role)) {
        res.status(404);
        throw new Error('Teacher not found.');
    }

    // --- DUPLICATION CHECK ---
    const assignmentExists = teacher.teacherDetails.assignments.some(
        (assign) =>
            assign.subject.toString() === value.subject &&
            assign.batch === value.batch &&
            assign.semester === value.semester &&
            JSON.stringify(assign.sections.sort()) === JSON.stringify(value.sections.sort())
    );
    if (assignmentExists) {
        res.status(400);
        throw new Error('This exact assignment already exists for this teacher.');
    }

    // This logic adds a new assignment.
    teacher.teacherDetails.assignments.push(value);
    
    await teacher.save();
    
    // Populate the subject details for a more informative response
    const updatedTeacher = await User.findById(req.params.teacherId).populate({
        path: 'teacherDetails.assignments.subject',
        select: 'name subjectCode'
    });

    res.status(201).json({  // 201 for adding a new resource
        message: 'Teacher assignment updated successfully.',
        teacherDetails: updatedTeacher.teacherDetails,
    });
});



// @desc    Delete a teacher's subject assignment
// @route   DELETE /api/admin/teachers/:teacherId/assignments/:assignmentId
// @access  Private/Admin
export const deleteTeacherAssignment = asyncHandler(async (req, res) => {
    const { teacherId, assignmentId } = req.params;

    const teacher = await User.findById(teacherId);

    if (!teacher || !['teacher', 'hod'].includes(teacher.role)) {
        res.status(404);
        throw new Error('Faculty member not found.');
    }

    // Check if the assignment exists before trying to remove it
    const assignment = teacher.teacherDetails.assignments.id(assignmentId);
    if (!assignment) {
        res.status(404);
        throw new Error('Assignment not found for this faculty member.');
    }
    
    // Use the .pull() method to remove the subdocument by its _id
    teacher.teacherDetails.assignments.pull(assignmentId);

    await teacher.save();

    res.status(200).json({
        message: 'Assignment removed successfully.',
    });
});



// @desc    Get aggregated attendance statistics
// @route   GET /api/admin/attendance-stats
// @access  Private/Admin_HOD
export const getAttendanceStats = asyncHandler(async (req, res) => {
    const { teacherId, subjectId, semester } = req.query;
    const matchQuery = {};

    if (teacherId) matchQuery.teacher = teacherId;
    if (subjectId) matchQuery.subject = subjectId;
    if (semester) matchQuery.semester = parseInt(semester, 10);

    const stats = await ClassSession.aggregate([
        // Stage 1: Initial filter based on query parameters
        { $match: matchQuery },
        // Stage 2: Deconstruct the attendanceRecords array
        { $unwind: '$attendanceRecords' },
        // Stage 3: Group by subject and teacher to calculate stats
        {
            $group: {
                _id: { subject: '$subject', teacher: '$teacher' },
                totalStudents: { $sum: 1 },
                presentStudents: {
                    $sum: { $cond: [{ $eq: ['$attendanceRecords.status', true] }, 1, 0] }
                }
            }
        },
        // Stage 4: Calculate the attendance percentage
        {
            $project: {
                _id: 0,
                subject: '$_id.subject',
                teacher: '$_id.teacher',
                totalStudents: '$totalStudents',
                presentStudents: '$presentStudents',
                attendancePercentage: {
                    $round: [
                        { $multiply: [{ $divide: ['$presentStudents', '$totalStudents'] }, 100] },
                        2
                    ]
                }
            }
        },
        // Stage 5: Populate teacher and subject details for a readable output
        { $lookup: { from: 'users', localField: 'teacher', foreignField: '_id', as: 'teacherDetails' } },
        { $lookup: { from: 'subjects', localField: 'subject', foreignField: '_id', as: 'subjectDetails' } },
        // Stage 6: Final projection
        {
            $project: {
                teacherName: { $arrayElemAt: ['$teacherDetails.name', 0] },
                subjectName: { $arrayElemAt: ['$subjectDetails.name', 0] },
                subjectCode: { $arrayElemAt: ['$subjectDetails.subjectCode', 0] },
                totalStudents: 1,
                presentStudents: 1,
                attendancePercentage: 1,
            }
        },
        { $sort: { subjectName: 1, teacherName: 1 } }
    ]);

    res.status(200).json(stats);
});



// @desc    Get a comprehensive feedback report for a class session
// @route   GET /api/admin/feedback-report/:classSessionId
// @access  Private/Admin_HOD
export const getFeedbackReport = asyncHandler(async (req, res) => {
    const { classSessionId } = req.params;

    // 1. Fetch Session Details
    const sessionDetails = ClassSession.findById(classSessionId)
        .populate('teacher', 'name')
        .populate('subject', 'name subjectCode');

    // 2. Aggregate Anonymous Student Feedback
    const studentFeedbackPromise = Feedback.aggregate([
        { $match: { classSession: mongoose.Types.ObjectId(classSessionId) } },
        {
            $group: {
                _id: '$classSession',
                feedbackCount: { $sum: 1 },
                avgClarity: { $avg: '$ratings.clarity' },
                avgEngagement: { $avg: '$ratings.engagement' },
                avgPace: { $avg: '$ratings.pace' },
                avgKnowledge: { $avg: '$ratings.knowledge' },
                positiveComments: { $push: '$positiveFeedback' },
                improvementSuggestions: { $push: '$improvementSuggestions' },
            }
        },
        {
            $project: {
                _id: 0,
                feedbackCount: 1,
                averageRatings: {
                    clarity: { $round: ['$avgClarity', 2] },
                    engagement: { $round: ['$avgEngagement', 2] },
                    pace: { $round: ['$avgPace', 2] },
                    knowledge: { $round: ['$avgKnowledge', 2] },
                },
                positiveComments: { $filter: { input: "$positiveComments", as: "comment", cond: { $ne: ["$$comment", ""] } } },
                improvementSuggestions: { $filter: { input: "$improvementSuggestions", as: "suggestion", cond: { $ne: ["$$suggestion", ""] } } },
            }
        }
    ]);

    // 3. Fetch Teacher's Reflection
    const teacherReflectionPromise = TeacherSessionReflection.findOne({ classSession: classSessionId });

    // Execute all promises in parallel
    const [session, studentFeedback, teacherReflection] = await Promise.all([
        sessionDetails,
        studentFeedbackPromise,
        teacherReflectionPromise
    ]);

    if (!session) {
        res.status(404);
        throw new Error('Class session not found.');
    }

    res.status(200).json({
        sessionDetails: session,
        studentFeedbackSummary: studentFeedback[0] || { feedbackCount: 0, averageRatings: {}, comments: [] },
        teacherReflection: teacherReflection || null,
    });
});



// @desc    Get aggregated feedback summary
// @route   GET /api/admin/feedback-summary
// @access  Private/Admin_HOD
export const getFeedbackSummary = asyncHandler(async (req, res) => {
    const { teacherId, subjectId } = req.query;
    const matchQuery = {};

    if (teacherId) matchQuery.teacher = teacherId;
    if (subjectId) matchQuery.subject = subjectId;

    const summary = await Feedback.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: { subject: '$subject', teacher: '$teacher' },
                averageRating: { $avg: '$rating' },
                feedbackCount: { $sum: 1 },
                comments: { $push: '$comment' }
            }
        },
        {
            $project: {
                _id: 0,
                subject: '$_id.subject',
                teacher: '$_id.teacher',
                averageRating: { $round: ['$averageRating', 2] },
                feedbackCount: 1,
                comments: 1
            }
        },
        { $lookup: { from: 'users', localField: 'teacher', foreignField: '_id', as: 'teacherDetails' } },
        { $lookup: { from: 'subjects', localField: 'subject', foreignField: '_id', as: 'subjectDetails' } },
        {
            $project: {
                teacherName: { $arrayElemAt: ['$teacherDetails.name', 0] },
                subjectName: { $arrayElemAt: ['$subjectDetails.name', 0] },
                subjectCode: { $arrayElemAt: ['$subjectDetails.subjectCode', 0] },
                averageRating: 1,
                feedbackCount: 1,
                comments: 1
            }
        },
        { $sort: { averageRating: -1 } }
    ]);

    res.status(200).json(summary);
});


// @desc    Get all users with the teacher or hod role
// @route   GET /api/admin/teachers
// @access  Private/Admin
export const getAllTeachers = asyncHandler(async (req, res) => {
    const teachers = await User.find({ role: { $in: ['teacher', 'hod'] } })
        .select('name email teacherDetails')
        .populate({
            path: 'teacherDetails.assignments.subject',
            select: 'name subjectCode'
        });
    res.status(200).json(teachers);
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

    // Update only the provided details
    Object.assign(student.studentDetails, value);
    
    await student.save();

    // Respond with the updated details
    res.status(200).json({
        message: 'Student details updated successfully.',
        studentDetails: student.studentDetails
    });
});