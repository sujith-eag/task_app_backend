import express from 'express';
import 'dotenv/config'; // auto-runs dotenv.config()
// import dotenv from 'dotenv'; // dotenv.config();

import helmet from 'helmet'; // Security headers
import morgan from 'morgan'; // Request logger
import cors from 'cors';
import http from 'http';

import { Server } from 'socket.io';
import { socketAuthMiddleware } from './src/api/_common/middleware/auth.middleware.js';
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
mountRoutes(app);

// --- Error Handling Middleware ---
app.use(errorHandler);

// --- Server Start ---
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(
    `Server listening on ${PORT}`
  ));
