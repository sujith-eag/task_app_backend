import asyncHandler from 'express-async-handler';
import Joi from 'joi';
import mongoose from 'mongoose';

import User from '../../models/userModel.js';
import ClassSession from '../../models/classSessionModel.js';
import TeacherSessionReflection from '../../models/teacherSessionReflectionModel.js';
import Feedback from '../../models/feedbackModel.js'

// --- Helper Function ---
const generateAttendanceCode = () => {
    // Generates a random 8-digit number as a string
    return Math.floor(10000000 + Math.random() * 90000000).toString();
};


// Joi schema for creating a class session
const createSessionSchema = Joi.object({
    subject: Joi.string().hex().length(24).required(), // MongoDB ObjectId validation
    type: Joi.string().valid('Theory', 'Lab').required(),
    batch: Joi.number().integer().required(),
    semester: Joi.number().integer().required(),
    section: Joi.string().valid('A', 'B', 'C').required(),
});

const reflectionSchema = Joi.object({
    classSessionId: Joi.string().hex().length(24).required(),
    selfAssessment: Joi.object({
        effectiveness: Joi.number().min(1).max(5).required(),
        studentEngagement: Joi.number().min(1).max(5).required(),
        pace: Joi.string().valid('Too Slow', 'Just Right', 'Too Fast').required(),
    }).required(),
    sessionHighlights: Joi.string().trim().max(500).required(),
    challengesFaced: Joi.string().trim().max(500).allow('').optional(),
    improvementsForNextSession: Joi.string().trim().max(500).allow('').optional(),
});


/**
 * Get teacher's class creation data (assigned subjects)
 * Also allows admins to get all subjects for sharing purposes
 * @desc    Get data needed for the class creation form (teacher's subjects)
 * @route GET /api/college/teachers/class-creation-data
 * @access Private (Teacher or Admin)
 */
export const getClassCreationData = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).populate({
        path: 'teacherDetails.assignments.subject',
        select: 'name subjectCode semester'
    });

    if (!user) {
        res.status(404);
        throw new Error('User not found.');
    }

    // For admins, return all subjects (they can share with any class)
    if (user.roles.includes('admin')) {
        const Subject = (await import('../../models/subjectModel.js')).default;
        const allSubjects = await Subject.find({}).select('name subjectCode semester');
        
        // Transform subjects into assignment-like structure for consistency
        const assignments = allSubjects.map(subject => ({
            subject: {
                _id: subject._id,
                name: subject.name,
                subjectCode: subject.subjectCode,
                semester: subject.semester
            }
        }));

        return res.status(200).json({ assignments });
    }

    // For teachers, return their assignments
    if (!user.teacherDetails) {
        res.status(404);
        throw new Error('Teacher profile not found.');
    }

    res.status(200).json({
        assignments: user.teacherDetails.assignments,
    });
});


// @desc    Create a new class session
// @route   POST /api/teacher/class-sessions
// @access  Private/Teacher
export const createClassSession = asyncHandler(async (req, res) => {
    // Validate request body
    const { error, value } = createSessionSchema.validate(req.body);
    if (error) {
        res.status(400);
        throw new Error(error.details[0].message);
    }
    const { subject, type, batch, semester, section } = value;

    const teacher = await User.findById(req.user.id);

    // Security Check: Verify the teacher has a matching and complete assignment.
    const isAssigned = teacher.teacherDetails.assignments.some(
        assignment =>
            assignment.subject.toString() === subject &&
            assignment.batch === batch &&
            assignment.semester === semester &&
            assignment.sections.includes(section)
    );

    if (!isAssigned) {
        res.status(403); // Forbidden
        throw new Error('You are not assigned to teach this subject for the specified batch, semester, and section.');
    }

    // Fetch the student roster for the class
    const students = await User.find({
        role: 'student',
        'studentDetails.batch': batch,
        'studentDetails.semester': semester,
        'studentDetails.section': section,
        'studentDetails.isStudentVerified': true,
    }).select('_id');

    if (students.length === 0) {
        res.status(404);
        throw new Error('No verified students found for the selected class criteria.');
    }

    // Prepare attendance records
    const attendanceRecords = students.map(student => ({
        student: student._id,
        status: false, // Default to absent
        hasSubmittedFeedback: false,
    }));

    // Create the session
    const classSession = await ClassSession.create({
        subject,
        teacher: req.user.id,
        type,
        batch,
        semester,
        section,
        attendanceCode: generateAttendanceCode(),
        attendanceWindowExpires: new Date(Date.now() + 60 * 1000), // 60-second window
        attendanceRecords,
    });
    
    // Populate subject details for the response
    const populatedSession = await ClassSession.findById(classSession._id)
        .populate('subject', 'name subjectCode')
        .populate('attendanceRecords.student', 'name studentDetails.usn');
    // Select entire 'studentDetails' object.
    //     .populate('attendanceRecords.student', 'name studentDetails');
            
    res.status(201).json(populatedSession);
});


// @desc    Get the roster for a specific class session
// @route   GET /api/teacher/class-sessions/:sessionId/roster
// @access  Private/Teacher
export const getSessionRoster = asyncHandler(async (req, res) => {
    const session = await ClassSession.findById(req.params.sessionId)
        .populate('attendanceRecords.student', 'name studentDetails.usn avatar');

    if (!session) {
        res.status(404);
        throw new Error('Class session not found.');
    }

    // Authorization: Ensure the requesting teacher owns this session
    if (session.teacher.toString() !== req.user.id) {
        res.status(403);
        throw new Error('You are not authorized to view this session.');
    }

    res.status(200).json(session.attendanceRecords);
});


// @desc    Manually update and finalize attendance for a session
// @route   PATCH /api/teacher/class-sessions/:sessionId/roster
// @access  Private/Teacher
export const finalizeAttendance = asyncHandler(async (req, res) => {
    const { updatedRoster } = req.body; // Expects an array: [{ studentId: "...", status: true/false }]

    const session = await ClassSession.findById(req.params.sessionId);

    if (!session) {
        res.status(404);
        throw new Error('Class session not found.');
    }

    // Authorization: Ensure the requesting teacher owns this session
    if (session.teacher.toString() !== req.user.id) {
        res.status(403);
        throw new Error('You are not authorized to modify this session.');
    }

    // Update the status for each student in the provided roster
    updatedRoster.forEach(update => {
        const record = session.attendanceRecords.find(
            rec => rec.student.toString() === update.studentId
        );
        if (record) {
            record.status = update.status;
        }
    });

    await session.save();

    res.status(200).json({ message: 'Attendance has been finalized.' });
});


/**
 * @desc    Get a history of class sessions for the logged-in teacher
 * @route   GET /api/college/teachers/class-sessions
 * @access  Private/Teacher
 */
export const getTeacherSessionsHistory = asyncHandler(async (req, res) => {
    // Fetch teacher's recent sessions
    const sessions = await ClassSession.find({ teacher: req.user.id })
        .populate('subject', 'name subjectCode')
        .sort({ startTime: -1 }) // Most recent first
        .limit(15) // Or use query params for pagination
        .lean(); // Use .lean() for faster processing of plain JS objects

    // Get all session IDs to check for existing reflections
    const sessionIds = sessions.map(s => s._id);

    // Find all reflections that match these session IDs in a single query
    const reflections = await TeacherSessionReflection.find({
        classSession: { $in: sessionIds }
    }).select('classSession'); // Only need the ID for checking existence

    // Create a Set of session IDs that have a reflection for quick lookup
    const sessionsWithReflection = new Set(
        reflections.map(r => r.classSession.toString())
    );

    // Map over the original sessions to add the 'hasReflection' flag
    const sessionsWithMetadata = sessions.map(session => ({
        ...session,
        hasReflection: sessionsWithReflection.has(session._id.toString())
    }));

    res.status(200).json(sessionsWithMetadata);
});


/**
 * @desc    Create or update a reflection for a class session (Upsert)
 * @route   PUT /api/college/teachers/session-reflection
 * @access  Private/Teacher
 */
export const upsertSessionReflection = asyncHandler(async (req, res) => {
    const { error, value } = reflectionSchema.validate(req.body);
    if (error) {
        res.status(400);
        throw new Error(error.details[0].message);
    }
    const { classSessionId, ...reflectionData } = value;

    const session = await ClassSession.findById(classSessionId);
    if (!session) {
        res.status(404);
        throw new Error('Class session not found.');
    }

    // Authorization: Ensuring logged-in user is the teacher who taught the class
    if (session.teacher.toString() !== req.user.id) {
        res.status(403); // Forbidden
        throw new Error('You are not authorized to submit a reflection for this session.');
    }

    // Use findOneAndUpdate with upsert: true
    const updatedReflection = await TeacherSessionReflection.findOneAndUpdate(
        { classSession: classSessionId, teacher: req.user.id }, // Find by this query
        { $set: reflectionData }, // Apply this update
        { 
            new: true, // Return the new or updated document
            upsert: true, // Create the document if it doesn't exist
            runValidators: true // Ensure schema validation runs on update
        }
    );

    res.status(200).json(updatedReflection);
});


// @desc    Get an anonymized feedback summary for a specific session
// @route   GET /api/college/teachers/feedback-summary/:classSessionId
// @access  Private/Teacher
export const getFeedbackSummaryForSession = asyncHandler(async (req, res) => {
    const { classSessionId } = req.params;

    // Authorization: Ensure the teacher requesting is the one who taught the session
    const session = await ClassSession.findById(classSessionId);
    if (!session) {
        res.status(404);
        throw new Error('Class session not found.');
    }
    if (session.teacher.toString() !== req.user.id) {
        res.status(403);
        throw new Error('You are not authorized to view feedback for this session.');
    }

    // Aggregate student feedback (similar to admin, but we won't return comments)
    const studentFeedbackPromise = Feedback.aggregate([
        { $match: { classSession: new mongoose.Types.ObjectId(classSessionId) } },
        {
            $group: {
                _id: '$classSession',
                feedbackCount: { $sum: 1 },
                avgClarity: { $avg: '$ratings.clarity' },
                avgEngagement: { $avg: '$ratings.engagement' },
                avgPace: { $avg: '$ratings.pace' },
                avgKnowledge: { $avg: '$ratings.knowledge' },
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
                }
            }
        }
    ]);

    // Fetch Teacher's own reflection
    const teacherReflectionPromise = TeacherSessionReflection.findOne({ classSession: classSessionId });
    
    const [studentFeedback, teacherReflection] = await Promise.all([
        studentFeedbackPromise,
        teacherReflectionPromise
    ]);

    res.status(200).json({
        studentFeedbackSummary: studentFeedback[0] || { feedbackCount: 0, averageRatings: {} },
        teacherReflection: teacherReflection || null,
    });
});