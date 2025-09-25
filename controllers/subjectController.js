import Subject from '../models/subjectModel.js';
import User from '../models/userModel.js';
import asyncHandler from 'express-async-handler';

// @desc    Create a new subject
// @route   POST /api/v1/subjects
// @access  Private/Admin
export const createSubject = asyncHandler(async (req, res) => {
    const { name, subjectCode, semester, department, teachers } = req.body;

    // Basic validation
    if (!name || !subjectCode || !semester || !department || !teachers) {
        res.status(400);
        throw new Error('Please provide all required fields: name, subjectCode, semester, department, and teachers.');
    }

    // Check if subject code already exists
    const subjectExists = await Subject.findOne({ subjectCode });
    if (subjectExists) {
        res.status(400);
        throw new Error(`Subject with code ${subjectCode} already exists.`);
    }

    // Validate that all provided teacher IDs are valid and have the 'teacher' role
    const teacherUsers = await User.find({ _id: { $in: teachers }, role: 'teacher' });
    if (teacherUsers.length !== teachers.length) {
        res.status(400);
        throw new Error('One or more provided IDs are not valid teachers.');
    }

    // Create the subject
    const subject = await Subject.create({
        name,
        subjectCode,
        semester,
        department,
        teachers,
    });

    // Update the `subjectsTaught` array for each assigned teacher
    await User.updateMany(
        { _id: { $in: teachers } },
        { $addToSet: { 'teacherDetails.subjectsTaught': subject._id } }
    );

    res.status(201).json(subject);
});


// @desc    Get all subjects
// @route   GET /api/v1/subjects
// @access  Private/Admin
export const getSubjects = asyncHandler(async (req, res) => {
    const subjects = await Subject.find({}).populate('teachers', 'name email');
    res.status(200).json(subjects);
});


// @desc    Get a single subject by ID
// @route   GET /api/v1/subjects/:id
// @access  Private/Admin
export const getSubjectById = asyncHandler(async (req, res) => {
    const subject = await Subject.findById(req.params.id).populate('teachers', 'name email');

    if (subject) {
        res.status(200).json(subject);
    } else {
        res.status(404);
        throw new Error('Subject not found.');
    }
});


// @desc    Update a subject
// @route   PUT /api/v1/subjects/:id
// @access  Private/Admin
export const updateSubject = asyncHandler(async (req, res) => {
    const subject = await Subject.findById(req.params.id);

    if (!subject) {
        res.status(404);
        throw new Error('Subject not found.');
    }
    
    // Note: A more complex implementation could handle adding/removing teachers
    // from their respective `subjectsTaught` arrays. For simplicity, this update
    // focuses on the subject model. The teachers array can be managed via this endpoint.

    subject.name = req.body.name || subject.name;
    subject.subjectCode = req.body.subjectCode || subject.subjectCode;
    subject.semester = req.body.semester || subject.semester;
    subject.department = req.body.department || subject.department;
    subject.teachers = req.body.teachers || subject.teachers;

    const updatedSubject = await subject.save();
    res.status(200).json(updatedSubject);
});


// @desc    Delete a subject
// @route   DELETE /api/v1/subjects/:id
// @access  Private/Admin
export const deleteSubject = asyncHandler(async (req, res) => {
    const subject = await Subject.findById(req.params.id);

    if (!subject) {
        res.status(404);
        throw new Error('Subject not found.');
    }

    // Before deleting the subject, remove its reference from all assigned teachers
    await User.updateMany(
        { _id: { $in: subject.teachers } },
        { $pull: { 'teacherDetails.subjectsTaught': subject._id } }
    );

    // Delete the subject
    await subject.deleteOne();

    res.status(200).json({ message: 'Subject removed successfully.' });
});
