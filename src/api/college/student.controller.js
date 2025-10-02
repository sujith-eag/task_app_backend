import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import Joi from 'joi';
import ClassSession from '../../models/classSessionModel.js';
import Feedback from '../../models/feedbackModel.js';
import { io } from '../../../server.js';

// Joi schema for marking attendance
const markAttendanceSchema = Joi.object({
    attendanceCode: Joi.string().trim().length(8).required(),
});


// Joi schema for submitting feedback
const submitFeedbackSchema = Joi.object({
    classSessionId: Joi.string().hex().length(24).required(),
    ratings: Joi.object({
        clarity: Joi.number().min(1).max(5).required(),
        engagement: Joi.number().min(1).max(5).required(),
        pace: Joi.number().min(1).max(5).required(),
        knowledge: Joi.number().min(1).max(5).required(),
    }).required(),
    positiveFeedback: Joi.string().trim().max(500).allow('').optional(),
    improvementSuggestions: Joi.string().trim().max(500).allow('').optional(),
});



// @desc    Mark attendance for a class
// @route   POST /api/student/attendance/mark
// @access  Private/Student
export const markAttendance = asyncHandler(async (req, res) => {
    // Validate input
    const { error, value } = markAttendanceSchema.validate(req.body);
    if (error) {
        res.status(400);
        throw new Error(error.details[0].message);
    }
    const { attendanceCode } = value;

    // Find the active class session with the given code
    const session = await ClassSession.findOne({
        attendanceCode,
        attendanceWindowExpires: { $gt: new Date() },
    });

    if (!session) {
        res.status(400);
        throw new Error('Invalid or expired attendance code.');
    }

    // Find the student's record in the session and check their status
    const studentRecord = session.attendanceRecords.find(
        record => record.student.toString() === req.user.id
    );

    if (!studentRecord) {
        res.status(403); // Forbidden
        throw new Error('You are not enrolled in this class session.');
    }

    if (studentRecord.status === true) {
        return res.status(200).json({ message: 'Attendance already marked.' });
    }

    studentRecord.status = true;
    await session.save(); // Save the entire session document

    
    // After saving, emit a real-time event to the specific class session's "room"
    // The room name can be based on the session ID.
    const room = `session-${session._id}`;
    io.to(room).emit('student-checked-in', { 
        student: req.user._id, 
        name: req.user.name, 
        usn: req.user.studentDetails.usn,
        status: true 
    });
    
    // // Update the student's status to present
    // await ClassSession.updateOne(
    //     { _id: session._id, 'attendanceRecords.student': req.user.id },
    //     { $set: { 'attendanceRecords.$.status': true } }
    // );

    res.status(200).json({ message: 'Attendance marked successfully!' });
});


// @desc    Submit anonymous feedback for a class session
// @route   POST /api/student/feedback
// @access  Private/Student
export const submitFeedback = asyncHandler(async (req, res) => {
    // Validate input
    const { error, value } = submitFeedbackSchema.validate(req.body);
    if (error) {
        res.status(400);
        throw new Error(error.details[0].message);
    }
    const { classSessionId, ratings, positiveFeedback, improvementSuggestions } = value;
    
    // Find the class session and check student eligibility
    const session = await ClassSession.findById(classSessionId);
    if (!session) {
        res.status(404);
        throw new Error('Class session not found.');
    }

    const studentRecord = session.attendanceRecords.find(
        record => record.student.toString() === req.user.id
    );

    if (!studentRecord) {
        res.status(403);
        throw new Error('You cannot submit feedback for a class you are not a part of.');
    }

    if (studentRecord.hasSubmittedFeedback) {
        res.status(400);
        throw new Error('You have already submitted feedback for this class.');
    }

    // Use a transaction to ensure atomicity
    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();
    try {
        // Step A: Create the anonymous feedback document
        await Feedback.create([{
            teacher: session.teacher,
            subject: session.subject,
            classSession: classSessionId,
            batch: session.batch,
            semester: session.semester,
            ratings,
            positiveFeedback,
            improvementSuggestions,
        }], { session: dbSession });

        // Step B: Mark that the student has submitted feedback
        await ClassSession.updateOne(
            { _id: classSessionId, 'attendanceRecords.student': req.user.id },
            { $set: { 
                'attendanceRecords.$.hasSubmittedFeedback': true,
                'attendanceRecords.$.feedbackSubmittedAt': new Date(),
                } 
            },
            { session: dbSession }
        );

        // If both operations succeed, commit the transaction
        await dbSession.commitTransaction();
        res.status(201).json({ message: 'Thank you! Your feedback has been submitted anonymously.' });

    } catch (transactionError) {
        // If any operation fails, abort the transaction
        await dbSession.abortTransaction();
        throw new Error('Could not submit feedback. Please try again.');
    } finally {
        // End the session
        dbSession.endSession();
    }
});


// @desc    Get dashboard stats (attendance per subject) for the logged-in student
// @route   GET /api/v1/student/dashboard-stats
// @access  Private/Student
export const getStudentDashboardStats = asyncHandler(async (req, res) => {
    // The explicit creation of a new ObjectId is no longer necessary.
    // Mongoose will automatically cast the string req.user.id in the query.
    
    const stats = await ClassSession.aggregate([
        // Stage 1: Find all sessions where the student's ID is in the attendance array
        { $match: { 'attendanceRecords.student': req.user._id } },
        // Stage 2: Unwind the records to process each student individually
        { $unwind: '$attendanceRecords' },
        // Stage 3: Match only the records for the current student
        { $match: { 'attendanceRecords.student': req.user._id } },
        // Stage 4: Group by subject to calculate stats
        {
            $group: {
                _id: '$subject',
                totalClasses: { $sum: 1 },
                attendedClasses: {
                    $sum: { $cond: [{ $eq: ['$attendanceRecords.status', true] }, 1, 0] }
                }
            }
        },
        // Stage 5: Lookup subject details for more info
        {
            $lookup: {
                from: 'subjects',
                localField: '_id',
                foreignField: '_id',
                as: 'subjectDetails'
            }
        },
        // Stage 6: Project the final, user-friendly shape
        {
            $project: {
                _id: 0,
                subjectId: '$_id',
                subjectName: { $arrayElemAt: ['$subjectDetails.name', 0] },
                subjectCode: { $arrayElemAt: ['$subjectDetails.subjectCode', 0] },
                totalClasses: '$totalClasses',
                attendedClasses: '$attendedClasses',
                attendancePercentage: {
                    $round: [ // Using $round for a cleaner percentage value
                        { $multiply: [{ $divide: ['$attendedClasses', '$totalClasses'] }, 100] },
                        2 // Round to 2 decimal places
                    ]
                }
            }
        }
    ]);

    res.status(200).json(stats);
});




// @desc    Get past sessions that a student can submit feedback for
// @route   GET /api/college/students/sessions-for-feedback
// @access  Private/Student
export const getSessionsForFeedback = asyncHandler(async (req, res) => {
    const studentId = req.user._id;

    const sessions = await ClassSession.find({
        // Use $elemMatch to find documents where at least one element in the 
        // attendanceRecords array matches all the specified conditions.
        attendanceRecords: {
            $elemMatch: {
                student: studentId,
                status: true, // The student must have been present
                hasSubmittedFeedback: false // And not yet submitted feedback
            }
        }
    })
    .sort({ startTime: -1 }) // Show the most recent classes first
    .populate('subject', 'name subjectCode') // Populate subject details needed for the UI
    .populate('teacher', 'name'); // Populate teacher's name needed for the UI

    res.status(200).json(sessions);
});
