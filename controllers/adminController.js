import asyncHandler from 'express-async-handler';
import Joi from 'joi';
import User from '../models/userModel.js';
import ClassSession from '../models/classSessionModel.js';
import Feedback from '../models/feedbackModel.js';


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
        assignments: [],
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


// @desc    Add or update a teacher's subject assignments
// @route   POST /api/v1/admin/teachers/:teacherId/assignments
// @access  Private/Admin
export const updateTeacherAssignments = asyncHandler(async (req, res) => {
    const { error, value } = teacherAssignmentSchema.validate(req.body);
    if (error) {
        res.status(400);
        throw new Error(error.details[0].message);
    }

    const teacher = await User.findById(req.params.teacherId);

    if (!teacher || teacher.role !== 'teacher') {
        res.status(404);
        throw new Error('Teacher not found.');
    }

    // This logic adds a new assignment. A more complex implementation
    // could also handle updating existing assignments.
    teacher.teacherDetails.assignments.push(value);
    
    await teacher.save();
    
    // Populate the subject details for a more informative response
    const updatedTeacher = await User.findById(req.params.teacherId).populate({
        path: 'teacherDetails.assignments.subject',
        select: 'name subjectCode'
    });

    res.status(200).json({
        message: 'Teacher assignment updated successfully.',
        teacherDetails: updatedTeacher.teacherDetails,
    });
});



// @desc    Get aggregated attendance statistics
// @route   GET /api/admin/attendance-stats
// @access  Private/Admin_HOD
export const getAttendanceStats = asyncHandler(async (req, res) => {
    const { teacherId, subjectId, semester } = req.query;
    const matchQuery = {};

    // Build the initial match query. Mongoose will cast the string IDs automatically.
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


// @desc    Get aggregated feedback summary
// @route   GET /api/admin/feedback-summary
// @access  Private/Admin_HOD
export const getFeedbackSummary = asyncHandler(async (req, res) => {
    const { teacherId, subjectId } = req.query;
    const matchQuery = {};

    // Mongoose will cast the string IDs automatically.
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


// @desc    Get all users with the teacher role
// @route   GET /api/v1/admin/teachers
// @access  Private/Admin
export const getAllTeachers = asyncHandler(async (req, res) => {
    const teachers = await User.find({ role: 'teacher' })
        .select('name email teacherDetails')
        .populate({
            path: 'teacherDetails.assignments.subject',
            select: 'name subjectCode'
        });
    res.status(200).json(teachers);
});