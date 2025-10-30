
### Critical Workflow, Security & Scalability Improvements


### Improvement 1: The `context` Field is Hard Security Boundary

`context` is the key. It solves the "implicit sharing" performance nightmare and creates a perfect, unbreachable wall between file types.

- **"My Files" (`GET /api/files/items`):** This controller _must_ be modified to _only_ show personal files.
    
    - **Old Logic (implied):** `File.find({ user: req.user._id, ... })`
        
    - **New Logic (Secure):** `File.find({ user: req.user._id, context: 'personal', parentId: ... })`
        
- **"Subject Materials" (`GET /api/academics/materials`):** This new endpoint _only_ looks for academic materials.
    
    - **Logic:** `File.find({ 'sharedWithClass.batch': ..., context: 'academic_material', parentId: ... })`
        
- **"Assignment" (`GET /api/academics/assignments/:id`):** This new endpoint _only_ looks for assignment files.
    
    - **Logic:** `File.find({ parentId: masterFolderId, context: 'assignment_submission', ... })`
        

**Benefit:** You _never_ have to check an item's ancestral path for permissions. A file's `context` and `sharedWithClass` / `user` fields are its _absolute source of truth_. This is infinitely more scalable and secure.

#### Improvement 2: Enforcing `context` (The Missing "Inheritance" Logic)

How do files get the correct context? They _must_ inherit it from their parent folder. This logic must be enforced in your **file management controllers**.

1. **On Upload (`upload.controller.js`):**
    
    - Your `uploadFiles` controller takes a `parentId`.
        
    - It **must** fetch the `parentFolder = await File.findById(parentId)`.
        
    - If parentFolder exists, the new File document must inherit its context:
        
        const newFile = await File.create({ ... context: parentFolder.context, ... });
        
    - If `parentId` is `null`, the context is `'personal'`.
        
2. **On Folder Creation (`folder.controller.js`):**
    
    - Same as upload. The `createFolder` controller must find the `parentFolder` and stamp its `context` onto the new folder.
        
3. **On Move (`folder.controller.js`):**
    
    - This is the most critical security rule. Your `moveItem` controller **must prevent context-crossing**.
        
    - **Workflow:**
        
        1. Fetch `itemToMove = await File.findById(itemId)`.
            
        2. Fetch `destinationFolder = await File.findById(newParentId)`.
            
        3. Get `destinationContext` (if `destinationFolder` is `null`, context is `'personal'`).
            
        4. **Security Check:**
            
            JavaScript
            
            ```
            if (itemToMove.context !== destinationContext) {
                res.status(403);
                throw new Error('Action forbidden: Cannot move files between personal and academic contexts.');
            }
            ```
            
    - This single check prevents a user from accidentally (or maliciously) moving a "personal" file into a shared "academic" folder, or vice-versa.
        

#### Improvement 3: Academic Files Must Be Quota-Exempt (A Scalability Fix)

Your `storage.middleware.js` will break the "Assignment" workflow.

- **Problem:** A Student uploads a file. The `checkStorageQuota` middleware runs as the _Student_ (`req.user`). It checks the _Student's_ quota. But the file is _owned by the Teacher_ and doesn't count against the Student.
    
- **Solution:** Academic files should not count against _any_ user's personal quota. They are system files.
    
- **Implementation:** Modify your `checkStorageQuota` middleware to _only_ sum files with a `personal` context.
    

**`storage.middleware.js` (Update)**

```js
// ...
// --- Calculate Current Usage ---
const usage = await File.aggregate([
    { 
        $match: { 
            user: req.user._id,
            context: 'personal' // <-- THE CRITICAL CHANGE
        } 
    },
    {
        $group: {
            _id: null,
            totalSize: { $sum: '$size' },
            fileCount: { $sum: 1 }
        }
    }
]);
// ...
```

#### Improvement 4: The Secure "Student Submission" Workflow (Missing Controller)

New Endpoint: POST /api/v1/academics/assignments/:id/submit

The new "Dedicated Workspace" workflow means **uploading files** and **submitting** are two separate actions.

1. **Uploading:** A student uploads files to their _own_ `draftFolder` (which they own) using the general `uploadFiles` controller.
    
2. **Submitting:** They click a "Submit" button, which calls this new, dedicated controller. This controller's _only_ job is to perform the **"permission-flip."**
    


(This goes in new academic.controller.js)

> This is Somewhat outdated logic and new logic involves a **New Plan:** "Dedicated Workspace" model in `idea_2.md` and `models_1.md` is based on the **Student** owning the `draftFolder`, which then "permission-flips" to the teacher upon submission.

```js
// ... (in academic.controller.js) ...
import { uploadFile as uploadToS3 } from '../../../services/s3.service.js';

export const submitAssignment = asyncHandler(async (req, res) => {
    // 1. Get student, assignment, and check deadline
    const student = req.user;
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) { /* 404 */ }
    if (new Date() > assignment.deadline) { /* 400 */ }
    
    // 2. Find or Create the Student's unique submission record
    let submission = await AssignmentSubmission.findOne({
        assignment: assignment._id,
        student: student._id
    });

    // 3. Check status
    if (submission && submission.status === 'submitted') {
        res.status(400);
        throw new Error('You have already submitted this assignment.');
    }
    
    // 4. Find or Create the student's submission *folder*
    let submissionFolder;
    if (submission) { // Re-submitting after a rejection
        submissionFolder = await File.findById(submission.submissionFolderId);
    } else {
        const folderName = `${student.studentDetails.usn} - ${student.name}`;
        submissionFolder = await File.create({
            user: assignment.teacher, // <-- Teacher is owner
            fileName: folderName,
            isFolder: true,
            parentId: assignment.masterFolderId,
            path: '...', // Calculate path based on masterFolder
            context: 'assignment_submission' // <-- Set context
        });

        // Create the submission record
        submission = await AssignmentSubmission.create({
            assignment: assignment._id,
            student: student._id,
            status: 'submitted',
            submissionFolderId: submissionFolder._id
        });
    }

    // 5. Process file uploads (This is the "privileged" part)
    if (!req.files || req.files.length === 0) { /* 400 */ }

    const uploadPromises = req.files.map(async (file) => {
        const s3Key = await uploadToS3(file);
        
        // Create the File doc. The authenticated user is the STUDENT,
        // but the OWNER of the file is the TEACHER.
        return File.create({
            user: assignment.teacher, // <-- Teacher is owner
            fileName: file.originalname,
            s3Key: s3Key,
            fileType: file.mimetype,
            size: file.size,
            parentId: submissionFolder._id,
            path: '...', // Calculate path based on submissionFolder
            context: 'assignment_submission'
        });
    });

    await Promise.all(uploadPromises);
    
    // 6. Update submission status (if it was 'rejected')
    if (submission.status === 'rejected') {
        submission.status = 'submitted';
        submission.rejectionMessage = null;
        await submission.save();
    }
    
    // 7. (Future) Trigger notification for teacher
    
    res.status(201).json({ message: 'Assignment submitted successfully.' });
});
```

Here is the correct controller for **Phase 4: The "Permission Flip"**:

```js
// @desc    Submit an assignment (permission-flip)
// @route   POST /api/v1/academics/assignments/:id/submit
// @access  Private (isStudent)
export const submitAssignment = asyncHandler(async (req, res) => {
    const studentId = req.user._id;
    const { id: assignmentId } = req.params;

    // 1. Find the assignment to check deadline and get teacher ID
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
        res.status(404);
        throw new Error('Assignment not found.');
    }

    // 2. Check Deadline (as per your plan)
    if (new Date() > new Date(assignment.deadline)) {
        // You can choose to allow late submissions by just flagging it
        res.status(400);
        throw new Error('The deadline for this assignment has passed.');
    }

    // 3. Find the student's submission record.
    // This record is created via "Lazy Provisioning" when they first view it
    const submission = await AssignmentSubmission.findOne({
        assignment: assignmentId,
        student: studentId
    });

    if (!submission) {
        res.status(404);
        throw new Error('Submission record not found. Please access the assignment first.');
    }
    
    // 4. Check status
    if (submission.status === 'submitted') {
        res.status(400);
        throw new Error('You have already submitted this assignment.');
    }

    // 5. Find the draft folder (which is currently owned by the student)
    const draftFolder = await File.findById(submission.submissionFolderId);
    if (!draftFolder) {
        res.status(404);
        throw new Error('Submission folder not found.');
    }

    // 6. --- THE PERMISSION FLIP ---
    // Change ownership from student to teacher
    draftFolder.user = assignment.teacher;
    
    // Update submission status and timestamp
    submission.status = 'submitted';
    submission.submittedAt = new Date();
    submission.rejectionMessage = null;

    // 7. Save both documents (ideally in a transaction)
    await draftFolder.save();
    await submission.save();

    // 8. (Future) Trigger notification for the teacher
    
    res.status(200).json({ message: 'Assignment submitted successfully.' });
});
```

____
### 2. Controller Modifications

**`folder.controller.js` (`createFolder`)**

- **Goal:** Enforce 2-level nesting limit.
    
- **Logic:** When creating a folder, check the depth of the `parentFolder`.
    

```js
export const createFolder = asyncHandler(async (req, res) => {
    // ... (validation)
    const { folderName, parentId } = value;
    let parentFolder = null;
    let newPath = ','; 

    if (parentId) {
        parentFolder = await File.findOne({ ... });
        if (!parentFolder) { ... } // (existing error)

        // --- NEW: Nesting Limit Logic ---
        const depth = parentFolder.path.split(',').filter(id => id).length;
        if (depth >= 2) {
            res.status(400);
            throw new Error('Nesting limit reached. You can only create folders up to 2 levels deep.');
        }
        // --- End New Logic ---

        newPath = parentFolder.path + parentId + ',';
    }

    // ... (rest of the create logic)
});
```


### `deleteFolder` Controller (Updated)


This is the new controller, updated for the **Recycle Bin Workflow**. Its job is to perform a recursive _soft delete_.

```js
// @desc    Move a folder and all its contents to the recycle bin (soft delete)
// @route   DELETE /api/files/folders/:folderId
// @access  Private
export const deleteFolder = asyncHandler(async (req, res) => {
    const { folderId } = req.params;
    const userId = req.user.id;

    // 1. Find the folder to be deleted
    const folder = await File.findOne({
        _id: folderId,
        user: userId,
        isFolder: true,
        isDeleted: false // Make sure it's not already in the trash
    });

    if (!folder) {
        res.status(404);
        throw new Error('Folder not found.');
    }

    // 2. Find all descendant files and folders using the path
    // We create a regex to find all items whose path starts with this folder's path
    const descendantRegex = new RegExp(`^${folder.path}${folder._id},`);
    
    // 3. Create a list of all item IDs to be soft-deleted
    const descendants = await File.find({ path: descendantRegex, user: userId });
    const allItemIds = [folder._id, ...descendants.map(d => d._id)];

    // 4. Perform the recursive soft delete
    await File.updateMany(
        { _id: { $in: allItemIds } },
        { $set: { isDeleted: true, deletedAt: new Date() } }
    );
    
    res.status(200).json({ message: 'Folder and all its contents moved to trash.' });
});
```







**`upload.controller.js` (`uploadFiles`)**

- **Goal:** Make the "Updated On" (i.e., `updatedAt`) field on a folder reflect when new files are added to it.
    
- **Logic:** After uploading files, "touch" the parent folder to update its timestamp.
    
```js
export const uploadFiles = asyncHandler(async (req, res) => {
    // ... (existing logic to find parentFolder) ...

    const filesMetadata = await Promise.all(uploadPromises);
    let newFiles = await File.insertMany(filesMetadata);

    // --- NEW: Update Parent Folder's Timestamp ---
    if (parentFolder) {
        // Use findByIdAndUpdate to simply "touch" the updatedAt field
        await File.findByIdAndUpdate(parentFolder._id, { updatedAt: new Date() });
    }
    // --- End New Logic ---

    newFiles = await File.populate(newFiles, { path: 'user', select: 'name avatar' });
    res.status(201).json(newFiles);
});
```

---

## Phase 2: "Subject Materials" Feature

This feature is 90% complete with your existing code. We just need to build the API endpoints to serve the specialized frontend view. No new models are needed.

### 1. Teacher Workflow (Creating Materials)

1. A Teacher visits the "Subject Materials" page.
    
2. The frontend shows their `user.teacherDetails.assignments` (their class load).
    
3. They click "Create Material Folder" for "Subject A, Sem 3, Sec B".
    
4. The frontend first calls `POST /api/files/folders` with `folderName: "Subject A - Materials"`.
    
5. On success, it gets back the `newFolder._id`.
    
6. The frontend _immediately_ calls `POST /api/v1/files/`**`{newFolder._id}`**`/share-class` with the class details (Subject ID, Batch, Sem, Sec).
    
7. Done. The folder is now in the teacher's "My Files" _and_ shared with the class.

### 2. Student/Teacher Workflow (Viewing Materials)

We need a new endpoint to _only_ show items shared with a class, separate from "My Files."

**New File: `academic.controller.js`**

```js
import asyncHandler from 'express-async-handler';
import File from '../../models/fileModel.js';
import User from '../../models/userModel.js';

// @desc    Get all files/folders shared with a student's class
// @route   GET /api/v1/academics/materials
// @access  Private (isStudent)
export const getSubjectMaterials = asyncHandler(async (req, res) => {
    const { user } = req; // req.user is a student

    if (!user.studentDetails) {
        return res.status(200).json([]); // Not a verified student
    }

    // Find all files/folders (isFolder: true) shared with this student's class
    // We only query for root-level shares (parentId: null) or 
    // items shared directly with the class (not just a sub-folder).
    const materials = await File.find({
        // Match the student's class details
        'sharedWithClass.batch': user.studentDetails.batch,
        'sharedWithClass.section': user.studentDetails.section,
        'sharedWithClass.semester': user.studentDetails.semester,
        // Optionally, ensure we only get items shared for their enrolled subjects
        'sharedWithClass.subject': { $in: user.studentDetails.enrolledSubjects }
    })
    .populate('user', 'name avatar') // Show which teacher shared it
    .sort({ updatedAt: -1 });

    res.status(200).json(materials);
});
```

**New Route: `academic.routes.js`**

```js
import express from 'express';
import { protect } from '../middleware/auth.middleware.js'; // Your auth middleware
import { isStudent } from '../middleware/role.middleware.js';
import { getSubjectMaterials } from '../controllers/academic.controller.js';

const router = express.Router();

// @route   GET /api/v1/academics/materials
router.route('/materials').get(protect, isStudent, getSubjectMaterials);

export default router;
```

When a student clicks on one of these folders, the frontend can just use the _existing_ `GET /api/files/items?parentId=...` route to navigate inside it. Your existing permission logic in `getUserFiles` will handle the rest.

---

## Phase 3: "Assignments" Feature


### New API Endpoints & Controller Logic

We add these to `academic.controller.js` and `academic.routes.js`.

**`academic.controller.js` (Additions)**


```js
// ... (imports: File, User, Assignment, AssignmentSubmission, uploadToS3)
// We also need the 'generalUploader' middleware
import { generalUploader } from '../middleware/file.middleware.js'; // Adjust path

// @desc    Create a new assignment
// @route   POST /api/v1/academics/assignments
// @access  Private (isTeacher)
export const createAssignment = asyncHandler(async (req, res) => {
    // ... (Joi validation for: title, description, deadline, subject, batch, semester, sections) ...
    
    // 1. Create the main "assignment folder" first.
    // This folder is owned by the teacher.
    const assignmentFolder = await File.create({
        user: req.user._id,
        fileName: req.body.title, // Use assignment title as folder name
        isFolder: true,
        parentId: null, // Or a specific "Assignments" root folder if you want
        path: ',', // Assumes root for now
        s3Key: new mongoose.Types.ObjectId().toString(), // Dummy key for folders
        fileType: 'folder',
        size: 0,
        // CRITICAL: Hide this folder from "My Files"
        // We need a new field for this. Let's add 'context' to fileSchema.
        // For now, let's assume it's in their root.
    });

    // 2. Create the Assignment document
    const assignment = await Assignment.create({
        ...req.body,
        teacher: req.user._id,
        assignmentFolder: assignmentFolder._id,
    });

    res.status(201).json(assignment);
    
    // 3. (Future) Find matching students and create notifications
});

// @desc    Get all assignments for the logged-in user
// @route   GET /api/v1/academics/assignments
// @access  Private (isStudent or isTeacher)
export const getAssignments = asyncHandler(async (req, res) => {
    let assignments = [];
    let submissions = new Map(); // To map submission status to assignments

    if (req.user.role === 'teacher') {
        assignments = await Assignment.find({ teacher: req.user._id })
            .populate('subject', 'name subjectCode')
            .sort({ deadline: -1 });

    } else if (req.user.role === 'student') {
        const { batch, semester, section } = req.user.studentDetails;
        assignments = await Assignment.find({
            batch,
            semester,
            sections: section, // Check if student's section is in the array
            isVisible: true
        })
        .populate('subject', 'name subjectCode')
        .populate('teacher', 'name')
        .sort({ deadline: -1 });
        
        // Find this student's submissions
        const studentSubmissions = await AssignmentSubmission.find({ 
            student: req.user._id,
            assignment: { $in: assignments.map(a => a._id) }
        });
        
        // Map them for easy frontend lookup
        studentSubmissions.forEach(sub => {
            submissions.set(sub.assignment.toString(), sub);
        });
    }

    // Convert map to plain object for JSON response
    const submissionMap = Object.fromEntries(submissions);
    res.status(200).json({ assignments, submissionMap });
});

// @desc    Student submits files for an assignment
// @route   POST /api/v1/academics/assignments/:id/submit
// @access  Private (isStudent)
export const submitAssignment = asyncHandler(async (req, res) => {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
        res.status(404); throw new Error('Assignment not found.');
    }

    // 1. Check Deadline
    if (new Date() > new Date(assignment.deadline)) {
        res.status(400); throw new Error('Deadline has passed.');
    }
    
    // 2. Check for existing submission
    let submission = await AssignmentSubmission.findOne({
        assignment: assignment._id,
        student: req.user._id
    });
    
    if (submission && submission.status === 'submitted') {
        res.status(400); throw new Error('You have already submitted this assignment.');
    }
    
    // 3. Find or Create the student's submission folder
    // This folder is OWNED BY THE TEACHER (assignment.teacher)
    let studentFolder;
    if (submission && submission.submissionFolder) {
        // Re-using folder from a 'rejected' submission
        studentFolder = await File.findById(submission.submissionFolder);
    } else {
        const studentName = req.user.name;
        const studentUSN = req.user.studentDetails.usn || 'no-usn';
        const folderName = `${studentUSN} - ${studentName}`;
        
        const parentFolder = await File.findById(assignment.assignmentFolder);

        studentFolder = await File.create({
            user: assignment.teacher, // Teacher is the owner
            fileName: folderName,
            isFolder: true,
            parentId: assignment.assignmentFolder,
            path: parentFolder.path + parentFolder._id + ',',
            s3Key: new mongoose.Types.ObjectId().toString(),
            fileType: 'folder',
            size: 0,
        });
    }

    // 4. Upload files from req.files (from middleware)
    if (!req.files || req.files.length === 0) {
        res.status(400); throw new Error('No files uploaded.');
    }

    const uploadPromises = req.files.map(async (file) => {
        const s3Key = await uploadToS3(file); // From s3.service.js
        return {
            user: assignment.teacher, // Teacher is the owner
            fileName: file.originalname,
            s3Key,
            fileType: file.mimetype,
            size: file.size,
            isFolder: false,
            parentId: studentFolder._id,
            path: studentFolder.path + studentFolder._id + ',',
        };
    });
    
    const filesMetadata = await Promise.all(uploadPromises);
    await File.insertMany(filesMetadata);
    
    // 5. Create or Update the submission record
    if (submission) {
        submission.status = 'submitted';
        submission.submittedAt = new Date();
        submission.rejectionMessage = null;
        await submission.save();
    } else {
        submission = await AssignmentSubmission.create({
            assignment: assignment._id,
            student: req.user._id,
            status: 'submitted',
            submissionFolder: studentFolder._id
        });
    }
    
    // Update parent folder timestamp
    await File.findByIdAndUpdate(studentFolder._id, { updatedAt: new Date() });
    
    res.status(201).json(submission);
});

// @desc    Teacher rejects a submission
// @route   POST /api/v1/academics/submissions/:id/reject
// @access  Private (isTeacher)
export const rejectSubmission = asyncHandler(async (req, res) => {
    const { message } = req.body;
    if (!message) {
        res.status(400); throw new Error('A rejection message is required.');
    }
    
    const submission = await AssignmentSubmission.findById(req.params.id);
    if (!submission) {
        res.status(404); throw new Error('Submission not found.');
    }
    
    // 1. Find all files in the submission folder
    const filesToDelete = await File.find({ parentId: submission.submissionFolder });

    // 2. Delete files from S3 (bulk delete logic)
    if (filesToDelete.length > 0) {
        const deleteS3Promises = filesToDelete.map(file => deleteFromS3(file.s3Key));
        await Promise.all(deleteS3Promises);
    }
    
    // 3. Delete file documents from DB
    await File.deleteMany({ _id: { $in: filesToDelete.map(f => f._id) } });
    
    // 4. Update submission status. We keep the folder.
    submission.status = 'rejected';
    submission.rejectionMessage = message;
    await submission.save();
    
    // 5. (Future) Create notification for the student
    
    res.status(200).json(submission);
});
```

**`academic.routes.js` (Full File)**

```js
import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { isStudent, isTeacher } from '../middleware/role.middleware.js';
import { getSubjectMaterials, createAssignment, getAssignments, submitAssignment, rejectSubmission } from '../controllers/academic.controller.js';

// We need the multer middleware for the submit route
import { generalUploader } from '../middleware/file.middleware.js'; // Adjust path

const router = express.Router();

// Subject Materials
router.route('/materials')
    .get(protect, isStudent, getSubjectMaterials);

// Assignments
router.route('/assignments')
    .post(protect, isTeacher, createAssignment)
    .get(protect, getAssignments); // Students and Teachers can get

router.route('/assignments/:id/submit')
    .post(protect, isStudent, generalUploader.array('files', 8), submitAssignment);

router.route('/submissions/:id/reject')
    .post(protect, isTeacher, rejectSubmission);

export default router;
```

---

## Phase 4: "Notifications" Feature

This is a separate system that is _triggered_ by the academic workflows.

### Implementation

You don't need to build this now, but you would _modify_ your other controllers to create notifications.

- **`academicFile.controller.js` (`shareFileWithClass`):** After `file.save()`, find all students matching the class and `User.insertMany([...])` notifications for them.
    
- **`academic.controller.js` (`createAssignment`):** After `assignment.create()`, find matching students and create notifications.
    
- **`academic.controller.js` (`rejectSubmission`):** After `submission.save()`, create a _single_ notification for `submission.student`.
    
- **Cron Job:** You would run a daily job (`node-cron`) to check for assignments with `deadline` in 24 hours, find students who haven't submitted, and create "deadline_approaching" notifications.


## admin

**Admin/HOD (Head of Department)** role, which is critical for managing and maintaining the system. Also missed a few key "quality-of-life" features for users.

Here are the missing workflows and functionalities you should consider.

### "Admin" Workflow (System Management)

- **User Management:** An dashboard to manage all users.
    
    - **Approve/Reject Students:** Your `userModel` has `applicationStatus: 'pending'`, but no workflow for an admin to view and "approve" these applications.
        
    - **Role Management:** A UI to manually change a user's role (e.g., promote a `teacher` to `hod`).
        
    - **Impersonation:** A "Login as User" feature, which is invaluable for debugging a student's or teacher's specific problem.
        
- **Academic Year & Subject Management:**
    
    - **Subject Creation:** A UI for creating the `Subject` documents (e.g., "Data Structures, CS301").
        
    - **Teacher Assignment:** The UI to actually link a `Teacher` to a `Subject`, `Batch`, and `Section`. This is the action that triggers your "System-Managed Materials" workflow.
        
- **Content Oversight:**
    
    - **"Orphaned" File Management:** What happens when a teacher leaves? Your plan (Part 3, Phase 2) smartly gives folder ownership to an "admin" account. The admin needs a UI to re-assign these folders to a _new_ teacher.
        
    - **Storage Quota Management:** A dashboard to see total system storage, who the top users are, and potentially override quotas for specific users.
        

### 2. "Student Lifecycle" Workflow (Edge Cases)

Your system assumes a student's `batch`, `semester`, and `section` are static. They are not.

- **Missing Workflow: Student Changes Section**
    
    - **The Problem:** A student in "Section A" moves to "Section B" mid-semester.
        
    - **Impact:** Based on your current logic, they _instantly_ lose access to all "Section A" materials and assignments and gain access to "Section B."
        
    - **Question:** What happens to their "Section A" assignment submissions? Their `draftFolder` (owned by them) is now orphaned, and they have no way to access it.
        
    - **Recommendation:** When an admin changes a student's section, the system must run a "migration" script. This script should find all their `draftFolder`s for "Section A" assignments and re-link them to the corresponding "Section B" assignments (or mark them as "archived").
        

### 3. usability (User Quality-of-Life)

These are features users will expect, and their absence will be noticeable.

- **Missing Feature: Rename**
    
    - You've planned for "unique naming" but you don't have a controller or workflow for a user to actually **rename** their files or folders. This is a fundamental feature of any file system.
        


____



## `academicFile.controller.js`

```js
import asyncHandler from 'express-async-handler';

import File from '../../models/fileModel.js';
import User from '../../models/userModel.js';


// Needs a Joi schema
// import Joi from 'joi';
// const shareFileSchema = Joi.object({


// @desc    Share a file with an entire class
// @route   POST /api/v1/files/:id/share-class
// @access  Private (Owner of the file)
export const shareFileWithClass = asyncHandler(async (req, res) => {
    const { subject, batch, semester, section } = req.body;
    const file = await File.findById(req.params.id);

    // Verify the file exists and the user is the owner
    if (!file) {
        res.status(404);
        throw new Error('File not found.');
    }
    if (file.user.toString() !== req.user.id) {
        res.status(403);
        throw new Error('You are not authorized to share this file.');
    }

    // Validate that the teacher is assigned to the subject they are sharing with
    const teacher = await User.findById(req.user.id);
    const isAssigned = teacher.teacherDetails.subjectsTaught.some(
        taughtSubject => taughtSubject.toString() === subject
    );
    if (!isAssigned) {
        res.status(403);
        throw new Error('You can only share files with classes you are assigned to teach.');
    }

    // Update the file with the class sharing details
    file.sharedWithClass = { subject, batch, semester, section };
    await file.save();

    res.status(200).json({ message: 'File has been shared with the class.' });
});
```

## `folder.controller.js`

```js
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
    // ... (Joi validation)
    const { folderName, parentId } = value;
    let parentFolder = null;
    let newPath = ',';
    let context = 'personal'; // Default context is 'personal'

    if (parentId) {
        parentFolder = await File.findOne({ 
            _id: parentId, 
            user: req.user._id, 
            isFolder: true,
            isDeleted: false // Can't create a folder in a deleted parent
        });
        if (!parentFolder) {
            res.status(404);
            throw new Error('Parent folder not found.');
        }

        // --- 1. Nesting Limit Logic ---
        const depth = parentFolder.path.split(',').filter(id => id).length;
        if (depth >= 2) {
            res.status(400);
            throw new Error('Nesting limit reached. You can only create folders up to 2 levels deep.');
        }

        // --- 2. Context Inheritance Logic ---
        newPath = parentFolder.path + parentId + ',';
        context = parentFolder.context;
    }

    // --- 3. Unique Name Check Logic ---
    // We rely on the unique index in fileModel.js
    // We must wrap this in a try/catch for the duplicate key error
    try {
        let newFolder = await File.create({
            user: req.user._id,
            fileName: folderName,
            isFolder: true,
            parentId: parentId || null,
            path: newPath,
            context: context, // Set the inherited context
            s3Key: new mongoose.Types.ObjectId().toString(), // Dummy value
            fileType: 'folder',
            size: 0,
        });

        newFolder = await newFolder.populate('user', 'name avatar');
        res.status(201).json(newFolder);

    } catch (error) {
        if (error.code === 11000) { // MongoDB duplicate key error
            res.status(400);
            throw new Error('A folder with that name already exists in this location.');
        }
        throw error; // Re-throw other errors
    }
});

const moveItemSchema = Joi.object({
    newParentId: Joi.string().allow(null).required(),
});




// @desc    Move a file or folder to a new location
// @route   PATCH /api/files/:itemId/move
// @access  Private
export const moveItem = asyncHandler(async (req, res) => {
    // ... (Joi validation)
    const { itemId } = req.params;
    const { newParentId } = value;
    const userId = req.user._id;

    // 1. Fetch item and destination
    const [itemToMove, destinationFolder] = await Promise.all([
        File.findOne({ _id: itemId, user: userId, isDeleted: false }),
        newParentId ? File.findOne({ _id: newParentId, user: userId, isFolder: true, isDeleted: false }) : Promise.resolve('root')
    ]);

    // 2. --- VALIDATION CHECKS ---
    if (!itemToMove) { /* ... 404 error ... */ }
    if (!destinationFolder) { /* ... 404 error ... */ }
    if (itemId === newParentId) { /* ... 400 error ... */ }

    // --- 3. ACADEMIC SECURITY CHECK ---
    if (itemToMove.context === 'academic_material' || itemToMove.context === 'assignment') {
        res.status(403);
        throw new Error('Academic folders and files cannot be moved.');
    }
    // (This check also implicitly handles context-crossing, as 'personal' is the only context left)

    // 4. --- NESTING & HIERARCHY CHECKS ---
    const newParentPath = (destinationFolder === 'root') ? ',' : destinationFolder.path + destinationFolder._id + ',';
    
    // Check for moving a folder into its own child
    if (itemToMove.isFolder && destinationFolder !== 'root' && destinationFolder.path.startsWith(itemToMove.path + itemToMove._id + ',')) {
        res.status(400);
        throw new Error('Cannot move a folder into one of its own subfolders.');
    }

    // Check nesting limit on move
    if (destinationFolder !== 'root') {
        const itemDepth = itemToMove.isFolder ? 1 : 0; // Simplified depth check
        const destDepth = newParentPath.split(',').filter(id => id).length;
        if (destDepth + itemDepth > 2) {
            res.status(400);
            throw new Error('This move would exceed the 2-level folder depth limit.');
        }
    }
    
    // 5. --- UNIQUE NAME CHECK ---
    // Check if a file with the same name exists in the new destination
    const existingFile = await File.findOne({
        fileName: itemToMove.fileName,
        parentId: (destinationFolder === 'root') ? null : destinationFolder._id,
        isDeleted: false
    });
    if (existingFile) {
        res.status(400);
        throw new Error('A file or folder with that name already exists in the destination.');
    }
    
    // 6. --- UPDATE THE ITEM ---
    const oldPath = itemToMove.path;
    itemToMove.parentId = (destinationFolder === 'root') ? null : destinationFolder._id;
    itemToMove.path = newParentPath;
    await itemToMove.save();

    // 7. --- RECURSIVE PATH UPDATE ---
    if (itemToMove.isFolder) {
        // (The logic from your folder.controller.js for this part is correct and can be re-used)
        const descendantRegex = new RegExp(`^${oldPath}${itemToMove._id},`);
        const descendants = await File.find({ user: userId, path: descendantRegex });

        if (descendants.length > 0) {
            const bulkOps = descendants.map(descendant => {
                const updatedPath = descendant.path.replace(oldPath, newParentPath);
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
```


## `public.controller.js`

```js
import asyncHandler from 'express-async-handler';
import File from '../../models/fileModel.js';
import { getSignedUrl as getS3SignedUrl } from '../../services/s3.service.js';

import NodeCache from 'node-cache';


// Initialize a cache for public URLs. TTL is 55s, slightly less than the S3 URL expiry of 60s.
const publicUrlCache = new NodeCache({ stdTTL: 55 });


// @desc    Get a download link for a publicly shared file
// @route   POST /api/public/download
// @access  Public
export const getPublicDownloadLink = asyncHandler(async (req, res) => {
    const { code } = req.body;
    if (!code) {
        res.status(400);
        throw new Error('Share code is required.');
    }

    // Find the file by its active, unexpired share code
    const file = await File.findOne({
        'publicShare.code': code.trim(),
        'publicShare.isActive': true,
        'publicShare.expiresAt': { $gt: new Date() }
    });

    if (!file) {
        res.status(404);
        throw new Error('Invalid or expired share code.');
    }

    // --- Caching Logic ---
    const cacheKey = `public-download-url:${file._id}`;
    const cachedUrl = publicUrlCache.get(cacheKey);

    if (cachedUrl) {
        // Cache Hit: A valid URL exists. Atomically increment download count.
        await File.updateOne({ _id: file._id }, { $inc: { downloadCount: 1 } });
        return res.status(200).json({ url: cachedUrl });
    }

    // --- Cache Miss ---
    // Generate a fresh S3 URL for the download
    const downloadUrl = await getS3SignedUrl(file.s3Key, file.fileName);

    // Atomically increment the download count and set the cache URL in parallel
    await Promise.all([
        File.updateOne({ _id: file._id }, { $inc: { downloadCount: 1 } }),
        publicUrlCache.set(cacheKey, downloadUrl)
    ]);

    res.status(200).json({ url: downloadUrl });
});
```

___

### addressed:

- **Scalability:** By replacing unbounded arrays (`sharedWith`, `attendanceRecords`) with new collections.
    
- **Security:** By implementing the `context` field as a hard security boundary and defining a "Zero Trust" audit plan.
    
- **Usability:** By adding a "Recycle Bin," "File Previews," and "Asynchronous Zipping".
    
- **Robustness:** By defining the "System-Managed Materials" and "Dedicated Workspace" workflows.
