import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import helmet from 'helmet'; // Security headers
import morgan from 'morgan'; // Request logger
import rateLimit from 'express-rate-limit'; // Rate limiting

import taskRoutes from './routes/taskRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { errorHandler } from './middleware/errorMiddleware.js';
import connectDB from './connect/database.js';

// --- Initial Setup ---
dotenv.config();
const app = express();

// Connect DB with error handling
connectDB()
  .then( ()=> console.log('MongoDB connected'))
  .catch((err)=>{
    console.error('DB connection error:', err);
    process.exit(1);
  });

const port = process.env.PORT || 8000;

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

// Rate limiting to all API requests
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100,                 // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);


// morgan for logging in development mode
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// --- API Routes ---
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);

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