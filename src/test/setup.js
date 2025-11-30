/**
 * Jest Global Setup
 * Sets up MongoDB Memory Server and test environment
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('TestSetup');

let mongoServer;

/**
 * Setup MongoDB Memory Server before all tests
 */
beforeAll(async () => {
  logger.info('Starting MongoDB Memory Server...');
  
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Set environment variables for tests
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing';
  process.env.FRONTEND_URL = 'http://localhost:5173';
  
  // Connect to in-memory database
  await mongoose.connect(mongoUri);
  
  logger.success('MongoDB Memory Server started', { uri: mongoUri });
});

/**
 * Clean up database between tests
 */
afterEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
});

/**
 * Cleanup after all tests
 */
afterAll(async () => {
  logger.info('Cleaning up test environment...');
  
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  
  if (mongoServer) {
    await mongoServer.stop();
  }
  
  logger.success('Test environment cleaned up');
});

/**
 * Silence console during tests unless DEBUG=true
 */
if (process.env.DEBUG !== 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    // Keep error and warn for debugging failed tests
    error: console.error,
    warn: console.warn,
  };
}
