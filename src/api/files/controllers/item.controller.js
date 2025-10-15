import asyncHandler from 'express-async-handler';

import File from '../../../models/fileModel.js';



// Better to rename as getUserItems as folder also is present

// @desc    Get all files owned by or shared with the user (including class shares)
// @route   GET /api/files/items
// @access  Private
export const getUserFiles = asyncHandler(async (req, res) => {
    const user = req.user;
    const { parentId } = req.query; // Get patentId from query string    

    // Determine the target parentId: null for root, or the provided ID
    const targetParentId = parentId === 'null' || !parentId ? null : parentId;

    // This query finds items in a specific directory that the user has permission to see.
    let query = {
        $and: [
            { parentId: targetParentId }, // 1. Item must be in the target directory
            {
                // 2. User must have permission
                $or: [
                    { user: user._id }, // They own it
                    { 'sharedWith.user': user._id }, // It's shared directly with them
                    // Add student-specific class share logic if applicable
                    ...(user.role === 'student' && user.studentDetails ? [{
                        'sharedWithClass.batch': user.studentDetails.batch,
                        'sharedWithClass.section': user.studentDetails.section,
                        'sharedWithClass.semester': user.studentDetails.semester
                    }] : [])
                ]
            }
        ]
    };

    // Fetch the files and the current folder data in parallel
    const [files, currentFolder] = await Promise.all([
        File.find(query)
        .sort({ isFolder: -1, fileName: 1 }) // Show Folder first
        .populate('user', 'name avatar')  // Populate the owner's details for frontend display
        .populate('sharedWith.user', 'name avatar'), // to get user details within the sharedWith array

        targetParentId ? File.findById(targetParentId).select('fileName path') : null
    ]);


    let breadcrumbs = [];
    if (currentFolder && currentFolder.path) {
            // The path is like ",id1,id2,", so we get IDs by splitting and filtering
        const ancestorIds = currentFolder.path.split(',').filter(id => id);
        if (ancestorIds.length > 0) {
            // Fetch all ancestors in one go
            const ancestors = await File.find({ 
                _id: { $in: ancestorIds } })
                .select('fileName');
            
            // Create a map for instant lookup to guarantee correct order
            const ancestorMap = new Map(ancestors.map(anc => [anc._id.toString(), anc]));
            
            // Reconstruct the breadcrumbs in the correct path order
            breadcrumbs = ancestorIds.map(id => ancestorMap.get(id));
        }
    }
    
    // Return a structured object with all necessary data
    res.status(200).json({ files, currentFolder, breadcrumbs });
});
