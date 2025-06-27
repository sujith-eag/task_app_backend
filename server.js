
import express from 'express';
import taskRoutes from './routes/taskRoutes.js';
import userRoutes from './routes/userRoutes.js';

import { errorHandler } from './middleware/errorMiddleware.js';

import dotenv from 'dotenv';
dotenv.config();

import connectDB from './connect/database.js';
connectDB();

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());

app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server listening at port ${port}`);
});
