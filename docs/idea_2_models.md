The "System-Manages Materials" and "Dedicated Workspace" (with lazy provisioning and permission-flipping) as right professional-grade solutions.

Below are the current relevant models used in the application which might be relevant for the features with suggestions on how they can be improved.

identified and fixed a few critical bottlenecks and inconsistencies.

## `fileModel.js` (Modifications)

This model needs to be upgraded to support the Recycle Bin, Search, and Context-Awareness workflows.

```js
import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({
    
    // --- Core Fields ---    
    user: { // The user who owns/uploaded the file
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
        index: true
    },
    fileName: { // The original name of the file
        type: String,
        required: true,
        trim: true
    },
    s3Key: { // The unique key for the file in the S3 bucket
        type: String,
        required: true,
        // unique: true  // removed to reduce overhead
    },
    size: { // File size in bytes
        type: Number, 
        required: true
    },
    fileType: { // The MIME type of the file, e.g., 'image/jpeg'
        type: String,
        required: true
    },
    
    // --- NEW: Context & Description ---
    description: { // For adding context to Subject Material folders
        type: String,
        trim: true,
        maxlength: 500
    },
    context: {
        type: String,
        enum: ['personal', 'academic_material', 'assignment'], // 'assignment' covers both master and draft folders
        default: 'personal',
        required: true,
        index: true // CRITICAL for performance
    },
    // --- NEW: Recycle Bin Fields ---
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    deletedAt: { // For the 15-day purge cron job
        type: Date,
        default: null
    },
    
    // --- Folder Structure ---
    isFolder: { type: Boolean, default: false },
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'File', // Self-referencing relationship
        default: null, // null = in root directory
        index: true
    },
    // --- Path Enumeration for Efficient Hierarchy Queries ---
    path: {
        type: String,
        index: true // CRITICAL for performance
    },
    // --- Analytics & Metadata ---
    downloadCount: { type: Number, default: 0 },
    tags: [{ type: String, trim: true }],
    // --- Status & Sharing ---
    status: {
        type: String,
        enum: ['available', 'processing', 'archived', 'error'],
        default: 'available'
    },
    sharedWith: [{ // Array of users this file is shared with
		user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		expiresAt: { type: Date, default: null } // null means no expiration
    }],
    publicShare: {
        code: {
            type: String,
            unique: true,
            sparse: true, // Allows multiple documents to have a null 'code'
            index: true   // For fast lookups
        },
        isActive: { type: Boolean, default: false },
        expiresAt: { type: Date }
    },
	sharedWithClass: { // For sharing with an entire class dynamically
	// This is not an unbounded array. It's a small, fixed-size object 
		subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
		batch: { type: Number },
		semester: { type: Number },
		section: { type: String }
	}
}, { timestamps: true });

// --- NEW: Index for Unique Naming ---
// Enforces that for any document where isDeleted: false,
// the combination of parentId and fileName must be unique.
fileSchema.index(
    { parentId: 1, fileName: 1, isDeleted: 1 }, 
    { 
        unique: true, 
        partialFilterExpression: { isDeleted: false } 
    }
);

// --- NEW: Index for Search ---
// Creates a text index on fileName to power the search endpoint
fileSchema.index({ fileName: 'text' });


const File = mongoose.model("File", fileSchema);
export default File;
```

We need to add two fields. The `context` field which is our primary security and separation mechanism.

This model needs to be upgraded to support the Recycle Bin, Search, and Context-Awareness workflows.

**Reasoning:**

- **Recycle Bin:** We need to add `isDeleted` and `deletedAt` fields to enable soft-deleting.
    
- **Context:** The `context` and `description` fields are required by the "Architectural Foundation".
    
- **Unique Naming:** To enforce your "Unique Naming" rule, a partial unique index is the most robust solution. It enforces `fileName` uniqueness _only_ for active files within the same folder.
    
- **Search:** To support your "Search Functionality", we should add a `text` index to `fileName`.


- **Critique:** The `sharedWith: []` array is an **unbounded array**. This is a well-known scalability anti-pattern. (High Priority):** Change this from an embedded array to a separate collection. This is the standard solution.
    
**New Collection: `FileShares`**

```js
const fileShareSchema = new mongoose.Schema({
	fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: true },
	userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
	expiresAt: { type: Date, default: null }
});
// Create indexes for fast lookups
fileShareSchema.index({ fileId: 1, userId: 1 }, { unique: true });
fileShareSchema.index({ userId: 1, fileId: 1 });
```

Removing the `sharedWith` array from `fileModel`.


Final permission query (in `item.controller.js`) would simply be:

```js
// 1. Get the list of file IDs explicitly shared with the user
const sharedFileIds = await FileShare.find({ userId: req.user._id }).select('fileId');

// 2. Find all files the user can see
const files = await File.find({
  isDeleted: false,
  parentId: targetParentId, // The folder they are looking in
  $or: [
    // 1. They own the file
    { user: req.user._id }, 
    
    // 2. The file is in the list of files shared with them
    { _id: { $in: sharedFileIds.map(s => s.fileId) } },

    // 3. The file is shared with their class
    { 
      'sharedWithClass.batch': req.user.studentDetails.batch,
      'sharedWithClass.semester': req.user.studentDetails.semester,
      'sharedWithClass.section': req.user.studentDetails.section
    }
  ]
});
```

## `subjectModel.js`

> The subject model should be able to give info if the given subject is elective or not.
> Since subject code kind of handles the year and versions of subjects, it can be kept as is.

> Some improvemnts needed to allign it with the time table data extraction.

```js
const subjectSchema = new mongoose.Schema({
    name: { type: String, required: true },
    subjectCode: { type: String, required: true, unique: true },
    semester: { type: Number, required: true },
    department: { type: String, required: true },
    
    // --- NEW ---
    isElective: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });
```

### `classSessionModel.js`

Represents a single class, controlling the attendance window and recording student presence.

```js
import mongoose from "mongoose";

const classSessionSchema = new mongoose.Schema({
    subject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: true,
    },
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    type: {
        type: String,
        enum: ['Theory', 'Lab'],
        required: true,
    },
    batch: {
        type: Number,
        required: true
    },
    semester: {
	    type: Number,
	    required: true,
    },
	section: {
        type: String,
        enum: ['A', 'B'],
        required: true,
    },    
    startTime: {
        type: Date,
        default: Date.now,
    },
    attendanceCode: { // A random 8-digit generated number
        type: String,
    },
    attendanceWindowExpires: {
        type: Date,
    },

    attendanceRecords: [{
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        status: {
            type: Boolean,
            default: false 
        },
        hasSubmittedFeedback: {
            type: Boolean,
            default: false
        },
        feedbackSubmittedAt: { type: Date }
    }],
}, { timestamps: true });

// Indexing for fetching classes by subject or teacher
classSessionSchema.index({ subject: 1, createdAt: -1 });
classSessionSchema.index({ teacher: 1, createdAt: -1 });

const ClassSession = mongoose.model("ClassSession", classSessionSchema);
export default ClassSession;
```

New Collection: `attendanceRecords`

```js
const attendanceRecordSchema = new mongoose.Schema({
	session: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassSession', required: true },
	student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
	status: { type: Boolean, default: false },
	hasSubmittedFeedback: { type: Boolean, default: false },
	feedbackSubmittedAt: { type: Date }
}, { timestamps: true });
// Indexes for querying by student or by session
attendanceRecordSchema.index({ session: 1, student: 1 }, { unique: true });
attendanceRecordSchema.index({ student: 1, session: 1 });
```
    
You would then remove the `attendanceRecords` array from `classSessionModel`.
    

## `userModel.js`

To avoid all future confusion, renaming the sub-schema inside `userModel.js` to `teachingAssignmentSchema`.

```js
import mongoose from "mongoose";

// --- Rename this schema for clarity ---
const teachingAssignmentSchema = new mongoose.Schema({
    subject: { 
	    type: mongoose.Schema.Types.ObjectId, 
	    ref: 'Subject', 
	    required: true },
    batch: { type: Number },
    semester: { type: Number },
    sections: [{ type: String }], // e.g., ['A', 'B']
});


const userSchema = mongoose.Schema(
  {
    name: { 
      type: String, 
      required: [true, 'Name is required'], 
    },
    email: { 
      type: String, 
      required: [true, 'Email is required'], 
      unique: true, 
      lowercase: true, 
      match: [/.+\@.+\..+/, 'Please enter a valid email'],
    },
    password: { 
      type: String,
      required: [true, 'Password is required'], 
      minlength: 8,
    },
    avatar: { type: String },
    bio: { type: String },
    preferences: {
      theme: { type: String, default: 'light' },
      isDiscoverable: { type: Boolean, default: true },
      canRecieveMessages: { type: Boolean, default: true },
      canRecieveFiles: { type: Boolean, default: true },
    },

    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false }, // for Mmail Verification
    emailVerificationToken: String,
    emailVerificationExpires: Date,

    passwordResetToken: String,
    passwordResetExpires: Date,
    passwordResetOn: Date,

    lastLoginAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockoutExpires: { type: Date },

    googleId: { 
      type: String, 
      unique: true, 
      sparse: true 
    },
    aiGenerations: {
      count: { type: Number, default: 0 },
      lastReset: { type: Date, default: () => new Date() },
    },
    roles: {
      type: [String],
      enum: [ 'user' ,'student', 'teacher', 'admin', 'hod'],
      default: ['user'],
      required: true,
    },

    // --- Role-Specific Details ---
    studentDetails: {
      usn: { type: String, unique: true, sparse: true }, // University Seat Number
      applicationStatus: {
        type: String,
        enum: ['not_applied', 'pending', 'approved', 'rejected'],
        default: 'not_applied'
      },
      isStudentVerified: { type: Boolean, default: false },

      section: { type: String, enum: ['A', 'B', 'C'] },
      batch: { type: Number },
      semester: { type: Number },
      enrolledSubjects: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Subject' }],
    },
    
    teacherDetails: {
      staffId: { type: String, unique: true, sparse: true },
      department: { type: String },
      assignments: [teachingAssignmentSchema],
    },
  }, 
  { timestamps: true }
);

userSchema.index({ role: 1 });

const User = mongoose.model("User", userSchema);
export default User;
```
    
1. `teachingAssignmentSchema` (in `userModel.js`): This is a **Teaching Load Schema**. It defines _what_ a teacher is assigned to teach (e.g., "Data Structures, Sem 3, Sec A & B"). This is the schema "System-Managed Materials" workflow will use to grant teachers write-access.
	
2. `assignmentModel.js` (New Model): This is a **Deliverable Schema**. It defines a _specific task_ (e.g., "Homework 1: Linked Lists") created by a teacher _for_ one of their classes.

Changing `role` (string) to `roles` (array of strings): `roles: { type: [String], enum: [...], default: ['user'] }`.     
- To let user to be both a `teacher` and a `hod`, or any other combination. 
* `hasRole` middleware (`role.middleware.js` from original context) would just check if `req.user.roles.includes(roleToCheck)`.

## `assignmentModel.js` (new Model)

This model stores the "metadata" for the assignment.

- **Reasoning:** When a teacher creates an assignment, they select one of their _Teaching Assignments_. The controller should then **copy** the `subject`, `batch`, `semester`, and `sections` into the new `Assignment` document.
    
```js
import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    deadline: { type: Date, required: true },
    isVisible: { type: Boolean, default: false, index: true }, // For your "toggle"
    
    // --- Context & Ownership ---
    teacher: { // The Teacher who created and owns this
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    subject: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Subject', 
        required: true 
    },
    batch: { type: Number, required: true },
    semester: { type: Number, required: true },
    sections: [{ type: String }], // e.g., ['A', 'B']

    // --- File System Link ---
    // The "root" folder for this assignment, owned by the teacher
    masterFolderId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'File', 
        required: true 
    },
}, { timestamps: true });

// For fast lookups by teachers or students
assignmentSchema.index({ teacher: 1, subject: 1 });
assignmentSchema.index({ batch: 1, semester: 1, sections: 1, isVisible: 1 });

const Assignment = mongoose.model("Assignment", assignmentSchema);
export default Assignment;
```

#### `assignmentSubmissionModel.js` (New Model)

This is the "join table" that links a Student to an Assignment and tracks their status.

Key to the "Dedicated Workspace" and "Lazy Provisioning" workflows.

- lazy provisioning, meaning the `draftFolder` and this `AssignmentSubmission` document are created on the student's _first click_. This means the default `status` must be `'draft'`.
    
- This model will now track the _entire lifecycle_ of the submission, from draft to final.
    
```js
import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema({
    assignment: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Assignment', 
        required: true 
    },
    student: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    status: {
        type: String,
        // --- 'draft' as the entry point ---
        enum: ['draft', 'submitted', 'rejected'],
        default: 'draft'
    },
    rejectionMessage: { type: String, trim: true },

    // --- This should be nullable and set by the controller ---
    submittedAt: { 
        type: Date, 
        default: null // Set this timestamp *only* when status flips to 'submitted'
    },
    
    // --- File System Link ---
    // The student's personal submission folder (e.g., "12345-John-Doe")
    // "Links to the student's submission folder, which is owned by the student during the 'draft' phase."
    submissionFolderId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'File', 
        required: true 
    }
}, { timestamps: true });

// This index is correct and critical
// A student can only have ONE submission record per assignment.
submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });

const AssignmentSubmission = mongoose.model("AssignmentSubmission", submissionSchema);
export default AssignmentSubmission;
```

This ensures the developer who implements this will build the correct permission-flipping logic.

If the teacher owns it from the start, the student cannot upload files to it, and the "permission flip" makes no sense.


#### `notificationModel.js` (New Model)

As planned, this will be triggered by the other workflows.

To support "batching/de-bouncing" notification plan.

- To batch notifications (e.g., "5 files added to 'Data Structures'"), the system needs to know _what entity_ the notifications are about. Adding an `entity` field allows to group all notifications for the same `assignment` or `File` (folder) before sending them.
    
- It also makes the `link` field more programmatic and reliable.
	
```js
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    user: { // The user to notify
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true, 
        index: true 
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String }, // This can now be auto-generated from the entity
	// e.g., /academics/assignments/123abc
    isRead: { type: Boolean, default: false },
    type: {
        type: String,
        enum: ['new_material', 'new_assignment', 'assignment_rejected', 'deadline_approaching', 'general']
    },

    // --- NEW: Entity fields for grouping, batching, and linking ---
    entity: {
        model: { type: String, enum: ['Assignment', 'File', 'User'] },
        id: { type: mongoose.Schema.Types.ObjectId }
    },
    
    // --- NEW: Field for batching ---
    // Can be used by "robust fix" to aggregate actions
    actionCount: { 
        type: Number,
        default: 1
    },
    
    // Auto-delete notifications after 30 days to keep the collection clean
    expiresAt: { 
        type: Date, 
        default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 
        index: true 
    }
}, { timestamps: true });

// This TTL (Time-To-Live) index automatically deletes documents
// when their 'expiresAt' time is reached.
notificationSchema.index({ "expiresAt": 1 }, { expireAfterSeconds: 0 });

// --- NEW: Index to find unread notifications for a user ---
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
```
