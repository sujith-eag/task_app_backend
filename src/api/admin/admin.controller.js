import asyncHandler from 'express-async-handler';
import Joi from 'joi';
import mongoose from 'mongoose';

import User from '../../models/userModel.js';
import ClassSession from '../../models/classSessionModel.js';
import Feedback from '../../models/feedbackModel.js';
import Subject from '../../models/subjectModel.js';
import TeacherSessionReflection from '../../models/teacherSessionReflectionModel.js';

import { populateTemplate } from '../../utils/emailTemplate.js';
import { sendEmail } from '../../services/email.service.js';


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
    const subject = await Subject.findById(value.subject);
    if (!subject) {
        res.status(400);
        throw new Error('Invalid Subject ID. Subject does not exist.');
    }

    // Ensure the semester of the subject document matches the semester in the request
    if (subject.semester !== value.semester) {
        res.status(400);
        throw new Error(`Semester mismatch: The selected subject '${subject.name}' belongs to semester ${subject.semester}, not ${value.semester}.`);
    };


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

    // Adding a new assignment.
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





// @desc    Get aggregated attendance statistics
// @route   GET /api/admin/attendance-stats
// @access  Private/Admin_HOD
export const getAttendanceStats = asyncHandler(async (req, res) => {
    const { teacherId, subjectId, semester } = req.query;
    const matchQuery = {};

    // Build the initial match query for coarse-grained server-side filtering
    if (teacherId) matchQuery.teacher = new mongoose.Types.ObjectId(teacherId);
    if (subjectId) matchQuery.subject = new mongoose.Types.ObjectId(subjectId);
    if (semester) matchQuery.semester = parseInt(semester, 10);

    const stats = await ClassSession.aggregate([
        // Stage 1: Initial filter based on query parameters to reduce dataset size.
        { $match: matchQuery },
        
        // Stage 2: Deconstruct the attendanceRecords array to process each student.
        { $unwind: '$attendanceRecords' },

        // Stage 3: Group by a more granular key to preserve batch and section details.
        {
            $group: {
                _id: { 
                    subject: '$subject', 
                    teacher: '$teacher',
                    batch: '$batch',
                    section: '$section',
                    semester: '$semester'
                },
                totalStudents: { $sum: 1 },
                presentStudents: {
                    $sum: { $cond: [{ $eq: ['$attendanceRecords.status', true] }, 1, 0] }
                }
            }
        },

        // Stage 4: Populate details from other collections.
        { $lookup: { 
            from: 'users', 
            localField: '_id.teacher', 
            foreignField: '_id', 
            as: 'teacherDetails' 
            } },
        { $lookup: { 
            from: 'subjects', 
            localField: '_id.subject', 
            foreignField: '_id', 
            as: 'subjectDetails' 
            } },

 
        // Stage 5: Project the final shape of the data for the frontend.
        {
            $project: {
                _id: 0, // Exclude the default _id
                // Create a stable, unique ID for the DataGrid.
                id: { $concat: [ 
                    { $toString: "$_id.teacher" }, "-", 
                    { $toString: "$_id.subject" }, "-",
                    { $toString: "$_id.batch" }, "-",
                    "$_id.section"
                ] },
                teacherId: '$_id.teacher',
                subjectId: '$_id.subject',
                teacherName: { $arrayElemAt: ['$teacherDetails.name', 0] },
                subjectName: { $arrayElemAt: ['$subjectDetails.name', 0] },
                batch: '$_id.batch',
                section: '$_id.section',
                semester: '$_id.semester',
                totalStudents: '$totalStudents',
                presentStudents: '$presentStudents',
                attendancePercentage: {
                    $cond: { // Avoid division by zero if totalStudents is 0
                        if: { $gt: ['$totalStudents', 0] },
                        then: { $round: [{ $multiply: [{ $divide: ['$presentStudents', '$totalStudents'] }, 100] }, 2] },
                        else: 0
                    }
                }
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
    const { teacherId, subjectId, semester } = req.query;
    const matchQuery = {};

    // Build the initial match query
    if (teacherId) matchQuery.teacher = new mongoose.Types.ObjectId(teacherId);
    if (subjectId) matchQuery.subject = new mongoose.Types.ObjectId(subjectId);
    if (semester) matchQuery.semester = parseInt(semester, 10);

    const summary = await Feedback.aggregate([

        // Stage 1: Filter on the server.
        { $match: matchQuery },

        // Stage 2: Group by teacher and subject.
        {
            $group: {
                _id: { subject: '$subject', teacher: '$teacher' },
                feedbackCount: { $sum: 1 },
                // FIX: Calculate the average for each individual rating criterion.
                avgClarity: { $avg: '$ratings.clarity' },
                avgEngagement: { $avg: '$ratings.engagement' },
                avgPace: { $avg: '$ratings.pace' },
                avgKnowledge: { $avg: '$ratings.knowledge' },
            }
        },
        
        // Stage 3: Populate details from other collections.
        { $lookup: { from: 'users', localField: '_id.teacher', foreignField: '_id', as: 'teacherDetails' } },
        { $lookup: { from: 'subjects', localField: '_id.subject', foreignField: '_id', as: 'subjectDetails' } },

        // Stage 4: Project the final shape of the data.
        {
            $project: {
                _id: 0,
                // FIX: Create a stable, unique ID for the DataGrid.
                id: { $concat: [ { $toString: "$_id.teacher" }, "-", { $toString: "$_id.subject" } ] },
                teacherId: '$_id.teacher',
                subjectId: '$_id.subject',
                teacherName: { $arrayElemAt: ['$teacherDetails.name', 0] },
                subjectName: { $arrayElemAt: ['$subjectDetails.name', 0] },
                feedbackCount: 1,
                // Project the individual average ratings.
                averageRatings: {
                    clarity: { $round: ['$avgClarity', 2] },
                    engagement: { $round: ['$avgEngagement', 2] },
                    pace: { $round: ['$avgPace', 2] },
                    knowledge: { $round: ['$avgKnowledge', 2] },
                }
            }
        },
        { $sort: { feedbackCount: -1 } }
    ]);
    res.status(200).json(summary);
});



// admin.controller.js

/**
 * @desc    Get a detailed report for a specific teacher
 * @route   GET /api/admin/reports/teacher/:teacherId
 * @access  Private/Admin_HOD
 */
export const getTeacherReport = asyncHandler(async (req, res) => {
    const { teacherId } = req.params;
    const { subjectId, semester } = req.query; // Optional filters

    const matchQuery = { teacher: new mongoose.Types.ObjectId(teacherId) };
    if (subjectId) matchQuery.subject = new mongoose.Types.ObjectId(subjectId);
    if (semester) matchQuery.semester = parseInt(semester, 10);

    // 1. Aggregate attendance data for the teacher
    const attendancePromise = ClassSession.aggregate([
        { $match: matchQuery },
        { $unwind: '$attendanceRecords' },
        {
            $group: {
                _id: '$subject',
                totalSessions: { $addToSet: '$_id' }, // Count unique sessions
                totalStudents: { $sum: 1 },
                presentStudents: { $sum: { $cond: [{ $eq: ['$attendanceRecords.status', true] }, 1, 0] } }
            }
        },
        { $lookup: { from: 'subjects', localField: '_id', foreignField: '_id', as: 'subjectDetails' } },
        {
            $project: {
                _id: 0,
                subjectId: '$_id',
                subjectName: { $arrayElemAt: ['$subjectDetails.name', 0] },
                sessionCount: { $size: '$totalSessions' },
                attendancePercentage: { $round: [{ $multiply: [{ $divide: ['$presentStudents', '$totalStudents'] }, 100] }, 2] }
            }
        }
    ]);

    // 2. Aggregate feedback data for the teacher
    const feedbackPromise = Feedback.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: '$subject',
                feedbackCount: { $sum: 1 },
                avgClarity: { $avg: '$ratings.clarity' },
                avgEngagement: { $avg: '$ratings.engagement' },
            }
        },
        { $lookup: { from: 'subjects', localField: '_id', foreignField: '_id', as: 'subjectDetails' } },
        {
            $project: {
                _id: 0,
                subjectId: '$_id',
                feedbackCount: 1,
                avgClarity: { $round: ['$avgClarity', 2] },
                avgEngagement: { $round: ['$avgEngagement', 2] }
            }
        }
    ]);
    
    // 3. Get Teacher's own details
    const teacherDetailsPromise = User.findById(teacherId).select('name staffId department');

    const [attendance, feedback, teacher] = await Promise.all([attendancePromise, feedbackPromise, teacherDetailsPromise]);

    res.status(200).json({ teacher, attendance, feedback });
});


/**
 * @desc    Get a detailed attendance report for a specific student
 * @route   GET /api/admin/reports/student/:studentId
 * @access  Private/Admin_HOD
 */
export const getStudentReport = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const studentObjectId = new mongoose.Types.ObjectId(studentId);

    // 1. Get student's details
    const studentDetailsPromise = User.findById(studentObjectId).select('name studentDetails');

    // 2. Aggregate the student's attendance across all their classes
    const attendancePromise = ClassSession.aggregate([
        { $match: { 'attendanceRecords.student': studentObjectId } },
        { $unwind: '$attendanceRecords' },
        { $match: { 'attendanceRecords.student': studentObjectId } },
        {
            $group: {
                _id: '$subject',
                totalClasses: { $sum: 1 },
                attendedClasses: { $sum: { $cond: [{ $eq: ['$attendanceRecords.status', true] }, 1, 0] } }
            }
        },
        { $lookup: { from: 'subjects', localField: '_id', foreignField: '_id', as: 'subjectDetails' } },
        {
            $project: {
                _id: 0,
                subjectId: '$_id',
                subjectName: { $arrayElemAt: ['$subjectDetails.name', 0] },
                totalClasses: 1,
                attendedClasses: 1,
                attendancePercentage: { $round: [{ $multiply: [{ $divide: ['$attendedClasses', '$totalClasses'] }, 100] }, 2] }
            }
        },
        { $sort: { attendancePercentage: 1 } }
    ]);

    const [student, attendance] = await Promise.all([studentDetailsPromise, attendancePromise]);

    if (!student) {
        res.status(404);
        throw new Error('Student not found');
    }

    res.status(200).json({ student, attendance });
});