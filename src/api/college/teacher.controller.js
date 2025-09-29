import asyncHandler from 'express-async-handler';
import Joi from 'joi';
import User from '../../models/userModel.js';
import ClassSession from '../../models/classSessionModel.js';

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
    section: Joi.string().valid('A', 'B').required(),
});


// @desc    Get data needed for the class creation form (teacher's subjects)
// @route   GET /api/teacher/class-creation-data
// @access  Private/Teacher
export const getClassCreationData = asyncHandler(async (req, res) => {
    const teacher = await User.findById(req.user.id).populate({
        path: 'teacherDetails.assignments.subject',
        select: 'name subjectCode semester'
    });

    if (!teacher || !teacher.teacherDetails) {
        res.status(404);
        throw new Error('Teacher profile not found.');
    }

    res.status(200).json({
        subjects: teacher.teacherDetails.assignments,
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
    const populatedSession = await ClassSession.findById(classSession._id).populate('subject', 'name subjectCode');

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


// @desc    Get a history of class sessions for the logged-in teacher
// @route   GET /api/teacher/class-sessions
// @access  Private/Teacher
export const getTeacherSessionsHistory = asyncHandler(async (req, res) => {
    const sessions = await ClassSession.find({ teacher: req.user.id })
        .populate('subject', 'name subjectCode')
        .sort({ startTime: -1 }) // Most recent first
        .limit(15); // Or use query params for pagination

    res.status(200).json(sessions);
});