import express from 'express';
import protect from '../middleware/authMiddleware.js';
import { getTasks, setTasks, deleteTasks, updateTasks} from '../controllers/taskController.js';

const router = express.Router();

router.get('/', protect, getTasks);

router.post('/', protect, setTasks );

router.put('/:id', protect, updateTasks);

router.delete('/:id', protect, deleteTasks);

export default router;
