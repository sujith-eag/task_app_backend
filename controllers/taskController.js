
import asyncHandler from 'express-async-handler';
import Task from '../models/taskModel.js';
import User from '../models/userModel.js'

// import { text } from 'express';


const getTasks = asyncHandler( async (req, res)=>{
    
    const tasks = await Task.find( { user: req.user.id } );
    res.status(200).json(tasks);
    // res.status(200).json({message: 'Get these messages also'});
})


const setTasks = asyncHandler( async (req, res)=>{
    if(!req.body.text){
        res.status(400)
        throw new Error('Please enter a task');
    }
    const task = await Task.create({ text: req.body.text, user: req.user.id })
    res.status(200).json(task);
    // res.status(200).json({message: 'Creating a Task'});
} )


const updateTasks = asyncHandler(async (req, res)=>{
    const task = await Task.findById(req.params.id)
    if (!task){
        res.status(400)
        throw new Error('Task not found')
    }
    
    const user = await User.findById(req.user.id)
    if(!user){
        res.status(401);
        throw new Error('No such User found');
    }
    
    if (task.user.toString() != user.id) {
        res.status(401)
        throw new Error('User is not authorized to update')
    }
    
    const updatedTask = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true })
    res.status(200).json(updatedTask) 
    // res.status(200).json({message: `Task ${req.params.id} Updated`});
} )


const deleteTasks = asyncHandler ( async (req, res)=>{
    
    const task = await Task.findById(req.params.id);
    if(!task){
        res.status(400)
        throw new Error('Task not found')
    }
    
    const user = await User.findById(req.user.id)
    if(!user){
        res.status(401);
        throw new Error('No such User found');
    }
    
    if (task.user.toString() != user.id) {
        res.status(401)
        throw new Error('User is not authorized to delete')
    }

    await Task.findByIdAndDelete(req.params.id)
    res.status(200).json({ id: req.params.id })
    // res.status(200).json({message: `Task ${req.params.id} is deleted.`});
})

export { getTasks, setTasks, updateTasks, deleteTasks };
