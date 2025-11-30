/**
 * Test Utilities
 * Helper functions for testing
 */

import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import User from '../models/userModel.js';
import Subject from '../models/subjectModel.js';

// ============================================================================
// User Factories
// ============================================================================

/**
 * Create a test admin user
 */
export const createTestAdmin = async (overrides = {}) => {
  const defaultData = {
    name: 'Test Admin',
    email: `admin-${Date.now()}@test.com`,
    password: 'hashedpassword123',
    isVerified: true,
    roles: ['admin'],
  };

  const user = await User.create({ ...defaultData, ...overrides });
  return user;
};

/**
 * Create a test teacher user
 */
export const createTestTeacher = async (overrides = {}) => {
  const defaultData = {
    name: 'Test Teacher',
    email: `teacher-${Date.now()}@test.com`,
    password: 'hashedpassword123',
    isVerified: true,
    roles: ['teacher'],
    teacherDetails: {
      staffId: `STAFF-${Date.now()}`,
      department: 'Computer Science',
      assignments: [],
    },
  };

  const user = await User.create({ ...defaultData, ...overrides });
  return user;
};

/**
 * Create a test student user
 */
export const createTestStudent = async (overrides = {}) => {
  const defaultData = {
    name: 'Test Student',
    email: `student-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
    password: 'hashedpassword123',
    isVerified: true,
    roles: ['student'],
    studentDetails: {
      usn: `USN-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      batch: 2024,
      section: 'A',
      semester: 3, // Valid range for subjects: 1-4
      applicationStatus: 'approved',
      isStudentVerified: true,
      enrolledSubjects: [],
    },
  };

  const user = await User.create({ ...defaultData, ...overrides });
  return user;
};

/**
 * Create a pending student application
 */
export const createPendingApplication = async (overrides = {}) => {
  const defaultData = {
    name: 'Pending Student',
    email: `pending-${Date.now()}@test.com`,
    password: 'hashedpassword123',
    isVerified: true,
    roles: ['user'],
    studentDetails: {
      usn: `USN-${Date.now()}`,
      batch: 2024,
      section: 'A',
      semester: 5,
      applicationStatus: 'pending',
      isStudentVerified: false,
    },
  };

  const user = await User.create({ ...defaultData, ...overrides });
  return user;
};

/**
 * Create a basic user (no special role)
 * Accepts `role` as shorthand which gets converted to `roles` array
 */
export const createTestUser = async (overrides = {}) => {
  // Handle role shorthand
  if (overrides.role && !overrides.roles) {
    overrides.roles = [overrides.role];
    delete overrides.role;
  }

  const defaultData = {
    name: 'Test User',
    email: `user-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
    password: 'hashedpassword123',
    isVerified: true,
    roles: ['user'],
  };

  // Add teacherDetails for teacher/hod roles
  if (overrides.roles?.includes('teacher') || overrides.roles?.includes('hod')) {
    if (!overrides.teacherDetails) {
      overrides.teacherDetails = {
        staffId: `STAFF-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        department: 'Computer Science',
        assignments: [],
      };
    }
  }

  // Add studentDetails for student role
  if (overrides.roles?.includes('student')) {
    if (!overrides.studentDetails) {
      overrides.studentDetails = {
        usn: `USN-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        batch: 2024,
        section: 'A',
        semester: 3, // Valid range for subjects: 1-4
        applicationStatus: 'approved',
        isStudentVerified: true,
        enrolledSubjects: [],
      };
    }
  }

  const user = await User.create({ ...defaultData, ...overrides });
  return user;
};

// ============================================================================
// Subject Factories
// ============================================================================

/**
 * Create a test subject
 */
export const createTestSubject = async (overrides = {}) => {
  const defaultData = {
    name: `Test Subject ${Date.now()}`,
    subjectCode: `SUB-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    semester: 3, // Valid range: 1-4
    department: 'Computer Science',
  };

  const subject = await Subject.create({ ...defaultData, ...overrides });
  return subject;
};

// ============================================================================
// Authentication Helpers
// ============================================================================

/**
 * Generate a valid JWT token for a user
 */
export const generateTestToken = (user, expiresIn = '1h') => {
  return jwt.sign(
    { 
      id: user._id.toString(),
      email: user.email,
      roles: user.roles,
    },
    process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing',
    { expiresIn }
  );
};

/**
 * Generate auth cookie for supertest
 */
export const getAuthCookie = (user) => {
  const token = generateTestToken(user);
  return `accessToken=${token}`;
};

/**
 * Create authenticated request helper
 */
export const authRequest = (request, user) => {
  const token = generateTestToken(user);
  return request.set('Cookie', `accessToken=${token}`);
};

// ============================================================================
// Mock Helpers
// ============================================================================

/**
 * Create a mock request object
 */
export const createMockRequest = (overrides = {}) => ({
  params: {},
  query: {},
  body: {},
  user: null,
  headers: {},
  cookies: {},
  ip: '127.0.0.1',
  ...overrides,
});

/**
 * Create a mock response object
 */
export const createMockResponse = () => {
  const res = {
    statusCode: 200,
    jsonData: null,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockImplementation((data) => {
      res.jsonData = data;
      return res;
    }),
    send: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
  };
  return res;
};

/**
 * Create a mock next function
 */
export const createMockNext = () => jest.fn();

// ============================================================================
// Database Helpers
// ============================================================================

/**
 * Clean a specific collection
 */
export const cleanCollection = async (modelName) => {
  const Model = mongoose.model(modelName);
  await Model.deleteMany({});
};

/**
 * Clean all collections
 */
export const cleanDatabase = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
};

/**
 * Generate a valid MongoDB ObjectId
 */
export const generateObjectId = () => new mongoose.Types.ObjectId();

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert response structure
 */
export const assertSuccessResponse = (response, statusCode = 200) => {
  expect(response.status).toBe(statusCode);
  expect(response.body).toHaveProperty('success', true);
};

/**
 * Assert error response structure
 */
export const assertErrorResponse = (response, statusCode, messagePattern = null) => {
  expect(response.status).toBe(statusCode);
  expect(response.body).toHaveProperty('message');
  if (messagePattern) {
    expect(response.body.message).toMatch(messagePattern);
  }
};

/**
 * Assert pagination structure
 */
export const assertPaginatedResponse = (response) => {
  expect(response.body).toHaveProperty('data');
  expect(Array.isArray(response.body.data)).toBe(true);
};

export default {
  // Factories
  createTestAdmin,
  createTestTeacher,
  createTestStudent,
  createPendingApplication,
  createTestUser,
  createTestSubject,
  
  // Auth helpers
  generateTestToken,
  getAuthCookie,
  authRequest,
  
  // Mock helpers
  createMockRequest,
  createMockResponse,
  createMockNext,
  
  // DB helpers
  cleanCollection,
  cleanDatabase,
  generateObjectId,
  
  // Assertion helpers
  assertSuccessResponse,
  assertErrorResponse,
  assertPaginatedResponse,
};
