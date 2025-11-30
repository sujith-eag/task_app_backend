/**
 * Test Application
 * Express app configured for testing without starting the server
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import mountRoutes from '../routes/index.js';
import errorHandler from '../api/_common/middleware/error.middleware.js';

/**
 * Create a test application instance
 * This is the same as the main app but without server listening
 */
export const createTestApp = () => {
  const app = express();

  // Core middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  // Mount routes
  mountRoutes(app);

  // Error handler
  app.use(errorHandler);

  return app;
};

export default createTestApp;
