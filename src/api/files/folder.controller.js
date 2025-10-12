import asyncHandler from 'express-async-handler';
import Joi from 'joi';
import File from '../../models/fileModel.js';
import mongoose from 'mongoose';

const createFolderSchema = Joi.object({
    folderName: Joi.string().required().trim(),
    parentId: Joi.string().allow(null).optional(), // Can be null for root folder
});

// @desc    Create a new folder
// @route   POST /api/files/folders
// @access  Private
export const createFolder = asyncHandler(async (req, res) => {
    const { error, value } = createFolderSchema.validate(req.body);
    if (error) {
        res.status(400);
        throw new Error(error.details[0].message);
    }

    const { folderName, parentId } = value;
    let parentFolder = null;
    let newPath = ','; // Default path for root

    if (parentId) {
        parentFolder = await File.findOne({ _id: parentId, user: req.user._id, isFolder: true });
        if (!parentFolder) {
            res.status(404);
            throw new Error('Parent folder not found or you do not have permission to access it.');
        }
        newPath = parentFolder.path + parentId + ',';
    }

    // Create the new folder document
    const newFolder = await File.create({
        user: req.user._id,
        fileName: folderName,
        isFolder: true,
        parentId: parentId || null,
        path: newPath,
        // These fields are required by the schema but not relevant for folders
        s3Key: new mongoose.Types.ObjectId().toString(), // Use a random unique value
        fileType: 'folder',
        size: 0,
    });

    res.status(201).json(newFolder);
});


const moveItemSchema = Joi.object({
    newParentId: Joi.string().allow(null).required(),
});

// @desc    Move a file or folder to a new location
// @route   PATCH /api/files/:itemId/move
// @access  Private
export const moveItem = asyncHandler(async (req, res) => {
    const { error, value } = moveItemSchema.validate(req.body);
    if (error) {
        res.status(400);
        throw new Error(error.details[0].message);
    }

    const { itemId } = req.params;
    const { newParentId } = value;
    const userId = req.user._id;

    // 1. Fetch the item to move and the destination folder in parallel
    const [itemToMove, destinationFolder] = await Promise.all([
        File.findOne({ _id: itemId, user: userId }),
        newParentId ? File.findOne({ _id: newParentId, user: userId, isFolder: true }) : Promise.resolve('root') // 'root' is a placeholder for the root directory
    ]);

    // 2. Validation and Security Checks
    if (!itemToMove) {
        res.status(404);
        throw new Error('Item to move not found or you do not have permission.');
    }
    if (!destinationFolder) {
        res.status(404);
        throw new Error('Destination folder not found or you do not have permission.');
    }
    if (itemId === newParentId) {
        res.status(400);
        throw new Error('Cannot move an item into itself.');
    }

    // Prevent moving a folder into its own child
    if (itemToMove.isFolder && destinationFolder !== 'root' && destinationFolder.path.startsWith(itemToMove.path + itemToMove._id + ',')) {
        res.status(400);
        throw new Error('Cannot move a folder into one of its own subfolders.');
    }

    // 3. Prepare for path updates
    const oldPath = itemToMove.path;
    const newParentPath = (destinationFolder === 'root') ? ',' : destinationFolder.path + destinationFolder._id + ',';
    const newPath = newParentPath;

    // 4. Update the moved item itself
    itemToMove.parentId = newParentId || null;
    itemToMove.path = newPath;
    await itemToMove.save();

    // 5. If it was a folder, recursively update all its descendants
    if (itemToMove.isFolder) {
        const descendants = await File.find({
            user: userId,
            path: { $regex: `^${oldPath}${itemToMove._id},` }
        });

        if (descendants.length > 0) {
            const bulkOps = descendants.map(descendant => {
                const updatedPath = descendant.path.replace(oldPath, newPath);
                return {
                    updateOne: {
                        filter: { _id: descendant._id },
                        update: { $set: { path: updatedPath } }
                    }
                };
            });
            await File.bulkWrite(bulkOps);
        }
    }

    res.status(200).json({ message: 'Item moved successfully.' });
});