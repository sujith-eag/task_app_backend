import express from 'express';
import 'dotenv/config'; // auto-runs dotenv.config()
// import dotenv from 'dotenv'; // dotenv.config();

import helmet from 'helmet'; // Security headers
import morgan from 'morgan'; // Request logger
import cors from 'cors';
import cookieParser from 'cookie-parser';
import http from 'http';

import { Server } from 'socket.io';
import { socketAuthMiddleware } from './src/api/_common/middleware/auth.middleware.js';
import sessionRegistry from './src/api/_common/socket/sessionRegistry.js';
import { handleConnection } from './src/api/chat/socket/chat.socket.js';
import { handleAttendanceConnection } from './src/api/college/attendence.socket.js';

import mountRoutes from './src/routes/index.js';
import errorHandler from './src/api/_common/middleware/error.middleware.js';
import connectDB from './src/connect/database.js';


// --- Initial Setup ---
const app = express();
const server = http.createServer(app); // http server from the app

// Connect DB with error handling
connectDB()
  .then(async () => {
    console.log('MongoDB connected');

    // Run one-off migration for stage 1 if not already applied.
    try {
      // Import dynamically to avoid top-level startup costs when not needed
      const { default: migrateFn } = await import('./scripts/migrate_files_stage1.js');
      // Our migration script exports `migrate` as default — run in apply mode once
      // Use a run-once name so it will not run repeatedly
      await migrateFn({ apply: true, runOnceName: 'files_stage_1' });
    } catch (e) {
      // If migration script isn't present or fails, log but continue server startup
      console.error('Migration run failed or skipped:', e.message || e);
    }
  })
  .catch((err)=>{
    console.error('DB connection error:', err);
    process.exit(1);
  });

// Tells Express to trust the first hop from the proxy server, 
// which is standard for platforms like Render, Heroku, etc.
app.set('trust proxy', 1);


// --- Array of allowed origins ---
const allowedOrigins = [
    process.env.FRONTEND_URL,    // Your production URL
    'http://localhost:5173'     // Your local development URL
];
// Initializing Socket.IO with CORS configured for allowed origins
const io = new Server(server, {
  cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
    },
});

export { io }; // Export for use in controllers

// Use authentication middleware for all incoming connections
io.use(socketAuthMiddleware);

// Attach io instance to sessionRegistry so registry can actively disconnect sockets on revoke
try { sessionRegistry.attachIo(io); } catch (e) { /* ignore attach errors */ }

// Main connection handler
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.name} (Socket ID: ${socket.id})`);

  // Register socket in in-memory session registry if client provided deviceId
  try {
    const deviceId = socket.handshake?.auth?.deviceId || socket.handshake?.headers?.['x-device-id'] || 'unknown';
    sessionRegistry.registerSocket(socket.user._id?.toString(), deviceId, socket.id);
  } catch (e) {
    // ignore registry errors
  }

  // Handle disconnect to cleanup registry
  socket.on('disconnect', () => {
    try { sessionRegistry.unregisterSocket(socket.id); } catch(e){}
  });

  // Delegate to the chat handler
  handleConnection(socket, io);

  // Delegate to the attendance handler
  handleAttendanceConnection(socket);
});

// --- Core Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// Enable cookie parsing for httpOnly cookie authentication
app.use(cookieParser());

// Allow credentials (cookies) from allowed origins
// Explicitly allow some custom headers (x-device-id, x-skip-session-expired-toast)
// so browser preflight requests succeed when the frontend sets these headers.
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-device-id', 'X-Skip-Session-Expired-Toast'],
  exposedHeaders: ['Set-Cookie'],
}));

// --- Security & Logging Middleware ---
// Setting security HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: false, // allow images from other origins
  contentSecurityPolicy: false, // disable strict CSP unless you configure it
})); 


// morgan for logging in development mode
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}


// --- API Route Mounting ---
mountRoutes(app);

// --- Error Handling Middleware ---
app.use(errorHandler);

// --- Server Start ---
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(
    `Server listening on ${PORT}`
  ));
