import express from 'express';

import 'dotenv/config'; // auto-runs dotenv.config()
// import dotenv from 'dotenv';
// dotenv.config();

import helmet from 'helmet'; // Security headers
import morgan from 'morgan'; // Request logger
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';

import { socketAuthMiddleware } from './middleware/socketAuthMiddleware.js';
import { handleConnection } from './controllers/chatController.js';
import taskRoutes from './routes/taskRoutes.js';
import userRoutes from './routes/userRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import aiTaskRoutes from './routes/aiTaskRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';

import errorHandler from './middleware/errorMiddleware.js';
import connectDB from './connect/database.js';

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

    
// Initializing Socket.IO with CORS configured for frontend
const io = new Server(server, {
  cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    },
});


// Use authentication middleware for all incoming connections
io.use(socketAuthMiddleware);

// Main connection handler
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.name} (Socket ID: ${socket.id})`);
  handleConnection(socket, io);
});
  
// --- Core Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

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

// --- API Routes ---
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/ai', aiTaskRoutes);
app.use('/api/conversations', conversationRoutes);

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

// app.listen(PORT, () => console.log
//   (`Server listening on ${PORT}`)
// );
