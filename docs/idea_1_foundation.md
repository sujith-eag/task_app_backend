This plan outlines the definitive workflows for the "Academics" features, building upon the core file system.

### Architectural Foundation

The core architecture is a specialized, curated layer built on top of the existing `File` model. This is not a separate file system, but a _context-aware_ view with special rules, ownership, and permissions. This is achieved by introducing a `context` field (e.g., `'personal'`, `'academic_material'`, `'assignment'`) to the `File` model, creating a hard separation between a user's "My Files" and all academic files.

---

### Part 1: Prerequisite File System Enhancements

Before implementing academic features, the base `File` and `Folder` logic must be finalized.

1. **Nesting Limit:** A 2-level nesting limit will be enforced on all folders. The API will reject the creation of any folder whose `parentId` is already 2 levels deep.

2. **Folder Download (as Zip):** The bulk download functionality will be extended to support folders. Using a `folderId`, the backend will recursively find all descendant files, stream them from S3, and package them into a zip archive that maintains the original folder hierarchy.

  3. **Optimized Permission Model:**
	- **Explicit Permissions:** Folder sharing permissions (e.g., `sharedWithClass`) are applied explicitly to the _root folder_ being shared.
    - **Access Inheritance:** When a user accesses that shared root folder, they are granted implicit access to _all_ its descendants.
	- **Performance:** This model is highly performant. To find what a student can see, the system queries for folders that match their class (`sharedWithClass: ...`), rather than performing costly recursive permission checks on every file.


#### Recycle Bin Workflow

A much more robust and standard **Recycle Bin** system.

1. **"Soft Delete":** When a user "deletes" a file or folder, `File.findByIdAndDelete()` is not called. Instead, flag is set: `isDeleted: true` and `deletedAt: new Date()`. The system finds `Folder A` _and all its descendants_ (files and folders) using the `path` attribute (e.g., `path: { $regex: ... }`).
	- This instantly removes the entire tree from the user's view and moves it to the "Trash," which is the behavior users expect. Your "Restore" operation would then do the same in reverse (recursively setting `isDeleted: false`).	

2. **Filter Queries:** _All_ of your file-browsing endpoints (like `getUserFiles`) **must** be updated to only show items where `isDeleted: false`.  
	
3. **"Trash" View:** You create a new endpoint (e.g., `GET /api/files/trash`) that shows only items where `isDeleted: true`.
	
4. **Restore/Permanent Delete:** From the trash view, you can provide two new endpoints:
	
	- `POST /api/files/:id/restore`: Sets `isDeleted: false`.
		
	- `DELETE /api/files/:id/permanent`: _This_ is when you actually delete the file from S3 and the database. Can also add a cron job to automatically purge items from the trash after 15 days.

#### Recycle Bin Edgecase

Two edge cases to handle in recycle bin:

- **A. Orphaned Items:** A user deletes `Folder A` and _then_ deletes its child, `File B`. Both are in the trash. What happens if the user restores _only_ `File B`? Where does it go?
    
    - **The Problem:** Its original parent (`Folder A`) is still in the trash.
        
    - **The Solution:** When restoring an item, check if its `parentId` still exists (i.e., is _not_ `isDeleted: true`). If the parent is missing, restore the item to the user's **root directory** (`parentId: null`).
        
- **B. Cron Job Logic:** Your plan to purge files after 15 days is perfect.
    
    - **Clarification:** The cron job must do two things:
        
        1. Find all documents where `isDeleted: true` and `deletedAt` is older than 15 days.
            
        2. For each file, delete its object from the S3 bucket.
            
        3. After S3 deletion, _permanently_ delete the documents from the MongoDB collection (`deleteMany`).
            

#### Moving folders

Check nesting on _creation_ and also when **moving** a folder, must _also_ enforce your other core business rules.

- **The Risk:** A user could create `Folder A` (level 1) and, inside it, `Folder B` (level 2). Separately, they create `Folder C` (level 1). They could then _move_ `Folder B` (which is already 2 levels deep) into `Folder C`, resulting in a 3-level-deep structure (`C/A/B`) that bypasses your creation-time check.

    `if (depth(destinationFolder) + depth(folderToMove) > 2) { ... throw Error }`

- **Enforce Context:**  **must** add a check to prevent context-crossing. This is a critical security boundary.

- Security Hole: The "Move" Controller vs. Academic Folders :
    `moveItem` controller correctly blocks moving _personal_ files _into_ academic contexts. But what stops a student from moving their `draftFolder` (which they own) _out_ of the `masterFolder` and into their "My Files" root? This would break the entire assignment workflow.

```js
// Inside moveItem controller
const itemToMove = await File.findById(itemId);
const newParent = await File.findById(newParentId);

const itemContext = itemToMove.context;
// If newParentId is null, it's the root, which is 'personal'
const destinationContext = newParent ? newParent.context : 'personal';

if (itemContext !== destinationContext) {
	res.status(403);
	throw new Error('Action forbidden: Cannot move items between personal and academic contexts.');
}

// NEW RULE: Prevent academic items from EVER being moved.
if (itemToMove.context === 'academic_material' || itemToMove.context === 'assignment') {
	res.status(403);
	throw new Error('Academic folders and files cannot be moved.');
}

```
    

- **Define Share-on-Move Logic:** What happens when a user moves a _shared_ folder into a _private_ one?
    
    - **Problem:** User shares `Folder A`. Then they move `Folder A` into their private `Folder B`. Can shared users still see `Folder A`?
        
    - **Recommendation:** Yes. An item's share settings (`sharedWith`, `sharedWithClass`) are _explicit_ and should not be changed by a move. Moving an item only changes its `parentId` and `path`, not its permissions. This is the most intuitive behavior for users.

##### Critical Security & Logic Checks for "Move"

In "Optimized Permission Model" the `item.controller.js` query _contradicts_ it.

- **The Problem:** Current `getUserFiles` query checks for `parentId` _and_ share permissions on the _same item_. This means if `Folder A` is shared with a class, and `File B` is inside it (but not _itself_ shared), a student browsing into `Folder A` **will not see `File B`**.

1. A user requests items in a folder (e.g., `GET /api/files/items?parentId=...`).
	
2. **Step A: Check Parent Access.**
	
	- If `parentId` is `null` (root directory), proceed.
		
	- If `parentId` exists, fetch the `parentFolder` first.
		
	- Run a permission check: Does the user own this `parentFolder` OR is it shared with them (via `sharedWith` or `sharedWithClass`)?
		
	- If **no**, return a `403 Forbidden` error. They aren't allowed to even _look_ inside this folder.
		
3. **Step B: Fetch Children.**
	
	- If access to the parent is granted, you can _trust_ they are allowed to see its contents.
		
	- **If `parentId` is `null` (Root View):** Run your big query to find all root items they own OR are shared with them: `query = { parentId: null, $or: [ { user: ... }, { 'sharedWith.user': ... }, { 'sharedWithClass': ... } ] }`
		
	- **If `parentId` is NOT `null` (Inside a Folder):** The query becomes _much_ simpler. You've already verified parent access, so you just show _everything_ inside it: `query = { parentId: parentId, isDeleted: false }`
		
#### Asynchronous Zipping for Large Folders

Current plan to stream a zip file, but it will fail for large folders (e.g., 5GB). The HTTP request will time out, and it will put a heavy load on API server.

- **The Scalable Workflow:**
    
    1. User clicks "Download Folder."
        
    2. The API immediately returns a `202 Accepted` response: "Your download is being prepared. You will be notified."
        
    3. This API call adds a "zip job" to a **queue** ( RabbitMQ, or a simple "Jobs" collection in MongoDB).
        
    4. A **separate worker process** (not main API server) picks up this job.
        
    5. The worker does the heavy lifting: streams files from S3, zips them, and uploads the _final zip file_ to a temporary S3 location.
        
    6. When complete, the worker creates a **Notification** for the user with a pre-signed download link to that single zip file.

	file is removed from s3 after a certain time period.

- **Benefit:** This is how systems like Google Drive and WeTransfer handle large zips. It's asynchronous, scalable, and doesn't crash server.
    

#### File Previews (Not Just Downloads)

`s3.service.js` uses `getSignedUrl` to force a _download_ (`Content-Disposition: attachment`). This is great for most files but bad for images or PDFs that the user just wants to _see_.

- **The Fix:** A _second_ function in `s3.service.js` called `getPreviewUrl()`.
    
- This new function would be identical to `getSignedUrl`, but it would **omit** the `ResponseContentDisposition` parameter.
    
- The browser will then try to _render_ the file (if it's an image, PDF, text file, etc.) instead of downloading it. This is a massive user experience improvement.
    
* Both the option can be shown for a user when they have single file, if they want to preview it or download. (some restrictions on files which are not preview supported on browsers).


#### Missing Rule: Enforce Unique Naming Everywhere

`upload.controller.js` is smart and handles file-naming collisions by appending `(1)`. This logic is missing from your other controllers, which will cause errors.

You must apply this same "unique name check" to:

- **`folder.controller.js` (`createFolder`):** A user cannot create `New Folder` if `New Folder` already exists _in that same parent directory_.
    
- **`folder.controller.js` (`moveItem`):** A user cannot move `report.pdf` into a folder that _already contains_ a file named `report.pdf`.
    
- **Rename Operation (New Feature):** When you eventually add a "Rename" feature, it must also perform this check.
    

The rule is: **An item's `fileName` must be unique _within its `parentId`_.** Your logic should check for a collision and either throw an error or automatically rename the item (e.g., `New Folder (1)`).


#### Implement Search Functionality

- Create a new endpoint: `GET /api/files/search?q=...`
    
- This controller would perform a query like:

```js
const searchRegex = new RegExp(req.query.q, 'i'); // Case-insensitive regex

const files = await File.find({
	fileName: searchRegex,
	isDeleted: false,
	$or: [ // Must still respect permissions!
		{ user: req.user._id },
		{ 'sharedWith.user': req.user._id },
		{ 'sharedWithClass.batch': ... }
	]
});
```

A powerful way for users to find their files across all folders. Add a database index to the `fileName` field to keep this fast.


---

### Part 2: "Academics" Hub Workflow

This is the central navigation point for all academic modules.

1. **Access:** Users with an academic role (e.g., "student", "teacher") will see a primary "Academics" navigation item.
    
2. **Dashboard:** Clicking this item leads to a dashboard, which acts as the main container for two distinct modules:
    
    - **Subject Materials**
        
    - **Assignments**
        
---

### Part 3: Module 1: Subject Materials Workflow

This module will be a **system-managed** repository for class materials, ensuring data permanence and removing management overhead from teachers.

1. **Phase 1: Provisioning (Admin/HOD Workflow)**
    
    - An Admin or HOD assigns a teacher to a subject for a specific class (e.g., "Teacher A" -> "Data Structures, Sem 3, Sec B").
        
    - This action triggers an automated system event.
        
2. **Phase 2: Folder Creation (System Workflow)**
    
    - The system _automatically_ creates a new **Folder** (a `File` document).
        
    - **Owner:** The folder's `user` (owner) is set to a special "admin" or "Department" account, _not_ the teacher. This ensures data permanence if the teacher leaves.
        
    - **Context:** The folder's `context` is set to `'academic_material'`.
        
    - **Permissions:** The folder's `sharedWithClass` field is populated with the class details (subject, batch, semester, section).
        
    - **Teacher Access:** The assigned teacher(s) are granted _write access_ to this folder. When a teacher attempts to modify content _within_ an academic folder:
        1. Check the folder's `context`. It must be `'academic_material'`.
            
        2. Check the folder's `sharedWithClass` details (e.g., `subject`, `batch`).
            
        3. Check the `req.user.teacherDetails.assignments` array.
            
        4. **Allow** the operation only if the teacher is officially assigned to teach the class associated with that folder. This re-uses your existing data model, requires no new permissions tables, and is extremely secure.
            
        
3. **Phase 3: Management (Teacher Workflow)**
    
    - The Teacher navigates to "Academics" -> "Subject Materials".
        
    - They see the pre-provisioned folders for all classes they are assigned to.
        
    - They can enter a folder and have full permissions: create sub-folders, upload files, and delete files.
        
    - Any file or folder created _inside_ this root folder will automatically inherit the `context: 'academic_material'` and the `sharedWithClass` properties from its parent.
        
4. **Phase 4: Consumption (Student Workflow)**
    
    - The Student navigates to "Academics" -> "Subject Materials".
        
    - The UI queries for all folders where the `sharedWithClass` details match the student's `studentDetails`.
        
    - The student has **read-only access**.
        
    - **Allowed Actions:** Browse files/folders, view descriptions, check `updatedAt` timestamps, download individual files, and download entire folders as a zip.
        
    - **Forbidden Actions:** All UI for uploading, deleting, renaming, and sharing is hidden.
        

---

### Part 4: Module 2: Assignments Workflow

This module uses the **"Dedicated Workspace"** model, providing a secure, non-destructive, and auditable workflow for submissions.

1. **Phase 1: Creation (Teacher Workflow)**
    
    - The Teacher navigates to "Academics" -> "Assignments" and clicks "Create New Assignment".
        
    - They fill out a form with: Title, Description, Deadline, Class, and a "Visible to Students" toggle.
        
    - On submit, the system performs two actions:
        
        1. Creates an `Assignment` metadata document.
            
        2. Creates a corresponding `masterFolder` in the `File` collection, owned by the **Teacher** and marked with `context: 'assignment'`.
            
2. **Phase 2: Provisioning (System Workflow)**
    
    - The moment the assignment is created (or made visible), the system queues a job.
        
    - The job iterates through every enrolled student in the target class.
        
    - **"Lazy Provisioning"**:
        1. **Do not** create any `draftFolder`s inside `masterFolder` when the assignment is created.
        2. When a student clicks on an assignment _for the first time_, the API checks if an `AssignmentSubmission` (and corresponding `draftFolder`) exists for them.
        3. If it doesn't, the system creates the `draftFolder` and the `AssignmentSubmission` record _at that moment_ (just-in-time).
        4. This spreads the load and ensures only creates folder for students who actually engage with the assignment.
        
    - **Critical:** This `draftFolder` is owned by the **Student** (`user: student._id`) but retains the `context: 'assignment'`.
        
3. **Phase 3: Work (Student "Draft" Workflow)**
    
    - The Student sees the new assignment in their "Assignments" list.
        
    - Clicking it directs them into their personal `draftFolder`.
        
    - The student has full **read/write/delete access** _only_ within this folder. They can add, edit, and delete their files as needed before the deadline.
        
    - The Teacher's dashboard (`"Submissions: 0 / 60"`) does not count this "draft" state. The API for teachers to view submissions will _only_ show folders they own (i.e., submitted ones).
        
4. **Phase 4: Submission (Student "Transaction" Workflow)**
    
    - Inside their draft folder, the student sees a "Submit Assignment" button.
        
    - When clicked, the system performs a **"permission flip"**:
        
        1. It finds the student's `draftFolder`.
            
        2. It updates the folder's `user` (owner) field from the `student._id` to the `teacher._id`.
            
        3. It creates the `AssignmentSubmission` document to log this event, setting `status: 'submitted'`.
            
    - The student _immediately_ loses write access to their folder; it becomes read-only. The teacher _gains_ full access.
        
5. **Phase 5: Review (Teacher Workflow)**
    
    - The Teacher's dashboard count updates ("Submissions: 1 / 60").
        
    - They can now click the student's name to open the folder (which they now own) and review the files.
        
    - If the submission is unsatisfactory, the teacher clicks **"Request Resubmission"**.
        
6. **Phase 6: Resubmission (System "Transaction" Workflow)**
    
    - The system **does not delete any files**, preserving the submission history.
        
    - It updates the `AssignmentSubmission` document's `status` to `'rejected'`.
        
    - It performs a **"permission flip" back**: It updates the folder's `user` (owner) field from the `teacher._id` back to the `student._id`.
        
    - The student is notified, regains write access to their folder (with all their original files intact), and can resume work from Phase 3.
        
- API controllers must enforce the deadline.
	
	1. **On `uploadFile` (or a dedicated `uploadToDraftFolder`):** When a student uploads a file, the API must check the `draftFolder`'s parent `Assignment` and its `deadline`. If `new Date() > assignment.deadline`, reject the upload.
		
	2. **On `submitAssignment`:** The "permission flip" controller must _also_ check the deadline. You may _choose_ to allow late submissions (and flag them as such), but the API _must_ be aware of the deadline to make this decision.

---

### Part 5: Module 3: Notifications Workflow

This module is a set of event-driven triggers initiated by the workflows above.

1. **New Assignment:** When an `Assignment` is created or its `isVisible` flag is set to `true`, the system will generate a notification for all students in the target class.
    
2. **New Material:** When a `File` is successfully uploaded into a folder with `context: 'academic_material'`, the system will generate a notification for all students in that folder's `sharedWithClass`.
    
3. **Submission Rejected:** When a teacher "Requests Resubmission," the `AssignmentSubmission` status change triggers a notification for the _single_ student involved. and "notification" sections.]
    
4. **Deadline Approaching:** A daily scheduled job will query for all visible assignments with a deadline in the next 24 hours. It will then cross-reference with `AssignmentSubmission` records and send a reminder notification to all students who have not yet submitted.

- **Batch or "debounce" notifications.**
	
	1. When a teacher uploads files, create _one_ notification that says, "Your teacher added 50 files to 'Data Structures'." instead of a notification storm of 50 separate notifications.
		
	2. **Robust fix:** When a file is uploaded, add a "notify-class-X" job to a queue with a 10-minute delay. If another file is uploaded in that 10 minutes, reset the timer. After 10 minutes of no activity, a single job runs, aggregates all changes ("Teacher added 5 files and deleted 1 file"), and sends _one_ summary notification.



### Final Missing Implementation Logic

Key mechanisms that are mentioned but not fully designed.

- **1. The `path` Field Maintenance (Critical)**
    
    - **Problem:** Plan for nesting limits and recursive deletes _relies_ on the `path` field in `fileModel.js`. This field does not update itself; you must implement this logic.
        
    - **Solution:**
        
        - **On `createFolder`:** When creating a new folder, you must fetch its `parentFolder`. The new folder's path will be: `newPath = parentFolder.path + parentFolder._id + ','`.
            
        - **On `moveItem`:** When you move `Folder A` into `Folder B`, you must run a recursive update to fix the `path` for _all_ of `Folder A`'s descendants.
            
- **2. Asynchronous Job Parameters**
    
    - **Problem:** The API adds a "zip job" to a queue. The worker picks it up. But how does the worker know _who_ to send the notification to? The worker is a separate process and has no `req.user`.
        
    - **Solution:** When the API adds the job to the queue, the job's payload _must_ include the user ID.
        
    - **Job Payload:** `{ folderIdToZip: '...', userIdToNotify: '...' }`
        
    - The worker then performs the zip, uploads it to S3, and finally uses the `userIdToNotify` to create the `Notification` document.
        
- **3. The "Rename" Feature Logic**
    
    - **Problem:** You noted "Rename" is a missing feature.
        
    - **Solution:**  `fileModel`'s partial unique index will _automatically_ enforce "unique naming" rule.
        
    - **Controller (`PATCH /api/files/:id/rename`):**
        
        1. Get the `fileId` and the `newName` from the request.
            
        2. Find the file: `const file = await File.findById(fileId);`.
            
        3. Check permissions: `if (file.user.toString() !== req.user.id) ...`
            
        4. Update the name: `file.fileName = newName; await file.save();`
            
        5. The database will _automatically_ throw an error if a file with that name already exists in that `parentId`, thanks to your index. You just need to catch that error and send a clean "A file with that name already exists" message to the user.
            
- **4. The "Permission-Flip" Implementation (Final Confirmation)**
    
    - **Problem:** The `AssignmentSubmission` workflow in `idea_2.md` (Part 4) is complex.
        
    - **Solution:** Your plan is 100% correct. The controller logic for the "permission flip" will look like this, using the `status` from your `assignmentSubmissionModel`:
        
    
**On `submitAssignment`:**

```js
// 1. Find the student's submission record (which is in 'draft' status)
const submission = await AssignmentSubmission.findOne({ ... });

// 2. Find the draft folder (owned by student)
const draftFolder = await File.findById(submission.submissionFolderId);

// 3. Find the assignment to get the teacher's ID
const assignment = await Assignment.findById(submission.assignment);

// 4. *** THE PERMISSION FLIP ***
draftFolder.user = assignment.teacher; // Flip ownership to the teacher
submission.status = 'submitted';       // Set status to 'submitted'
submission.submittedAt = new Date();   // Mark submission time

// 5. Save everything in a transaction
await draftFolder.save();
await submission.save();
```
    
This confirms that your models and workflows are perfectly aligned.
    