# Assignments Domain (Phase 0)

The Assignments domain will handle assignment creation, submission, grading, and analytics for educational assessment.

## 📋 Table of Contents

- [Overview](#overview)
- [Current Status](#current-status)
- [Architecture](#architecture)
- [Planned Features](#planned-features)
- [Data Models](#data-models)
- [Implementation Roadmap](#implementation-roadmap)

## Overview

The Assignments domain is designed to provide comprehensive assignment management functionality:

- **Assignment Creation**: Teachers create assignments with specifications
- **Submissions**: Students submit assignments with file uploads
- **Grading**: Teachers grade submissions with feedback
- **Analytics**: Track submission rates, grade distributions, and trends
- **Plagiarism Detection**: Optional plagiarism checking
- **Late Submissions**: Configurable late submission policies

## Current Status

**🚧 PLACEHOLDER - Not Yet Implemented**

This domain is currently a placeholder. No functionality has been implemented yet.

## Architecture

```
src/api/assignments/
├── models/                     # Data models
│   ├── assignment.model.js
│   └── submission.model.js
├── controllers/                # Request handlers
│   ├── teacher.controller.js   # Teacher operations
│   ├── student.controller.js   # Student operations
│   └── grading.controller.js   # Grading operations
├── services/                   # Business logic
│   ├── assignment.service.js
│   ├── submission.service.js
│   ├── grading.service.js
│   └── analytics.service.js
├── routes/                     # Route definitions
│   ├── teacher.routes.js
│   ├── student.routes.js
│   └── grading.routes.js
├── validators/                 # Input validation
│   └── assignment.validators.js
├── policies/                   # Authorization rules
│   └── assignment.policies.js
├── utils/                      # Utilities
│   ├── plagiarism.util.js
│   └── grading.util.js
└── assignments.routes.js       # Main router
```

## Planned Features

### 1. Assignment Management (Teacher)

**Description**: Teachers create and manage assignments

**Features**:
- Create assignments with title, description, due date, max points
- Attach resources (files, links, instructions)
- Set submission types (file upload, text, link)
- Configure late submission policies
- Set visibility (published/draft)
- Duplicate assignments across sections
- Schedule automatic publishing

**API Endpoints** (Planned):
```
POST   /api/assignments/teacher/create           - Create assignment
GET    /api/assignments/teacher/list             - List all assignments
GET    /api/assignments/teacher/:assignmentId    - Get assignment details
PATCH  /api/assignments/teacher/:assignmentId    - Update assignment
DELETE /api/assignments/teacher/:assignmentId    - Delete assignment
POST   /api/assignments/teacher/:assignmentId/publish - Publish assignment
POST   /api/assignments/teacher/:assignmentId/duplicate - Duplicate assignment
```

### 2. Student Submissions

**Description**: Students view assignments and submit work

**Features**:
- View assigned tasks by class/subject
- Upload submission files (PDFs, documents, images, code)
- Text-based submissions (essays, answers)
- Link submissions (GitHub, Google Docs, etc.)
- Draft submissions (save progress)
- Edit before deadline
- Late submission warnings
- Submission history tracking

**API Endpoints** (Planned):
```
GET    /api/assignments/student/list             - Get student's assignments
GET    /api/assignments/student/:assignmentId    - Get assignment details
POST   /api/assignments/student/:assignmentId/submit - Submit assignment
PATCH  /api/assignments/student/:submissionId    - Update submission
GET    /api/assignments/student/:assignmentId/submission - Get my submission
DELETE /api/assignments/student/:submissionId    - Delete draft submission
```

### 3. Grading & Feedback

**Description**: Teachers grade submissions and provide feedback

**Features**:
- View all submissions for an assignment
- Filter by submission status (submitted, pending, late, graded)
- Inline grading with points/marks
- Written feedback comments
- Rubric-based grading
- Bulk actions (grade multiple, download all)
- Return to student with feedback
- Grade distribution analytics

**API Endpoints** (Planned):
```
GET    /api/assignments/grading/:assignmentId/submissions - List submissions
GET    /api/assignments/grading/submission/:submissionId  - Get submission details
POST   /api/assignments/grading/submission/:submissionId/grade - Grade submission
PATCH  /api/assignments/grading/submission/:submissionId/feedback - Add feedback
POST   /api/assignments/grading/submission/:submissionId/return - Return graded work
GET    /api/assignments/grading/:assignmentId/stats - Get grading statistics
```

### 4. Analytics & Reports

**Description**: Track assignment performance and trends

**Features**:
- Submission rate tracking
- Grade distribution charts
- Average scores by class/subject
- Late submission trends
- Student performance over time
- Comparison across sections
- Export reports (PDF, Excel)

**API Endpoints** (Planned):
```
GET    /api/assignments/analytics/teacher        - Teacher's assignment analytics
GET    /api/assignments/analytics/student        - Student's performance analytics
GET    /api/assignments/analytics/assignment/:id - Assignment-specific analytics
GET    /api/assignments/analytics/subject/:id    - Subject-level analytics
GET    /api/assignments/analytics/export         - Export analytics data
```

### 5. Advanced Features

**Description**: Enhanced functionality for power users

**Features**:
- Peer review system (students review each other)
- Group assignments (collaborative submissions)
- Auto-grading for objective questions
- Plagiarism detection integration
- Version control for submissions
- Scheduled reminders (approaching deadlines)
- Assignment templates
- Resubmission policies

## Data Models

### Assignment Model (Planned)

```javascript
{
  // Basic Info
  title: String,                    // Assignment title
  description: String,              // Detailed instructions
  subject: ObjectId,                // Reference to Subject
  teacher: ObjectId,                // Reference to User (teacher)
  
  // Class Info
  batch: Number,
  semester: Number,
  section: String,                  // Or array for multiple sections
  
  // Submission Settings
  submissionType: String,           // 'file', 'text', 'link', 'multiple'
  allowedFileTypes: [String],       // ['pdf', 'docx', 'zip']
  maxFileSize: Number,              // In MB
  maxFiles: Number,
  
  // Grading Settings
  maxPoints: Number,
  gradingRubric: Object,            // Optional rubric
  passingGrade: Number,
  
  // Deadlines
  publishedAt: Date,
  dueDate: Date,
  allowLateSubmission: Boolean,
  latePenalty: Number,              // Percentage penalty per day
  cutoffDate: Date,                 // Absolute deadline
  
  // Attachments
  attachments: [{
    fileId: ObjectId,
    name: String,
    type: String
  }],
  
  // Settings
  status: String,                   // 'draft', 'published', 'closed'
  isGroupAssignment: Boolean,
  enablePeerReview: Boolean,
  autoGrade: Boolean,
  checkPlagiarism: Boolean,
  
  // Metadata
  createdAt: Date,
  updatedAt: Date
}
```

### Submission Model (Planned)

```javascript
{
  // References
  assignment: ObjectId,             // Reference to Assignment
  student: ObjectId,                // Reference to User (student)
  
  // Submission Content
  submissionType: String,           // 'file', 'text', 'link'
  files: [{
    fileId: ObjectId,
    name: String,
    uploadedAt: Date
  }],
  textContent: String,
  linkUrl: String,
  
  // Status
  status: String,                   // 'draft', 'submitted', 'graded', 'returned'
  isDraft: Boolean,
  isLate: Boolean,
  
  // Timestamps
  submittedAt: Date,
  lastModifiedAt: Date,
  
  // Grading
  grade: Number,
  maxPoints: Number,
  feedback: String,
  rubricScores: Object,             // Detailed rubric scoring
  gradedBy: ObjectId,               // Teacher who graded
  gradedAt: Date,
  returnedAt: Date,
  
  // Plagiarism
  plagiarismScore: Number,
  plagiarismReport: Object,
  
  // Version Control
  version: Number,
  previousVersions: [ObjectId],
  
  // Metadata
  createdAt: Date,
  updatedAt: Date
}
```

### Grade Model (Planned)

```javascript
{
  submission: ObjectId,             // Reference to Submission
  assignment: ObjectId,             // Reference to Assignment
  student: ObjectId,                // Reference to User (student)
  teacher: ObjectId,                // Reference to User (teacher)
  
  grade: Number,
  maxPoints: Number,
  percentage: Number,
  letterGrade: String,              // 'A', 'B+', etc.
  
  feedback: String,
  rubricScores: Object,
  
  isPublished: Boolean,             // Visible to student
  
  createdAt: Date,
  updatedAt: Date
}
```

## Implementation Roadmap

### Phase 1: Basic Assignment Management
**Priority**: High  
**Duration**: 2-3 weeks

- Create Assignment and Submission models
- Implement teacher assignment creation
- Implement student submission
- Basic file upload integration with Files domain

### Phase 2: Grading System
**Priority**: High  
**Duration**: 2 weeks

- Implement grading interface
- Add feedback system
- Grade submission and return
- Basic analytics (submission rate, grade distribution)

### Phase 3: Advanced Features
**Priority**: Medium  
**Duration**: 3-4 weeks

- Late submission handling
- Draft submissions
- Rubric-based grading
- Submission history and versioning
- Enhanced analytics

### Phase 4: Premium Features
**Priority**: Low  
**Duration**: 4-6 weeks

- Plagiarism detection
- Auto-grading for objective questions
- Peer review system
- Group assignments
- Advanced reporting

## Integration with Existing Domains

### Files Domain
- Use Files domain for assignment attachment uploads
- Use Files domain for student submission file uploads
- Leverage existing file storage and retrieval

### Attendance Domain
- Link assignments to specific class sessions
- Track assignment completion alongside attendance

### Admin Domain
- Subject-based assignment organization
- Teacher-class assignment verification

### Notifications (Future)
- Notify students of new assignments
- Remind students of approaching deadlines
- Notify teachers of new submissions

## Business Rules

### Assignment Creation
1. Teachers can only create assignments for their assigned classes
2. Due date must be in the future
3. Max points must be positive
4. Late submission cutoff must be after due date

### Submissions
1. Students can only submit assignments for their enrolled classes
2. Can't submit after cutoff date
3. Draft submissions don't count as submitted
4. File size and type restrictions must be enforced

### Grading
1. Teachers can only grade assignments they created
2. Grade must be between 0 and maxPoints
3. Must provide feedback when grading
4. Graded submissions can be re-graded

### Authorization
- **Teachers**: Create, update, delete assignments; grade submissions
- **Students**: View assignments, submit work, view their grades
- **Admins**: View all assignments and submissions

## Technical Considerations

### File Storage
- Use Files domain for all file uploads
- Implement file size limits
- Validate file types
- Virus scanning for uploaded files

### Performance
- Paginate submission lists
- Index on assignment, student, and submission date
- Cache grade distributions
- Background jobs for plagiarism checking

### Notifications
- Real-time notifications for new assignments
- Email reminders for approaching deadlines
- Push notifications for graded submissions

### Security
- Validate student enrollment before allowing submission
- Prevent unauthorized access to other students' submissions
- Secure file downloads with signed URLs

## Testing Strategy

1. **Unit Tests**: Services, utilities, validators
2. **Integration Tests**: API endpoints, database operations
3. **End-to-End Tests**: Complete workflows (create → submit → grade)
4. **Load Tests**: Handle multiple simultaneous submissions
5. **Security Tests**: Authorization, file upload validation

## Future Enhancements

- **AI-powered Grading**: Auto-grade essays and coding assignments
- **Video Submissions**: Support video assignment submissions
- **Code Compilation**: Run and test submitted code
- **Mobile App**: Native mobile app for submissions
- **Blockchain Verification**: Immutable submission timestamps
- **Integration with LMS**: Export to Canvas, Moodle, etc.

## Questions to Resolve

1. Should assignments support group submissions from day one?
2. How to handle resubmissions and version control?
3. What plagiarism detection service to integrate?
4. Should we support multiple grading rubrics per assignment?
5. How to handle extra credit assignments?
6. Support for bonus points?

## Dependencies

### Required Before Implementation
- Files domain (✅ Implemented)
- Admin domain with subject management (⏳ In progress)
- User roles and permissions (✅ Implemented)

### Nice to Have
- Notifications system
- Email service
- Analytics dashboard

---

**Last Updated**: January 2024  
**Phase**: 0 (Placeholder)  
**Status**: Not Implemented  
**Priority**: Medium-High  
**Contact**: Development Team for implementation timeline
