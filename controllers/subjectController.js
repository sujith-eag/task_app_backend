import Subject from '../models/subjectModel.js';
import User from '../models/userModel.js';
import asyncHandler from 'express-async-handler';

// @desc    Create a new subject
// @route   POST /api/admin/subjects
// @access  Private/Admin
export const createSubject = asyncHandler(async (req, res) => {
    const { name, subjectCode, semester, department } = req.body;

    // Basic validation
    if (!name || !subjectCode || !semester || !department ) {
        res.status(400);
        throw new Error('Please provide all required fields: name, subjectCode, semester, department, and teachers.');
    }
    // Check if subject code already exists
    const subjectExists = await Subject.findOne({ subjectCode });
    if (subjectExists) {
        res.status(400);
        throw new Error(`Subject with code ${subjectCode} already exists.`);
    }
    // Create the subject
    const subject = await Subject.create({
        name,
        subjectCode,
        semester,
        department,
    });

    res.status(201).json(subject);
});


// @desc    Get all subjects
// @route   GET /api/admin/subjects
// @access  Private/Admin
export const getSubjects = asyncHandler(async (req, res) => {
    const subjects = await Subject.find({});
    res.status(200).json(subjects);
});


// @desc    Get a single subject by ID
// @route   GET /api/admin/subjects/:id
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
// @route   PUT /api/admin/subjects/:id
// @access  Private/Admin
export const updateSubject = asyncHandler(async (req, res) => {
    const subject = await Subject.findById(req.params.id);

    if (!subject) {
        res.status(404);
        throw new Error('Subject not found.');
    }
 
    subject.name = req.body.name || subject.name;
    subject.subjectCode = req.body.subjectCode || subject.subjectCode;
    subject.semester = req.body.semester || subject.semester;
    subject.department = req.body.department || subject.department;

    const updatedSubject = await subject.save();
    res.status(200).json(updatedSubject);
});


// @desc    Delete a subject
// @route   DELETE /api/admin/subjects/:id
// @access  Private/Admin
export const deleteSubject = asyncHandler(async (req, res) => {
    const subject = await Subject.findById(req.params.id);

    if (!subject) {
        res.status(404);
        throw new Error('Subject not found.');
    }

    // Delete the subject
    await subject.deleteOne();
    res.status(200).json({ id: req.params.id, message: 'Subject removed successfully.' });
});
