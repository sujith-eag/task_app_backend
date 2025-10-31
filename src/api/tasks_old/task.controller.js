import asyncHandler from 'express-async-handler';
import Task from '../../models/taskModel.js';


// @desc    Get tasks with filtering and sorting
// @route   GET /api/tasks
// @access  Private
export const getTasks = asyncHandler(async (req, res) => {

  // Basic filter to get tasks only for the logged-in user
  const filter = { user: req.user.id };
  const { status, priority, sortBy = 'createdAt:desc' } = req.query;
  
  // Add status and priority filters if they exist in query
  if (status) filter.status = status;
  if (priority) filter.priority = priority;

  // Basic sorting (e.g., ?sortBy=dueDate:desc)
  let sort = {};
  if (sortBy) {
    const [field, order] = sortBy.split(':');
    sort[field] = order === 'asc' ? 1 : -1;
  } else {
    sort = { createdAt: -1 }; // Default sort by creation date
  }

  const tasks = await Task.find(filter).sort(sort);
  res.status(200).json(tasks);
});



// @desc    Set a new task
// @route   POST /api/tasks
// @access  Private
export const createTask = asyncHandler(async (req, res) => {

  const { title, description, dueDate, priority, status, tags } = req.body;

  if (!title) {
    res.status(400);
    throw new Error('Title is required for the task');
  }

  // Create task with all the new fields from the request body
  const task = await Task.create({
    user: req.user.id,
    title,      // not optional, so
    description,
    dueDate,
    priority,
    status,
    tags,
  });

  res.status(201).json(task); // 201 for resource creation
});




// @desc    Create multiple tasks at once from a pre-defined plan
// @route   POST /api/tasks/bulk
// @access  Private
export const createBulkTasks = asyncHandler(async (req, res) => {
    const { tasks } = req.body; // Expecting an object like { tasks: [...] }

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        res.status(400);
        throw new Error('Please provide a valid array of tasks.');
    }

    const MAX_AI_TASKS = 15;
    if (tasks.length > MAX_AI_TASKS) {
        res.status(400);
        throw new Error(`Cannot create more than ${MAX_AI_TASKS} tasks at once.`);
    }

    // Add Current user's ID and a default status to each task
    const tasksToCreate = tasks.map(task => ({
        ...task,
        user: req.user.id,
        status: 'To Do',
    }));

    // insertMany for efficient bulk insertion
    const newTasks = await Task.insertMany(tasksToCreate);

    res.status(201).json(newTasks);
});




// @desc    Update a task
// @route   PUT /api/tasks/:id
// @access  Private
export const updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    res.status(404); // 404 for not found
    throw new Error('Task not found');
  }

  // req.user.id is available from the 'protect' middleware
  if (task.user.toString() !== req.user.id) {
    res.status(403);
    throw new Error('User not authorized');
  }

  const updatedTask = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.status(200).json(updatedTask);
});



// @desc    Delete a task
// @route   DELETE /api/tasks/:id
// @access  Private
export const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    res.status(404);
    throw new Error('Task not found');
  }

  // Refactored user authorization check for efficiency
  if (task.user.toString() !== req.user.id) {
    res.status(403);
    throw new Error('User not authorized');
  }

  await task.deleteOne(); // Use the .deleteOne() method on the document

  res.status(200).json({ id: req.params.id });
});






// --- SUB-TASK CONTROLLERS ---

// @desc    Add a sub-task to a task
// @route   POST /api/tasks/:id/subtasks
// @access  Private
export const addSubTask = asyncHandler(async (req, res) => {
  const { text } = req.body;
  const task = await Task.findById(req.params.id);

  if (!text) {
    res.status(400);
    throw new Error('Please provide text for the sub-task');
  }
  if (!task) {
    res.status(404);
    throw new Error('Task not found');
  }
  if (task.user.toString() !== req.user.id) {
    res.status(403);
    throw new Error('User Not authorized');
  }
  const newSubTask = {
    text,
    completed: false,
    // createdAt: new Date(),
  };

  task.subTasks.push(newSubTask);
  await task.save();
  res.status(200).json(task);
});



// @desc    Update a sub-task
// @route   PUT /api/tasks/:id/subtasks/:subTaskId
// @access  Private
export const updateSubTask = asyncHandler(async (req, res) => {
  const { id, subTaskId } = req.params;

  const task = await Task.findById(id);
  if (!task) {
    res.status(404);
    throw new Error('Task not found');
  }
  if (task.user.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized');
  }

  const subTask = task.subTasks.id(subTaskId);
  if (!subTask) {
    res.status(404);
    throw new Error('Subtask not found');
  }

  const { text, completed } = req.body;
  subTask.text = text ?? subTask.text;
  subTask.completed = completed ?? subTask.completed;
      
  await task.save();
  res.status(200).json(task);
});




// @desc    Delete a sub-task
// @route   DELETE /api/tasks/:id/subtasks/:subTaskId
// @access  Private
export const deleteSubTask = asyncHandler(async (req, res) => {
  const { id, subTaskId } = req.params;
  
  const task = await Task.findById(id);
  if(!task){
    res.status(404);
    throw new Error('Task not found');
  }
  if(task.user.toString() !== req.user.id){
    res.status(403);
    throw new Error('Not Authorized');
  }

//Making list, except the subTask to be deleted not using Mongoose
  // task.subTasks = task.subTasks.filter(
  //     (sub) => sub._id.toString() !== subTaskId);

  const subTask = task.subTasks.id(subTaskId);
  if (subTask) {
      subTask.deleteOne();
  } else {
      res.status(404);
      throw new Error('Sub-task not found');
  }

  await task.save();
  res.status(200).json(task);
});
