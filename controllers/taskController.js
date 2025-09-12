import asyncHandler from 'express-async-handler';
import Task from '../models/taskModel.js';
import User from '../models/userModel.js';


// @desc    Get tasks with filtering and sorting
// @route   GET /api/tasks
// @access  Private
const getTasks = asyncHandler(async (req, res) => {
  
  // Basic filter to get tasks only for the logged-in user
  const filter = { user: req.user.id };

  // Add status and priority filters if they exist in query
  if (req.query.status) {
    filter.status = req.query.status;
  }
  if (req.query.priority) {
    filter.priority = req.query.priority;
  }
  // Basic sorting (e.g., ?sortBy=dueDate:desc)
  let sort = {};
  if (req.query.sortBy) {
    const parts = req.query.sortBy.split(':');
    sort[parts[0]] = parts[1] === 'desc' ? -1 : 1;
  } else {
    sort = { createdAt: -1 }; // Default sort by creation date
  }

  const tasks = await Task.find(filter).sort(sort);
  res.status(200).json(tasks);
});



// @desc    Set a new task
// @route   POST /api/tasks
// @access  Private
const setTasks = asyncHandler(async (req, res) => {
  // The required field is now 'title', not 'text'
  if (!req.body.title) {
    res.status(400);
    throw new Error('Please enter a title for the task');
  }

  // Create task with all the new fields from the request body
  const task = await Task.create({
    user: req.user.id,
    title: req.body.title,
    description: req.body.description,
    dueDate: req.body.dueDate,
    priority: req.body.priority,
    status: req.body.status,
    tags: req.body.tags,
  });

  res.status(201).json(task); // 201 for resource creation
});




// @desc    Update a task
// @route   PUT /api/tasks/:id
// @access  Private
const updateTasks = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    res.status(404); // 404 for not found
    throw new Error('Task not found');
  }

  // req.user.id is available from the 'protect' middleware
  if (task.user.toString() !== req.user.id) {
    res.status(401);
    throw new Error('User not authorized');
  }

  const updatedTask = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.status(200).json(updatedTask);
});




// @desc    Delete a task
// @route   DELETE /api/tasks/:id
// @access  Private
const deleteTasks = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    res.status(404);
    throw new Error('Task not found');
  }

  // Refactored user authorization check for efficiency
  if (task.user.toString() !== req.user.id) {
    res.status(401);
    throw new Error('User not authorized');
  }

  await task.deleteOne(); // Use the .deleteOne() method on the document

  res.status(200).json({ id: req.params.id });
});






// --- SUB-TASK CONTROLLERS ---

// @desc    Add a sub-task to a task
// @route   POST /api/tasks/:id/subtasks
// @access  Private
const addSubTask = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text) {
    res.status(400);
    throw new Error('Please provide text for the sub-task');
  }

  const task = await Task.findById(req.params.id);

  if (task && task.user.toString() === req.user.id) {
    task.subTasks.push({ text });
    await task.save();
    res.status(201).json(task);
  } else {
    res.status(404);
    throw new Error('Task not found or user not authorized');
  }
});



// @desc    Update a sub-task
// @route   PUT /api/tasks/:id/subtasks/:subTaskId
// @access  Private
const updateSubTask = asyncHandler(async (req, res) => {
  const { text, completed } = req.body;
  const task = await Task.findById(req.params.id);

  if (task && task.user.toString() === req.user.id) {
    const subTask = task.subTasks.id(req.params.subTaskId);
    if (subTask) {
      subTask.text = text ?? subTask.text;
      subTask.completed = completed ?? subTask.completed;
      await task.save();
      res.status(200).json(task);
    } else {
      res.status(404);
      throw new Error('Sub-task not found');
    }
  } else {
    res.status(404);
    throw new Error('Task not found or user not authorized');
  }
});



// @desc    Delete a sub-task
// @route   DELETE /api/tasks/:id/subtasks/:subTaskId
// @access  Private
const deleteSubTask = asyncHandler(async (req, res) => {
    const task = await Task.findById(req.params.id);

    if (task && task.user.toString() === req.user.id) {
        const subTask = task.subTasks.id(req.params.subTaskId);
        if (subTask) {
            subTask.deleteOne();
            await task.save();
            res.status(200).json(task);
        } else {
            res.status(404);
            throw new Error('Sub-task not found');
        }
    } else {
        res.status(404);
        throw new Error('Task not found or user not authorized');
    }
});


export {
  getTasks,
  setTasks,
  updateTasks,
  deleteTasks,
  addSubTask,
  updateSubTask,
  deleteSubTask
};