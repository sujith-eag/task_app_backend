import express from 'express';
import cors from 'cors';

import 'dotenv/config'; // auto-runs dotenv.config()
// import dotenv from 'dotenv';
// dotenv.config();

import helmet from 'helmet'; // Security headers
import morgan from 'morgan'; // Request logger

import taskRoutes from './routes/taskRoutes.js';
import userRoutes from './routes/userRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import aiTaskRoutes from './routes/aiTaskRoutes.js';

import errorHandler from './middleware/errorMiddleware.js';
import connectDB from './connect/database.js';

// --- Initial Setup ---
const app = express();

// Connect DB with error handling
connectDB()
  .then( ()=> console.log('MongoDB connected'))
  .catch((err)=>{
    console.error('DB connection error:', err);
    process.exit(1);
  });

const port = process.env.PORT || 8000;

// Tells Express to trust the first hop from the proxy server, 
// which is standard for platforms like Render, Heroku, etc.
app.set('trust proxy', 1);

// --- Core Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

// --- Security & Logging Middleware ---
  // Setting security HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: false, // allow images from other origins
  })
); 


// morgan for logging in development mode
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// --- API Routes ---
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/ai', aiTaskRoutes);

// --- 404 for undefined routes ---
app.use((req, res, next) => {
  res.status(404).json({ message: 'Route not found' });
});

// --- Error Handling Middleware ---
app.use(errorHandler);

// --- Server Start ---
app.listen(port, () => console.log
  (`Server listening on ${port}`)
);