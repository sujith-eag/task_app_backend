import express from 'express';
const router = express.Router();

import protect from '../middleware/authMiddleware.js';

import { getTasks, setTasks, deleteTasks, updateTasks} from '../controllers/taskController.js';


router.get('/', protect, getTasks);

router.post('/', protect, setTasks );

router.put('/:id', protect, updateTasks);

router.delete('/:id', protect, deleteTasks);

export default router;
