## Shared Architecture & Patterns

This document covers the architectural patterns, structures, and shared components used across all features in the Eagle Campus application.

---

## 1. Frontend Architecture & File Structure

The frontend follows a modern, highly scalable **"feature folder"** architecture. This structure co-locates all files related to a single feature—pages, components, API services, and state management—into a single, self-contained module, making the application exceptionally easy to maintain and scale.

Each directory within `src/features/` acts as a self-contained module for a specific part of the application, such as `teacher`, `student`, or `admin`. This module encapsulates all the necessary logic and UI components for that feature.

### The Anatomy of a Feature Slice

A typical feature module contains the following directories:

- **`pages/`**: Contains the top-level components that represent the feature's main pages or views, which are then connected to the main application router (e.g., `<AdminDashboardPage />`).

- **`components/`**: Contains all React components that are specific to that feature. These components are not intended to be used outside of their parent feature module. For example, the `teacher` feature contains `<CreateClassForm />` and `<LiveAttendanceRoster />`.

- **`[featureName]Service.js`**: A dedicated file for handling all API communication for the feature. It uses `axios` to make requests to the backend endpoints. For larger features like `admin`, this directory is further organized by domain (e.g., `userService.js`, `subjectService.js`).

- **`[featureName]Slice.js`**: Manages the feature's state using Redux Toolkit. It defines the initial state, asynchronous thunks that call the service functions, and reducers to handle state updates based on the API call's lifecycle (pending, fulfilled, rejected).

### Complete Directory Structure

```
src/
├── app/
│   └── store.js                 # Redux store configuration
├── assets/
│   └── ... (images, svgs)
├── components/                  # Truly GLOBAL, reusable page components
│   │   └── ConfirmationDialog.jsx
│   └── layout/
│       ├── Footer.jsx
│       ├── Header.jsx
│       └── PrivateRoute.jsx
├── context/
│   ├── SocketContext.jsx    # Manages the Socket.IO connection
│   └── ThemeContext.jsx     # Context for light/dark mode
├── features/
│   ├── admin/                   # Everything for admin feature 
│   │   ├── adminService/
│   │   │   ├── index.js
│   │   │   ├── reportingService.jsx
│   │   │   ├── subjectService.jsx
│   │   │   ├── teacherService.jsx
│   │   │   └── userService.jsx
│   │   ├── adminSlice/
│   │   │   ├── adminReportingSlice.jsx
│   │   │   ├── adminSubjectSlice.jsx
│   │   │   ├── adminTeacherSlice.jsx
│   │   │   └── adminUserSlice.jsx
│   │   ├── components/
│   │   │   ├── applications/
│   │   │   │   └── ApplicationReview.jsx
│   │   │   ├── faculty/
│   │   │   │   ├── FacultyManager.jsx
│   │   │   │   ├── TeacherList.jsx
│   │   │   │   └── TeacherAssignmentModal.jsx
│   │   │   ├── reports/
│   │   │   │   ├── AttendanceReport.jsx
│   │   │   │   ├── DetailedFeedbackModal.jsx
│   │   │   │   ├── FeedbackReport.jsx
│   │   │   │   ├── StudentReportDisplay.jsx
│   │   │   │   └── TeacherReportDisplay.jsx
│   │   │   ├── subjects/
│   │   │   │   ├── SubjectManager.jsx
│   │   │   │   ├── SubjectList.jsx
│   │   │   │   └── SubjectModal.jsx
│   │   │   └── users/
│   │   │       ├── EditStudentModal.jsx
│   │   │       ├── ManageEnrollmentModal.jsx
│   │   │       ├── PromoteUserModal.jsx
│   │   │       └── UserManagement.jsx
│   │   └── pages/
│   │       ├── AdminDashboardPage.jsx
│   │       ├── ReportingPage.jsx
│   │       ├── StudentReportPage.jsx
│   │       └── TeacherReportPage.jsx
│   │
│   ├── ai/                      # AI planner feature
│   │   ├── components/
│   │   │   ├── AITaskGenerator.jsx
│   │   │   └── AIPlannerModal.jsx
│   │   ├── aiTaskService.js
│   │   └── aiTaskSlice.js
|	|
│   ├── auth/                    # Authentication feature
│   │   ├── pages/
│   │   │   ├── ForgotPasswordPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── ResetPasswordPage.jsx
│   │   │   └── VerifyEmailPage.jsx
│   │   ├── authService.js
│   │   └── authSlice.js
|	|
│   ├── chat/                    # Real-time chat feature
│   │   ├── components/
│   │   │   ├── ConversationList.jsx
│   │   │   └── ChatWindow.jsx
│   │   ├── pages/
│   │   │   └── ChatPage.jsx
│   │   ├── chatService.js
│   │   └── chatSlice.js
|	|
│   ├── files/                   # File management feature
│   │   ├── components/
│   │   │   ├── ui/              # Dumb, reusable UI components
│   │   │   │   ├── fileUtils.jsx 
│   │   │   │   └── StorageQuota.jsx
│   │   │   └── modals/          # All modals for the file feature
│   │   │       ├── CreateFolderModal.jsx
│   │   │       ├── ManageShareModal.jsx
│   │   │       ├── PublicShareModal.jsx
│   │   │       ├── ShareModal.jsx
│   │   │       └── ShareWithClassModal.jsx
│   │   ├── features/            # Smart components/features
│   │   │   ├── FileList/
│   │   │   │   ├── BulkActionBar.jsx
│   │   │   │   ├── FileActionMenu.jsx
│   │   │   │   ├── FileBreadcrumbs.jsx
│   │   │   │   ├── FileListTabs.jsx
│   │   │   │   ├── FileTable.jsx
│   │   │   │   └── FileTableRow.jsx
│   │   │   └── FileUpload/
│   │   │       └── FileUpload.jsx
│   │   ├── hooks/
│   │   │   └── useFileActions.js  # Hook for dispatching all file-related actions
│   │   ├── pages/
│   │   │   └── FilesPage.jsx
│   │   ├── fileService.js
│   │   └── fileSlice.js
| 	|
│   ├── landing/                 # The landing page feature
│   │   ├── components/
│   │   │   ├── DeveloperSection.jsx
│   │   │   ├── FeaturesSection.jsx
│   │   │   ├── HeroSection.jsx
│   │   │   └── LibrarySection.jsx
│   │   └── pages/
│   │       └── LandingPage.jsx
|	|
│   ├── public/                  # Public-facing features
│   │   ├── pages/
│   │   │   └── PublicDownloadPage.jsx
│   │   ├── publicService.js
│   │   └── publicSlice.js
|	|
│   ├── profile/                 # User profile feature
│   │   ├── components/
│   │   │   ├── PasswordForm.jsx
│   │   │   ├── PreferencesSection.jsx
│   │   │   └── UpdateProfileForm.jsx
│   │   ├── pages/
│   │   │   └── ProfilePage.jsx
│   │   ├── profileService.js
│   │   └── profileSlice.js
|	|
│   ├── student/                 # Student feature
│   │   ├── components/
│   │   │   ├── AttendanceEntry.jsx
│   │   │   ├── FeedbackModal.jsx
│   │   │   ├── MyAttendanceStats.jsx
│   │   │   ├── PastSessionsList.jsx
│   │   │   ├── StudentApplication.jsx
│   │   │   └── StudentProfileCard.jsx
│   │   ├── pages/
│   │   │   └── StudentDashboardPage.jsx
│   │   ├── studentService.js
│   │   └── studentSlice.js
|	|
│   ├── teacher/                 # Teacher feature
│   │   ├── components/
│   │   │   ├── ClassHistory.jsx
│   │   │   ├── CreateClassForm.jsx
│   │   │   ├── FeedbackSummaryModal.jsx
│   │   │   ├── LiveAttendanceRoster.jsx
│   │   │   └── TeacherReflectionModal.jsx
│   │   ├── pages/
│   │   │   └── TeacherDashboardPage.jsx
│   │   ├── teacherService.js
│   │   └── teacherSlice.js
|	|
│   ├── timetable/               # Timetable feature
│   │   ├── components/
│   │   │   ├── SessionModal.jsx
│   │   │   └── TimetableGrid.jsx
│   │   ├── data/
│   │   │   └── sampleTimetable.json
│   │   ├── pages/
│   │   │   └── TimetablePage.jsx
│   │   └── Timetable.jsx
|	|
│   └── tasks/                   # Core task management feature
│       ├── components/
│       │   ├── EditTaskModal.jsx
│       │   ├── SubTaskChecklist.jsx
│       │   ├── SummaryCards.jsx
│       │   ├── TaskActions.jsx
│       │   ├── TaskFilters.jsx
│       │   ├── TaskForm.jsx
│       │   ├── TaskItem.jsx
│       │   └── TaskList.jsx
│       ├── pages/
│       │   └── TaskDashboard.jsx   # Task dashboard for general users
│       ├── taskService.js
│       └── taskSlice.js
│
├── utils/                   # Animation for the landing page
│   └── animations.js
├── App.jsx                  # Main router setup 
├── main.jsx                 # Application entry point
├── theme.js                 # MUI theme definition
└── NotFoundPage.jsx         # General catch-all page
```

### Architectural Benefits

This modular approach ensures that the logic for the **Admin Dashboard**, **Teacher Dashboard**, and **Student Dashboard** are completely separated, preventing code duplication and making the application easier to debug and scale.

- **Role-Based Routing**: The `<PrivateRoute>` component in `src/components/layout/` accepts a `roles` prop. This allows routes in `App.jsx` to be restricted to specific user roles (e.g., `<PrivateRoute roles={['admin', 'hod']}>`), enforcing strict authorization on the frontend.

- **Cross-Slice Communication**: The architecture effectively uses Redux Toolkit's `extraReducers` to allow slices to react to actions from other slices. For example, the `authSlice` updates the user state after a successful action from the `profileSlice`, and the `taskSlice` adds new tasks after a successful save from the `aiTaskSlice`.

- **Real-Time Layer**: A dedicated `SocketContext.jsx` manages the WebSocket connection for the entire application. It attaches authentication tokens and listens for incoming server events, acting as the bridge between the server's real-time events and the Redux state.

- **High-Performance Rendering**: For long lists like the `TaskList`, the application uses an advanced pattern where the parent component renders a list of IDs, and each child item is memoized (`React.memo`) and selects its own data from the Redux store. This prevents the entire list from re-rendering when a single item changes.

---

## 2. Backend Architecture

The backend is organized into a clean, service-oriented architecture with a clear separation of concerns, ensuring that the application is secure and scalable.

### Backend Directory Structure

```
backend/
├── src/
│   ├── api/                           # All API-related logic, organized by feature.
│   │   ├── admin/                     # Handles admin-specific functionalities.
│   │   │   ├── admin.controller.js
│   │   │   └── admin.routes.js
│   │   ├── ai/                        # Logic for AI-powered features.
│   │   │   ├── ai.controller.js
│   │   │   └── ai.routes.js
│   │   ├── auth/                       # Manages user authentication.
│   │   │   ├── auth.controller.js
│   │   │   ├── password.controller.js
│   │   │   └── auth.routes.js
│   │   ├── chat/                       # Real-time chat and messaging.
│   │   │   ├── chat.controller.js
│   │   │   ├── conversation.controller.js
│   │   │   └── conversation.routes.js
│   │   ├── college/                    # Educational domain.
│   │   │   ├── attendence.socket.js
│   │   │   ├── student.controller.js
│   │   │   ├── student.routes.js
│   │   │   ├── subject.controller.js
│   │   │   ├── subject.routes.js
│   │   │   ├── teacher.controller.js
│   │   │   └── teacher.routes.js
│   │   ├── files/                      # Handles all file management logic.
│   │   │   ├── controllers/
│   │   │   │   ├── delete.controller.js
│   │   │   │   ├── download.controller.js
│   │   │   │   ├── item.controller.js
│   │   │   │   ├── share.controller.js
│   │   │   │   └── upload.controller.js
│   │   │   ├── routes/
│   │   │   │   ├── delete.routes.js
│   │   │   │   ├── download.routes.js
│   │   │   │   ├── item.routes.js
│   │   │   │   ├── share.routes.js
│   │   │   │   └── upload.routes.js
│   │   │   ├── academicFile.controller.js
│   │   │   ├── academicFile.routes.js
│   │   │   ├── folder.controller.js
│   │   │   ├── folder.routes.js
│   │   │   ├── public.controller.js
│   │   │   └── public.routes.js
│   │   ├── tasks/                      # Core task management.
│   │   │   ├── task.controller.js
│   │   │   └── task.routes.js
│   │   └── user/                       # Manages user profile operations.
│   │       ├── user.controller.js
│   │       └── user.routes.js
│   │
│   ├── config/                         # Configuration files.
│   │   └── passport-setup.js
│   │
│   ├── connect/                        # External resource connections.
│   │   └── database.js
│   │
│   ├── middleware/                     # Express middleware functions.
│   │   ├── auth.middleware.js
│   │   ├── checkAIDailyLimit.js
│   │   ├── error.middleware.js
│   │   ├── file.middleware.js
│   │   ├── rateLimiter.middleware.js
│   │   ├── role.middleware.js
│   │   ├── storage.middleware.js
│   │   └── validation.middleware.js
│   │
│   ├── models/                    # Mongoose schemas.
│   │   ├── classSessionModel.js
│   │   ├── conversationModel.js
│   │   ├── feedbackModel.js
│   │   ├── fileModel.js
│   │   ├── messageModel.js
│   │   ├── promptModel.js
│   │   ├── subjectModel.js
│   │   ├── taskModel.js
│   │   ├── teacherSessionReflectionModel.js
│   │   └── userModel.js
│   │
│   ├── services/       # Reusable business logic.
│   │    ├── email.service.js
│   │    ├── llm.service.js
│   │    └── s3.service.js
│   └── utils/
│       ├── emailTemplates/
│       │   ├── facultyPromotion.html
│       │   ├── passwordReset.html
│       │   ├── studentApplicationApproved.html
│       │   ├── studentApplicationPending.html
│       │   └── verificationEmail.html
│       └── emailTemplate.js
├── .env
├── package.json
└── server.js                      # Main entry point
```

### Backend Architecture Principles

#### Server Entry Point (`server.js`)
- Initializes Express app and connects to MongoDB
- Uses preloaded `dotenv` configuration (`-r dotenv/config`)
- Mounts all route handlers and global error handler
- Configures Socket.IO server with authentication middleware

#### `src/models/`: Data Blueprint
The models directory serves as the single source of truth for the application's data structure. Each file defines a Mongoose schema that enforces data integrity and defines relationships.

#### `src/middleware/`: Security & Rules Layer
Middleware acts as a gatekeeper for incoming requests:

**Core Security**:
- `auth.middleware.js`: Verifies JWT on all private routes
- `socketAuthMiddleware`: Validates JWT for WebSocket connections
- `role.middleware.js`: Provides additional role-based access control (`isStudent`, `isAdmin`, etc.)
- `rateLimiter.middleware.js`: Protects from brute-force attacks

**Business Rules & Validation**:
- `file.middleware.js`: Multer configurations for file uploads with size/type limits
- `storage.middleware.js`: Enforces role-based storage quotas
- `checkAIDailyLimit.js`: Checks daily AI generation limits
- `errorMiddleware.js`: Global error handler with user-friendly responses
- `validation.middleware.js`: Validates request bodies against Joi schemas

#### `src/services/`: The Service Layer
Abstracts external communications and complex logic:

- `s3.service.js`: All AWS S3 SDK interactions (upload, delete, pre-signed URLs)
- `email.service.js`: Email sending via Nodemailer (verification, password reset)
- `llm.service.js`: Prompt engineering and Google Gemini API communication

#### `src/api/`: The Feature Core
Business logic organized into self-contained feature modules. Each module has its own controllers and routes, co-locating all code related to a single feature.

---

## 3. Shared UI/UX Patterns

### Optimistic UI Updates
- All primary actions (creating, updating, deleting tasks/sub-tasks, sending messages) are handled optimistically
- Synchronous "optimistic" reducer updates UI instantly
- Asynchronous thunk or socket event syncs with backend
- `.rejected` cases revert UI changes if server call fails

### "Undo" Deletion Flow
- Non-blocking pattern for task deletion
- Task removed from UI optimistically
- `react-toastify` notification with "Undo" button (3.5 seconds)
- Server-side deletion scheduled with `setTimeout`
- User can cancel with "Undo" button

### Animations & Transitions
- **Page Content**: `framer-motion` animates landing page sections on scroll
- **List Items**: `TransitionGroup` and MUI `<Collapse>` for smooth list animations

### Centralized Styling & Theming
- **Theme-Aware Design**: Central `theme.js` with light/dark mode palettes
- **Dynamic Theme Toggling**: React Context manages theme mode
- **Global Style Management**: MUI `<CssBaseline />` for consistent base styles

### Client-Side Security & Validation
- **Email Standardization**: Trim and lowercase before sending to backend
- **Password Strength Validation**: Real-time validation with instant feedback
- **Password Visibility Toggle**: Icon button to show/hide password

---

## 4. Core Mongoose Models

### `userModel.js`
Unified model managing all system participants with role-specific data sections:

```js
const assignmentSchema = new mongoose.Schema({
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    batch: { type: Number, required: true },
    semester: { type: Number, required: true },
    sections: [{ type: String }], // e.g., ['A', 'B']
});

const userSchema = mongoose.Schema({
    name: { type: String, required: [true, 'Name is required'] },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 8 },
    avatar: { type: String },
    bio: { type: String },
    preferences: {
      theme: { type: String, default: 'light' },
      isDiscoverable: { type: Boolean, default: true },
      canRecieveMessages: { type: Boolean, default: true },
      canRecieveFiles: { type: Boolean, default: true },
    },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    passwordResetOn: Date,
    lastLoginAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockoutExpires: { type: Date },
    googleId: { type: String, unique: true, sparse: true },
    aiGenerations: {
      count: { type: Number, default: 0 },
      lastReset: { type: Date, default: () => new Date() },
    },
    role: {
      type: String,
      enum: ['user', 'student', 'teacher', 'admin', 'hod'],
      default: 'user',
      required: true
    },
    // Role-Specific Details
    studentDetails: {
        usn: { type: String, unique: true, sparse: true },
        applicationStatus: {
            type: String,
            enum: ['not_applied', 'pending', 'approved', 'rejected'],
            default: 'not_applied'
        },
        isStudentVerified: { type: Boolean, default: false },
        section: { type: String, enum: ['A', 'B', 'C'] },
        batch: { type: Number },
        semester: { type: Number },
        enrolledSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    },
    teacherDetails: {
      staffId: { type: String, unique: true, sparse: true },
      department: { type: String },
      assignments: [assignmentSchema],
    },
}, { timestamps: true });
```

### `taskModel.js`
```js
const subTaskSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true },
  completed: { type: Boolean, default: false },
}, { timestamps: true });

const taskSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  dueDate: { type: Date },
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  status: { type: String, enum: ['To Do', 'In Progress', 'Done'], default: 'To Do' },
  tags: { type: [String] },
  subTasks: [subTaskSchema],
}, { timestamps: true });
```

### `fileModel.js`
```js
const fileSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    fileName: { type: String, required: true, trim: true },
    s3Key: { type: String, required: true, unique: true },
    fileType: { type: String, required: true },
    size: { type: Number, required: true },
    // Folder Structure
    isFolder: { type: Boolean, default: false },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'File', default: null, index: true },
    path: { type: String, index: true },
    // Analytics & Metadata
    downloadCount: { type: Number, default: 0 },
    // Sharing
    sharedWith: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        expiresAt: { type: Date, default: null }
    }],
    publicShare: {
        code: { type: String, unique: true, sparse: true, index: true },
        isActive: { type: Boolean, default: false },
        expiresAt: { type: Date }
    },
    sharedWithClass: {
        subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
        batch: { type: Number },
        semester: { type: Number },
        section: { type: String }
    }
}, { timestamps: true });
```

### Other Core Models

**`promptModel.js`**: Stores AI prompts for analytics
**`conversationModel.js`**: Manages chat conversations between users
**`messageModel.js`**: Individual chat messages with status tracking
**`subjectModel.js`**: Academic courses
**`classSessionModel.js`**: Individual class sessions with attendance tracking
**`feedbackModel.js`**: Anonymous student feedback
**`teacherSessionReflectionModel.js`**: Teacher's self-assessment of sessions

---

## 5. Real-Time Communication Patterns

### Socket.IO Architecture
- All connections authenticated via `socketAuthMiddleware`
- `SocketContext.jsx` on frontend manages connection lifecycle
- Feature-specific handlers (chat, attendance) for separation of concerns

### Room-Based Communication
- Private rooms for targeted event delivery
- Teachers join session-specific rooms for attendance updates
- Prevents broadcast pollution and ensures privacy

### Event Flow Pattern
1. Client emits event to server
2. Server validates and processes
3. Server emits to specific room or client
4. Client reducer updates Redux store
5. UI re-renders with new data

---

## 6. State Management Patterns

### Redux Toolkit Structure
- Feature-based slices (`authSlice`, `taskSlice`, `chatSlice`, etc.)
- Async thunks for API calls
- `extraReducers` for cross-slice communication
- Optimistic updates with rollback on error

### Common Slice Pattern
```js
const featureSlice = createSlice({
  name: 'feature',
  initialState: { items: [], loading: false, error: null },
  reducers: {
    // Synchronous/optimistic reducers
  },
  extraReducers: (builder) => {
    builder
      .addCase(asyncThunk.pending, (state) => { state.loading = true })
      .addCase(asyncThunk.fulfilled, (state, action) => {
        state.loading = false;
        // Update state with payload
      })
      .addCase(asyncThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});
```

### Feature-Specific Module Details

**Admin Module:**
The admin module provides comprehensive administrative control. The main `<AdminDashboardPage />` serves as the central hub for managing the entire educational system, with separate views for user management, subject management, faculty management, and student application reviews.

**Student Module:**
The student module provides the complete student experience. Its main view, `<StudentDashboardPage />`, is a central hub that conditionally renders content based on the user's application status.

The teacher module contains the daily-use tools for faculty. The `<LiveAttendanceRoster />` component features a resilient timer anchored to the server's expiration timestamp and a robust real-time update mechanism using Socket.IO rooms. 

The `<ClassHistory />` component displays responsive list of past sessions. It serves as the entry point for two enhanced modals: the `<FeedbackSummaryModal />`, which presents aggregated student feedback, and the `<TeacherReflectionModal />`, which supports both creating and editing reflections by fetching existing data and using an "`upsert`" submission logic.

### Comprehensive Administrative Control

The application provides a multi-level reporting suite for administrators and HODs, moving beyond basic data display to offer actionable insights.

- **Reporting Dashboards**: The main `ReportingPage.jsx` provides high-level, filterable aggregate reports on student attendance and feedback. The frontend features interactive and **cascading filters** to prevent impossible combinations (e.g., selecting a semester filters the available subjects).
    
- **Detailed Drill-Downs**: From the main dashboard, admins can navigate to new, dedicated report pages:
    
    - A **Teacher-Centric Report** (`TeacherReportPage.jsx`) allows searching for a specific teacher and viewing a detailed breakdown of their performance metrics (attendance, feedback scores) across all their subjects.
        
    - A **Student-Centric Report** (`StudentReportPage.jsx`) allows searching for a student and viewing their attendance record for every enrolled subject, which is vital for academic advising.
        
- **Detailed 360° Feedback Review**: The `DetailedFeedbackModal.jsx` provides a complete view of any single class session, combining anonymized, aggregated student feedback (including individual rating criteria and qualitative comments) with the teacher's own submitted reflection.
    


## 4. Backend Architecture

The backend is organized into a clean, service-oriented architecture with a clear separation of concerns, ensuring that the application is secure and scalable.

The backend has been refactored into a modern, feature-based architecture with a clear separation of concerns, ensuring the application is highly maintainable and scalable. All application logic resides within a top-level **`src/`** directory.

```
backend/
├── src/
│   ├── api/                           # All API-related logic, organized by feature.
│   │   ├── admin/                     # Handles admin-specific functionalities.
│   │   │   ├── admin.controller.js
│   │   │   └── admin.routes.js
│   │   ├── ai/                        # Logic for AI-powered features.
│   │   │   ├── ai.controller.js
│   │   │   └── ai.routes.js
│   │   ├── auth/                       # Manages user authentication.
│   │   │   ├── auth.controller.js
│   │   │   ├── password.controller.js  # Handles password reset and forgot password flows.
│   │   │   └── auth.routes.js
│   │   ├── chat/                       # Real-time chat and messaging.
│   │   │   ├── chat.controller.js      # Manages Socket.IO events and real-time logic.
│   │   │   ├── conversation.controller.js # Manages REST API for conversations.
│   │   │   └── conversation.routes.js
│   │   ├── college/                    # Educational domain.
│   │   │   ├── attendence.socket.js    # managing teacher room creation.
│   │   │   ├── student.controller.js   # Handles student-specific actions.
│   │   │   ├── student.routes.js
│   │   │   ├── subject.controller.js   # CRUD operations for academic subjects.
│   │   │   ├── subject.routes.js
│   │   │   ├── teacher.controller.js   # Manages teacher actions.
│   │   │   └── teacher.routes.js
│   │   ├── files/                      # Handles all file management logic.
│   │   │   ├── controllers/
│   │   │   │   ├── delete.controller.js
│   │   │   │   ├── download.controller.js
│   │   │   │   ├── item.controller.js
│   │   │   │   ├── share.controller.js
│   │   │   │   └── upload.controller.js
│   │   │   │
│   │   │   ├── routes/
│   │   │   |   ├── delete.routes.js
│   │   │   |   ├── download.routes.js
│   │   │   |   ├── item.routes.js
│   │   │   |   ├── share.routes.js
│   │   │   |   └── upload.routes.js
|	|  	|	|
│   │   │   ├── academicFile.controller.js
│   │   │   ├── academicFile.routes.js
│   │   │   ├── folder.controller.js
│   │   │   ├── folder.routes.js
│   │   │   ├── public.controller.js
│   │   │   └── public.routes.js
|	| 	|
│   │   ├── tasks/                      # Core task management (CRUD operations).
│   │   │   ├── task.controller.js
│   │   │   └── task.routes.js
│   │   └── user/                       # Manages user profile operations.
│   │       ├── user.controller.js
│   │       └── user.routes.js
│   │
│   ├── config/                         # Configuration files for third-party services.
│   │   └── passport-setup.js
│   │
│   ├── connect/                        # Handles connections to external resources.
│   │   └── database.js                 # Logic for connecting to the MongoDB database.
│   │
│   ├── middleware/                     # Express middleware functions.
│   │   ├── auth.middleware.js          # Protects routes by verifying JWT tokens.
│   │   ├── checkAIDailyLimit.js        # Enforces daily usage quotas for AI features.
│   │   ├── error.middleware.js         # Global error handler for the application.
│   │   ├── file.middleware.js          # Contains Multer configurations for file/avatar uploads.
│   │   ├── rateLimiter.middleware.js   # Applies rate limiting to prevent abuse.
│   │   ├── role.middleware.js          # Verifies user roles (e.g., isAdmin, isTeacher).
│   │   ├── storage.middleware.js      # middleware for role-based storage quotas
│   │   └── validation.middleware.js    # A helper for validating request bodies (e.g., with Joi).
│   │
│   ├── models/                    # Mongoose schemas models defining data structure.
│   │   ├── classSessionModel.js   # Schema for an individual class session.
│   │   ├── conversationModel.js   # Schema for a conversation between users.
│   │   ├── feedbackModel.js       # Schema for student feedback on sessions.
│   │   ├── fileModel.js           # Schema for uploaded files and their metadata.
│   │   ├── messageModel.js        # Schema for an individual chat message.
│   │   ├── promptModel.js         # Schema for storing AI prompts and their usage.
│   │   ├── subjectModel.js        # Schema for academic subjects.
│   │   ├── taskModel.js           # Schema for tasks and their sub-tasks.
│   │   └── userModel.js           # Schema defining the user, roles, and credentials.
│   │
│   |── services/       # Reusable business logic and external API interactions.
│   |    ├── email.service.js       # Service for sending emails.
│   |    ├── llm.service.js   # Service to interact with the Large Language Model.
│   |    └── s3.service.js          # Service to manage communication with AWS S3 for file storage.

│   └── utils/
│       ├── emailTemplates/
│       |   ├── facultyPromotion.html
│       |   ├── passwordReset.html
│       |   ├── studentApplicationApproved.html
│       |   ├── studentApplicationPending.html
│       |   └── verificationEmail.html
│       └── emailTemplate.js
├── .env                           # Environment variables.
├── package.json                   # Project metadata and list of dependencies.
└── server.js                      # The main entry point of the application.
```

- **Server Entry Point (`server.js`)**: Initializes the Express app, connects to MongoDB, and critically, uses a **preloaded `dotenv` configuration** (`-r dotenv/config`) to ensure environment variables are available to all modules on startup. It mounts all route handlers and the final global error handler. 
- The Socket.IO server is configured here, but its core logic is decoupled. It acts as a **dispatcher**, authenticating all incoming socket connections via `socketAuthMiddleware` and then passing the connection object to specialized, feature-specific handlers like `handleChatConnection` and `handleAttendanceConnection`. This keeps the main server file clean and highly maintainable.

### `src/models/`: Data Blueprint

The `models/` directory serves as the single source of truth for the application's data structure. Each file defines a Mongoose schema, which acts as a blueprint for the documents within a MongoDB collection, enforcing data integrity and defining the relationships between different pieces of information.

### `src/middleware/`: Security & Rules Layer

The middleware acts as a gatekeeper for incoming requests, handling security, validation, and business rules before the request reaches the main controller logic.

**Core Security**:
    
- `auth.middleware.js`: The primary security middleware, containing the `protect` function that verifies the JSON Web Token (JWT) on all private routes to ensure the user is authenticated. `socketAuthMiddleware`: A specialized middleware for the real-time system that validates a JWT upon the initial WebSocket connection, ensuring only authenticated users can connect to the chat server.
	
- `role.middleware.js`: Works alongside `protect` to provide role-based access control. It exports functions like `isStudent` and `isAdmin` that check the user's role and restrict access to specific endpoints. Works with the existing `protect` middleware.
	
- `rateLimiter.middleware.js`: Protects the application from brute-force attacks by providing granular rate limiting, with stricter limits applied to sensitive authentication and public routes.
        
**Business Rules & Validation**:
    
- `file.middleware.js`: Contains all `multer` configurations for file and avatar uploads (includes `uploadFiles` for documents and `uploadAvatar` for profile pictures), enforcing strict limits on file size (5MB for avatars, configurable for documents), allowed MIME types, and file count to prevent misuse of the file storage system.
    
- `storage.middleware.js`: A custom middleware that enforces specific business rules for file storage, including **role-based quotas** for both total storage size and file count.
    
- `checkAIDailyLimit.js`: A custom middleware function that checks a user's daily AI generation limit before allowing the request to proceed.
	
- `errorMiddleware.js`: A global error handler that catches any errors that occur during the request-response cycle, including specific errors from `multer`, and formats them into a user-friendly response.
	
- `validation.middleware.js`: A reusable helper for validating request bodies against Joi schemas before they hit the controller.
        
### `src/services/`: The Service Layer

The `service` directory acts as a service layer, abstracting all external communications and complex logic away from the controllers. This service-oriented design keeps the controllers lean and focused on managing the request flow.

- `s3.service.js`: This is the single source of truth for all interactions with the AWS S3 SDK. It handles tasks like uploading files, deleting files, and generating secure, temporary pre-signed URLs for downloads.
    
- `email.service.js`: A reusable service built on Nodemailer that handles sending all application emails, from registration verification to password reset links.
    
- `llm.service.js`: This service manages all prompt engineering and communication with the Google Gemini API. It takes high-level goals from the `aiTaskController` and translates them into effective prompts to generate structured task plans.

### `src/api/`: The Feature Core

This is the heart of the backend, containing all business logic organized into self-contained feature modules. Each module contains its own controllers and routes, co-locating all the code related to a single feature.

The `routes` file in each module is responsible for defining the API surface for that feature. It chains together the necessary middleware (for authentication and authorization) and the final controller function, creating a clear and readable pipeline for how each request is handled.

**`admin/`**: The central administrative hub.
    
- `admin.controller.js`: Manages student application approvals, user promotions to faculty, student detail updates, report generation, and performs critical validation to ensure data consistency for student enrollments and teacher assignments.
	
- `admin.routes.js`: Has 9 API's requiring admin or hod role.

**`ai/`**: Manages interactions with the AI for task plan generation.
    
- `ai.controller.js`: Handles logic for generating initial task plans and processing conversational refinements.
	
- `ai.routes.js`: has 2 API's.
            
**`auth/`**: Manages the public-facing user lifecycle.
    
- `auth.controller.js`: Handles new user registration, email verification, and the login process.
	
- `password.controller.js`: Handles the secure "forgot password" and "reset password" flows.
	
- `auth.routes.js`:  Has 5 public facing API's
	

**`chat/`**: Manages real-time messaging and REST API.
    
- `conversation.controller.js`: Handles the REST API requests for fetching user's list of conversations and message history of specific chat.
	
- `chat.controller.js`: A specialized controller that attaches directly to the Socket.IO server to manage all real-time events.
	
- `conversation.routes.js`: Has 3 API's

**`college/`**: Contains all the core academic workflows, with separate controllers and routes for `student`, `teacher`, and `subject` features.
    
- `teacher.controller.js`: Governs the lifecycle of a class session. This includes creating the session, generating the attendance code, and managing the live attendance roster.
	
- `student.controller.js`: Handles student-specific actions like attendance and feedback for class session.
	
- `subject.controller.js`: Provides full CRUD for academic subjects, including robust, cascading logic to remove all related student enrollments and teacher assignments when a subject's semester is updated or deleted, ensuring data integrity across the system.
	
- `student.routes.js`, `subject.routes.js`, `teacher.routes.js`:  Combined to 13 API's
	
- `attendance.socket.js` handles all real-time socket events for the live attendance feature, such as managing teachers' room membership for specific class sessions. This decouples the real-time logic from the HTTP controllers.

    
**`files/`**: Contains all logic for file uploads, folder management, and sharing.

- `file.controller.js`: Manages file-specific actions like uploads via S3 pre-signed URLs, secure downloads, and private sharing.
    
- `folder.controller.js`: Manages the hierarchical folder system, including creation, moving, and recursive deletion.
    
- `public.controller.js`: Manages public-facing actions, such as downloading a file via a share code.
    
- `file.routes.js`, `folder.routes.js`, `public.routes.js`: Combined to 16 APIs.
	
**`tasks/`**: Manages core CRUD operations for tasks and sub-tasks.
    
- `task.controller.js`: Contains all business logic for task and sub-task manipulation.
	
- `task.routes.js`: 8 API's
	
**`user/`**: Handles the profile of an authenticated user.
    
- `user.controller.js`: Manages profile updates, password changes, and avatar uploads.
	
- `user.routes.js`: 6 API's


## 5. Advanced UI/UX Patterns

The application goes beyond basic CRUD to provide a modern, seamless user experience.

- **Optimistic UI Updates**:
    
    - All primary user actions (creating, updating, and deleting tasks and sub-tasks, **and sending chat messages**) are handled optimistically.
        
    - When a user performs an action, a synchronous "optimistic" reducer is dispatched first, instantly updating the UI. The asynchronous thunk (for tasks) or socket event (for chat) is then dispatched to sync the change with the backend.
        
    - Special `.rejected` cases in the `taskSlice` are implemented to correctly revert the UI change if the server call fails, ensuring data consistency.
        
- **"Undo" Deletion Flow**:
    
    - For main task deletion, the application implements a non-blocking "Undo" pattern.
        
    - Upon confirming deletion, the task is optimistically removed from the UI, and a `react-toastify` notification appears for 3.5 seconds with an "Undo" button.
        
    - The server-side deletion is scheduled using a `setTimeout`.
        
    - If the user clicks "Undo," a `clearTimeout` is called to cancel the pending server request, and an `undoDeleteTask` reducer restores the task to the UI. This provides a fast and forgiving user experience.
        
- **Animations & Transitions**:
    
    - **Page Content**: `framer-motion` is used to animate landing page sections into view on scroll (`whileInView`).
        
    - **List Items**: `TransitionGroup` and MUI's `<Collapse>` component are used in `TaskList.jsx` to smoothly animate `TaskItem` components as they are added or removed from the list.
        

## Centralized Styling & Theming

The application uses a professional, centralized design system built with Material-UI.

- **Theme-Aware Design (`theme.js`)**: A central `theme.js` file defines two distinct color palettes for `light` and `dark` modes.
    
- **Dynamic Theme Toggling**: A React Context (`ThemeContext.jsx`) manages the current theme mode. A toggle switch in the `<Header>` allows the user to switch between light and dark modes instantly. All components use theme-aware colors (e.g., `background.default`, `primary.main`), allowing the entire application's look and feel to adapt automatically.
    
- **Global Style Management (`<CssBaseline />`)**: MUI's `<CssBaseline />` component is used to apply a smart CSS reset and the theme's background color, ensuring a consistent base across all browsers and removing the need for extensive custom global CSS.
    

## Client-Side Security & Validation

The application includes robust client-side checks to improve user experience and security.

- **Email Standardization**: In the `Login` and `Register` pages, all email inputs are programmatically trimmed and converted to lowercase before being sent to the backend. This prevents duplicate accounts and login issues caused by capitalization.
    
- **Password Strength Validation**: The `Register` page implements real-time validation for password strength, checking for a minimum length and the presence of uppercase letters, numbers, and special characters. The UI provides instant feedback to the user via the `TextField`'s `helperText`.
    
- **Password Visibility Toggle**: Both the `Login` and `Register` forms include an icon button that allows users to toggle the visibility of the password they are typing, reducing errors.
    

## Deployment & Routing Configuration

- **SPA Routing Fix**: The frontend, deployed on Netlify, includes a `public/_redirects` file with a rewrite rule (`/* /index.html 200`). This correctly handles client-side routing, ensuring that direct navigation to any page (e.g., `/dashboard`) or a page refresh does not result in a 404 error.
    
- **Custom 404 Page**: The application has a dedicated "Not Found" page with a custom illustration, which is served by a catch-all route (`path="*"`) in React Router for any path that doesn't match an existing page.
