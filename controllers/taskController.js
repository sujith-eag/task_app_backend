
import asyncHandler from 'express-async-handler';
import taskModel from '../models/taskModel.js';
import { text } from 'express';

const getTasks = asyncHandler( async (req, res)=>{
    
    const tasks = await taskModel.find();
    res.status(200).json(tasks);
    // res.status(200).json({message: 'Get these messages also'});
})

const setTasks = asyncHandler( async (req, res)=>{
    
    if(!req.body.text){
        res.status(400)
        throw new Error('Please enter a task');
    }
    const task = await taskModel.create({ text: req.body.text })
    res.status(200).json(task);
    // res.status(200).json({message: 'Creating a Task'});
} )

const updateTasks = asyncHandler(async (req, res)=>{
    const task = await taskModel.findById(req.params.id)
    if (!task){
        res.status(400)
        throw new Error('Task not found')
    }
        const updatedTask = await taskModel.findByIdAndUpdate(req.params.id, req.body, { new: true })
        res.status(200).json(updatedTask) 
    
    // res.status(200).json({message: `Task ${req.params.id} Updated`});
} )

const deleteTasks = asyncHandler ( async (req, res)=>{
    
    const task = await taskModel.findById(req.params.id);
    if(!task){
        res.status(400)
        throw new Error('Task not found')
    }
    await taskModel.findByIdAndDelete(req.params.id)
    res.status(200).json({ id: req.params.id })
    // res.status(200).json({message: `Task ${req.params.id} is deleted.`});
})

export {getTasks, setTasks, updateTasks, deleteTasks};