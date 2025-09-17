import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Joi from 'joi';

import User from '../models/userModel.js';

// JWT Helper Functio
const generateJWTtoken = (id) => {
    return jwt.sign( { id }, process.env.JWT_SECRET, 
            { expiresIn: '3d' });
    }

// Joi Schema for registration data
const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().pattern(
      new RegExp(
        '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$'
      )).required(),
});


const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});





// @desc    Register a new user
// @route   POST /api/users
// @access  Public
export const registerUser = asyncHandler(async (req, res) => {
    
    // Validate first
    const { error, value } = registerSchema.validate(req.body);
    if(error){
        console.error('Joi Validation Error:', error.details);
        res.status(400);
        throw new Error(error.details[0].message);
        // throw new Error ('Invalid input data');
    }
    
    const { name, email, password } = value;
    // Checking for existing user
    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('Unable to register user'); // Not revealing user exists
    }
    // Hashing Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
        name,
        email,
        password: hashedPassword
    });

    if (user) {
        res.status(201).json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            bio: user.bio,
            preferences: user.preferences,
            token: generateJWTtoken(user._id)
        });
    } else {
        res.status(400);
        throw new Error('Unable to register user');
    }
});



// @desc    Authenticate a user
// @route   POST /api/users/login
// @access  Public
export const loginUser = asyncHandler(async (req, res) => {

    const { error, value } = loginSchema.validate(req.body);
        if (error) {
            res.status(400);
            throw new Error('Invalid credentials');
        }
        
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            bio: user.bio,
            preferences: user.preferences,
            token: generateJWTtoken(user._id)
        });
    } else {
        res.status(400);
        throw new Error('Invalid credentials');
    }
});

