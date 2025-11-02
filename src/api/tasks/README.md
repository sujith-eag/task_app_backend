# Tasks Domain - Phase 0 Architecture

## Overview

The **Tasks** domain handles personal task management with support for subtasks, priorities, due dates, and categorization through tags. This refactored implementation follows the Phase 0 architecture pattern with clear separation of concerns.

## Directory Structure

```
src/api/tasks_refactored/
├── controllers/
│   ├── tasks.controller.js       # HTTP handlers for task operations
│   └── subtasks.controller.js    # HTTP handlers for subtask operations
├── services/
│   ├── tasks.service.js          # Business logic for tasks
│   └── subtasks.service.js       # Business logic for subtasks
├── routes/
│   └── tasks.routes.js           # API route definitions
├── validators/
│   └── tasks.validator.js        # Input validation rules
└── README.md                      # This file
```

## Features

### Task Management
- ✅ **CRUD Operations**: Create, read, update, delete tasks
- ✅ **Filtering**: Filter by status (To Do, In Progress, Done) and priority (Low, Medium, High)
- ✅ **Sorting**: Sort by any field (title, dueDate, priority, status, createdAt, updatedAt)
- ✅ **Bulk Creation**: Create up to 15 tasks at once (AI-generated task lists)
- ✅ **Statistics**: Get task completion stats by status and priority
- ✅ **Overdue Tracking**: Identify overdue tasks automatically

### Subtask Management
- ✅ **Nested Structure**: Add subtasks to any task
- ✅ **Completion Tracking**: Mark subtasks as complete/incomplete
- ✅ **CRUD Operations**: Create, update, delete subtasks
- ✅ **Progress Stats**: Get completion percentage for subtasks

### Data Model
- ✅ **User Association**: Tasks are scoped to individual users
- ✅ **Rich Metadata**: Title, description, due date, priority, status, tags
- ✅ **Timestamps**: Automatic createdAt and updatedAt tracking
- ✅ **Validation**: Schema-level validation for all fields

## API Endpoints

### Task Endpoints

#### GET /api/tasks
Get all tasks for the authenticated user.

**Query Parameters:**
- `status` (optional): Filter by status (To Do, In Progress, Done)
- `priority` (optional): Filter by priority (Low, Medium, High)
- `sortBy` (optional): Sort field and order (e.g., `dueDate:asc`, `createdAt:desc`)

**Response:** `200 OK`
```json
[
  {
    "_id": "task_id",
    "user": "user_id",
    "title": "Complete project proposal",
    "description": "Write and submit the Q1 project proposal",
    "dueDate": "2024-12-31T23:59:59.000Z",
    "priority": "High",
    "status": "In Progress",
    "tags": ["work", "urgent"],
    "subTasks": [...],
    "createdAt": "2024-12-01T10:00:00.000Z",
    "updatedAt": "2024-12-10T15:30:00.000Z"
  }
]
```

#### GET /api/tasks/stats
Get task statistics for the authenticated user.

**Response:** `200 OK`
```json
{
  "byStatus": [
    { "_id": "To Do", "count": 5 },
    { "_id": "In Progress", "count": 3 },
    { "_id": "Done", "count": 12 }
  ],
  "byPriority": [
    { "_id": "Low", "count": 4 },
    { "_id": "Medium", "count": 10 },
    { "_id": "High", "count": 6 }
  ],
  "overdue": 2,
  "total": 20
}
```

#### GET /api/tasks/:id
Get a single task by ID.

**Response:** `200 OK` (same structure as GET /api/tasks)

#### POST /api/tasks
Create a new task.

**Request Body:**
```json
{
  "title": "Complete project proposal",
  "description": "Write and submit the Q1 project proposal",
  "dueDate": "2024-12-31T23:59:59.000Z",
  "priority": "High",
  "status": "To Do",
  "tags": ["work", "urgent"]
}
```

**Response:** `201 Created`

#### POST /api/tasks/bulk
Create multiple tasks at once (max 15).

**Request Body:**
```json
{
  "tasks": [
    {
      "title": "Task 1",
      "description": "Description 1",
      "priority": "High"
    },
    {
      "title": "Task 2",
      "description": "Description 2",
      "priority": "Medium"
    }
  ]
}
```

**Response:** `201 Created`

#### PUT /api/tasks/:id
Update a task.

**Request Body:** (all fields optional)
```json
{
  "title": "Updated title",
  "status": "In Progress",
  "priority": "Medium"
}
```

**Response:** `200 OK`

#### DELETE /api/tasks/:id
Delete a task.

**Response:** `200 OK`
```json
{
  "id": "task_id"
}
```

### Subtask Endpoints

#### GET /api/tasks/:id/subtasks/stats
Get subtask completion statistics.

**Response:** `200 OK`
```json
{
  "total": 5,
  "completed": 3,
  "pending": 2,
  "completionPercentage": 60
}
```

#### POST /api/tasks/:id/subtasks
Add a subtask to a task.

**Request Body:**
```json
{
  "text": "Research competitors"
}
```

**Response:** `200 OK` (returns full task with subtasks)

#### PUT /api/tasks/:id/subtasks/:subTaskId
Update a subtask.

**Request Body:**
```json
{
  "text": "Updated subtask text",
  "completed": true
}
```

**Response:** `200 OK` (returns full task with subtasks)

#### DELETE /api/tasks/:id/subtasks/:subTaskId
Delete a subtask.

**Response:** `200 OK` (returns full task with subtasks)

## Data Model

### Task Schema

```javascript
{
  user: ObjectId,              // Reference to User (indexed)
  title: String,               // Required, 1-200 chars
  description: String,         // Optional, max 2000 chars
  dueDate: Date,              // Optional
  priority: String,            // Enum: Low, Medium, High (default: Medium)
  status: String,              // Enum: To Do, In Progress, Done (default: To Do)
  tags: [String],             // Array of strings for categorization
  subTasks: [SubTask],        // Array of subtask subdocuments
  createdAt: Date,            // Auto-generated
  updatedAt: Date             // Auto-generated
}
```

### SubTask Schema

```javascript
{
  text: String,               // Required, 1-200 chars
  completed: Boolean,         // Default: false
  createdAt: Date,           // Auto-generated
  updatedAt: Date            // Auto-generated
}
```

## Validation Rules

### Task Creation/Update
- `title`: Required, 1-200 characters
- `description`: Optional, max 2000 characters
- `dueDate`: Optional, must be valid ISO 8601 date
- `priority`: Optional, must be "Low", "Medium", or "High"
- `status`: Optional, must be "To Do", "In Progress", or "Done"
- `tags`: Optional, array of strings (each 1-50 characters)

### Bulk Task Creation
- `tasks`: Required, non-empty array (max 15 items)
- Each task must have valid `title`
- Other fields follow same rules as single task creation

### Subtask Creation/Update
- `text`: Required, 1-200 characters
- `completed`: Optional, must be boolean

## Authorization

All endpoints require authentication via the `protect` middleware. Authorization is enforced at the service layer:

- **Task Operations**: Users can only access/modify their own tasks
- **Subtask Operations**: Users can only access/modify subtasks of their own tasks
- **403 Forbidden**: Returned when attempting to access another user's task

## Error Handling

The domain uses consistent error handling:

- **400 Bad Request**: Invalid input (missing required fields, validation errors)
- **403 Forbidden**: Unauthorized access to another user's task
- **404 Not Found**: Task or subtask not found
- **500 Internal Server Error**: Unexpected server errors

Service-layer errors include `statusCode` property for proper HTTP response codes.

## Service Layer Architecture

### tasks.service.js

Handles core task operations:
- `getUserTasks(userId, filters)` - Get tasks with filtering/sorting
- `getTaskById(taskId, userId)` - Get single task with ownership check
- `createTask(userId, taskData)` - Create new task
- `createBulkTasks(userId, tasks)` - Bulk task creation (max 15)
- `updateTask(taskId, userId, updateData)` - Update task
- `deleteTask(taskId, userId)` - Delete task
- `getTaskStats(userId)` - Get task statistics

### subtasks.service.js

Handles subtask operations:
- `addSubTask(taskId, userId, subTaskData)` - Add subtask
- `updateSubTask(taskId, subTaskId, userId, updateData)` - Update subtask
- `deleteSubTask(taskId, subTaskId, userId)` - Delete subtask
- `getSubTaskStats(taskId, userId)` - Get completion statistics

**Shared Helper:**
- `verifyTaskOwnership(taskId, userId)` - Centralized ownership verification

## Usage Examples

### Creating a Task

```javascript
POST /api/tasks
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.
Content-Type: application/json

{
  "title": "Write documentation",
  "description": "Document the new Tasks API",
  "dueDate": "2024-12-25T17:00:00.000Z",
  "priority": "High",
  "tags": ["documentation", "api"]
}
```

### Filtering and Sorting Tasks

```javascript
GET /api/tasks?status=In Progress&priority=High&sortBy=dueDate:asc
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.
```

### Creating Multiple Tasks (AI-Generated)

```javascript
POST /api/tasks/bulk
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.
Content-Type: application/json

{
  "tasks": [
    {
      "title": "Setup development environment",
      "priority": "High"
    },
    {
      "title": "Write unit tests",
      "priority": "Medium"
    },
    {
      "title": "Deploy to staging",
      "priority": "Low",
      "tags": ["deployment"]
    }
  ]
}
```

### Managing Subtasks

```javascript
// Add subtask
POST /api/tasks/123/subtasks
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.
Content-Type: application/json

{
  "text": "Review API documentation"
}

// Mark subtask as complete
PUT /api/tasks/123/subtasks/456
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.
Content-Type: application/json

{
  "completed": true
}

// Get completion stats
GET /api/tasks/123/subtasks/stats
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.
```

## Integration Notes

### Current State
- **Status**: ✅ Refactored to Phase 0 architecture
- **Location**: `src/api/tasks_refactored/`
- **Old Location**: `src/api/tasks/` (to be archived after testing)

### Migration Steps
1. Test all endpoints with existing data
2. Update `src/routes/index.js` to import from `tasks_refactored/`
3. Archive old `tasks/` directory as `tasks_old/`
4. Rename `tasks_refactored/` to `tasks/`
5. Update any external documentation or frontend integration

### Breaking Changes
None! The API contract remains identical to the original implementation. All endpoints, request/response formats, and behavior are preserved.

### New Features
- ✅ Added validation middleware with detailed error messages
- ✅ Added `GET /api/tasks/:id` endpoint for single task retrieval
- ✅ Added `GET /api/tasks/stats` endpoint for task statistics
- ✅ Added `GET /api/tasks/:id/subtasks/stats` for subtask completion tracking
- ✅ Improved error messages with proper status codes
- ✅ Added comprehensive input validation
- ✅ Separated business logic into service layer

## Testing Checklist

### Task Operations
- [ ] Create task with all fields
- [ ] Create task with only required fields (title)
- [ ] Get all tasks without filters
- [ ] Get tasks filtered by status
- [ ] Get tasks filtered by priority
- [ ] Get tasks with sorting (ascending/descending)
- [ ] Update task fields
- [ ] Delete task
- [ ] Create bulk tasks (valid array)
- [ ] Reject bulk creation with >15 tasks
- [ ] Get task statistics
- [ ] Get single task by ID
- [ ] Verify ownership (403 for other users' tasks)

### Subtask Operations
- [ ] Add subtask to task
- [ ] Update subtask text
- [ ] Mark subtask as complete
- [ ] Delete subtask
- [ ] Get subtask completion stats
- [ ] Verify ownership for subtask operations

### Validation
- [ ] Reject task without title
- [ ] Reject invalid priority value
- [ ] Reject invalid status value
- [ ] Reject invalid date format
- [ ] Reject title exceeding 200 characters
- [ ] Reject description exceeding 2000 characters
- [ ] Validate task ID format (MongoDB ObjectId)

### Edge Cases
- [ ] Handle non-existent task ID
- [ ] Handle non-existent subtask ID
- [ ] Handle empty bulk tasks array
- [ ] Handle malformed request body
- [ ] Verify proper error messages for all failures

## Performance Considerations

- **Indexing**: Task schema includes index on `user` field for efficient querying
- **Bulk Operations**: Uses `insertMany()` for efficient bulk task creation
- **Aggregation**: Statistics endpoint uses MongoDB aggregation pipeline
- **Validation**: Schema-level validation prevents invalid data at database level

## Future Enhancements

Potential improvements for future iterations:

1. **Task Sharing**: Share tasks with other users (similar to files domain)
2. **Recurring Tasks**: Support for repeating tasks (daily, weekly, etc.)
3. **Task Templates**: Predefined task templates for common workflows
4. **Attachments**: Link files from files domain to tasks
5. **Comments**: Add comment threads to tasks
6. **Time Tracking**: Track time spent on tasks
7. **Dependencies**: Define task dependencies (blocking/blocked by)
8. **Notifications**: Email/push notifications for due dates and updates
9. **Labels/Projects**: Group tasks into projects or workspaces
10. **Calendar Integration**: Sync with external calendars

## Related Domains

- **Users**: Task ownership and authentication
- **Files** (future): Attach files to tasks
- **Chat** (future): Discuss tasks with team members
- **Assignments** (future): Link academic assignments to tasks

---

**Last Updated**: December 2024  
**Architecture Version**: Phase 0  
**Status**: ✅ Complete and ready for integration
