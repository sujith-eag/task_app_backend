import mongoose from "mongoose";
import User from "./userModel";

const taskSchema = new mongoose.Schema(
    {
        text: { 
            type: String, 
            required: [true, 'Please add a text value'] 
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User'
        },
    },
    {
        timestamps: true
    }
);

const Task = mongoose.model('Task', taskSchema);
 
export default Task;