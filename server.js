import express from 'express';
import 'dotenv/config'; // auto-runs dotenv.config()
// import dotenv from 'dotenv'; // dotenv.config();

import helmet from 'helmet'; // Security headers
import morgan from 'morgan'; // Request logger
import cors from 'cors';
import http from 'http';

import { Server } from 'socket.io';
import { socketAuthMiddleware } from './src/middleware/auth.middleware.js';
import { handleConnection } from './src/api/chat/chat.controller.js';
import { handleAttendanceConnection } from './src/api/college/attendence.socket.js';

import adminRoutes from './src/api/admin/admin.routes.js';
import aiRoutes from './src/api/ai/ai.routes.js';
import authRoutes from './src/api/auth/auth.routes.js';
import conversationRoutes from './src/api/chat/conversation.routes.js';

// File Routes
import deleteFileRoutes from './src/api/files/routes/delete.routes.js';
import downloadFileRoutes from './src/api/files/routes/download.routes.js';
import itemFileRoutes from './src/api/files/routes/item.routes.js';
import shareFileRoutes from './src/api/files/routes/share.routes.js';
import uploadFileRoutes from './src/api/files/routes/upload.routes.js';
import folderRoutes from './src/api/files/folder.routes.js';
import publicFileRoutes from './src/api/files/public.routes.js';
import academicFileRoutes from './src/api/files/academicFile.routes.js';

import studentRoutes from './src/api/college/student.routes.js';
import subjectRoutes from './src/api/college/subject.routes.js';
import taskRoutes from './src/api/tasks/task.routes.js';
import teacherRoutes from './src/api/college/teacher.routes.js';
import userRoutes from './src/api/user/user.routes.js';

import errorHandler from './src/middleware/error.middleware.js';
import connectDB from './src/connect/database.js';


// --- Initial Setup ---
const app = express();
const server = http.createServer(app); // http server from the app

// Connect DB with error handling
connectDB()
  .then( ()=> console.log('MongoDB connected'))
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
    },
});

export { io }; // Export for use in controllers

// Use authentication middleware for all incoming connections
io.use(socketAuthMiddleware);

// Main connection handler
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.name} (Socket ID: ${socket.id})`);

  // Delegate to the chat handler
  handleConnection(socket, io);

  // Delegate to the attendance handler
  handleAttendanceConnection(socket); 
});

// --- Core Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors({ origin: allowedOrigins }));

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
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/chat', conversationRoutes);  // For RESTful chat actions

// File Routes
app.use('/api/files/items', itemFileRoutes);
app.use('/api/files/uploads', uploadFileRoutes);
app.use('/api/files/downloads', downloadFileRoutes);
app.use('/api/files/shares', shareFileRoutes);
app.use('/api/files/delete', deleteFileRoutes);

// Public and Academic
app.use('/api/public/files', publicFileRoutes);       // For public access (e.g., POST /api/public/download)
app.use('/api/college/files', academicFileRoutes); // For academic file sharing (e.g., POST /api/college/files/:id/share-class)

app.use('/api/folders', folderRoutes);

// College routes
app.use('/api/college/students', studentRoutes);
app.use('/api/college/subjects', subjectRoutes);
app.use('/api/college/teachers', teacherRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes); // For user profile actions


// --- 404 for undefined routes ---
app.use((req, res, next) => {
  res.status(404).json({ message: 'Route not found' });
});

// --- Error Handling Middleware ---
app.use(errorHandler);

// --- Server Start ---
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(
    `Server listening on ${PORT}`
  ));
