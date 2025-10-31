# AI Domain - Phase 0 Architecture

## Overview

The **AI** domain handles AI-powered task generation using Large Language Models (LLMs). It supports interactive prompt refinement, conversation history, daily usage limits, and comprehensive usage analytics. This refactored implementation follows the Phase 0 architecture pattern with clear separation of concerns.

## Directory Structure

```
src/api/ai_refactored/
├── controllers/
│   └── ai.controller.js          # HTTP handlers for AI operations
├── services/
│   └── ai.service.js             # Business logic for AI features
├── routes/
│   └── ai.routes.js              # API route definitions
├── validators/
│   └── ai.validator.js           # Input validation rules
└── README.md                      # This file
```

## Features

### AI Task Generation
- ✅ **Initial Generation**: Create task plans from natural language prompts
- ✅ **Interactive Refinement**: Refine plans up to 5 times per session
- ✅ **Conversation History**: Maintain context across refinements
- ✅ **Edited Plan Support**: Apply refinements to user-edited plans
- ✅ **Bulk Task Creation**: Save generated tasks directly to database

### Usage Management
- ✅ **Daily Limits**: Configurable daily generation limits per user
- ✅ **Rate Limiting**: Middleware to enforce limits before API calls
- ✅ **Usage Statistics**: Track daily usage, total prompts, sessions
- ✅ **Session Tracking**: Group related prompts by sessionId

### Prompt History
- ✅ **History Storage**: Save all prompts with timestamps
- ✅ **Session Grouping**: View prompts grouped by conversation session
- ✅ **Search & Filter**: Filter prompts by sessionId
- ✅ **History Cleanup**: Delete old prompts (configurable age)

## API Endpoints

### Task Generation Endpoints

#### POST /api/ai/tasks/preview
Get AI-generated task plan preview or refine existing plan.

**Middleware**: `checkAIDailyLimit` (enforces daily usage limits)

**Request Body:**
```json
{
  "prompt": "Create a study plan for learning React",
  "sessionId": "unique-session-uuid",
  "editedPlan": {
    "tasks": [...]
  },
  "history": [
    {
      "role": "user",
      "content": "previous prompt"
    },
    {
      "role": "assistant",
      "content": "previous response"
    }
  ]
}
```

**Response:** `200 OK`
```json
{
  "plan": {
    "tasks": [
      {
        "title": "Setup React development environment",
        "description": "Install Node.js, npm, and create-react-app",
        "priority": "High",
        "dueDate": "2024-12-26",
        "tags": ["setup", "react"],
        "subTasks": [
          {
            "text": "Install Node.js",
            "completed": false
          },
          {
            "text": "Install create-react-app",
            "completed": false
          }
        ]
      }
    ]
  },
  "history": [
    {
      "role": "user",
      "content": "Create a study plan for learning React"
    },
    {
      "role": "assistant",
      "content": "..."
    }
  ],
  "refinementCount": 0,
  "refinementLimit": 5
}
```

**Error Responses:**
- `400 Bad Request`: Invalid prompt or missing sessionId
- `429 Too Many Requests`: Refinement limit reached or daily limit exceeded
- `500 Internal Server Error`: AI service error

#### POST /api/ai/tasks/generate
Generate and save tasks from AI prompt directly to database.

**Middleware**: `checkAIDailyLimit`

**Request Body:**
```json
{
  "prompt": "Create a workout plan for beginners"
}
```

**Response:** `201 Created`
```json
[
  {
    "_id": "task_id_1",
    "user": "user_id",
    "title": "Warm-up exercises",
    "description": "5 minutes of light cardio and stretching",
    "priority": "Medium",
    "status": "To Do",
    "tags": ["workout", "warmup"],
    "subTasks": [...],
    "createdAt": "2024-12-25T10:00:00.000Z",
    "updatedAt": "2024-12-25T10:00:00.000Z"
  }
]
```

### Statistics Endpoints

#### GET /api/ai/stats
Get AI usage statistics for the current user.

**Response:** `200 OK`
```json
{
  "dailyUsage": {
    "count": 3,
    "date": "2024-12-25"
  },
  "totalPrompts": 45,
  "initialPrompts": 12,
  "refinementPrompts": 33,
  "totalSessions": 12,
  "averageRefinementsPerSession": 2.8
}
```

### Prompt History Endpoints

#### GET /api/ai/prompts/history
Get prompt history for the current user.

**Query Parameters:**
- `sessionId` (optional): Filter by specific session
- `limit` (optional): Max results (default: 50, max: 100)

**Response:** `200 OK`
```json
[
  {
    "_id": "prompt_id",
    "user": "user_id",
    "promptText": "Create a study plan for learning React",
    "sessionId": "session-uuid-123",
    "isInitialPrompt": true,
    "createdAt": "2024-12-25T10:00:00.000Z",
    "updatedAt": "2024-12-25T10:00:00.000Z"
  }
]
```

#### GET /api/ai/sessions
Get session history grouped by sessionId (last 20 sessions).

**Response:** `200 OK`
```json
[
  {
    "_id": "session-uuid-123",
    "prompts": [
      {
        "_id": "prompt_id_1",
        "promptText": "Create a study plan",
        "isInitialPrompt": true,
        "createdAt": "..."
      },
      {
        "_id": "prompt_id_2",
        "promptText": "Add more advanced topics",
        "isInitialPrompt": false,
        "createdAt": "..."
      }
    ],
    "count": 2,
    "lastUsed": "2024-12-25T10:15:00.000Z"
  }
]
```

#### DELETE /api/ai/prompts/history
Clear old prompt history.

**Query Parameters:**
- `daysOld` (optional): Delete prompts older than X days (default: 30, max: 365)

**Response:** `200 OK`
```json
{
  "deletedCount": 25
}
```

## Data Models

### Prompt Schema

```javascript
{
  user: ObjectId,              // Reference to User (indexed)
  promptText: String,          // The actual prompt text (required)
  sessionId: String,           // Groups prompts in a conversation (required)
  isInitialPrompt: Boolean,    // True for first prompt in session (default: false)
  createdAt: Date,            // Auto-generated
  updatedAt: Date             // Auto-generated
}
```

### User AI Generations (embedded in User model)

```javascript
{
  aiGenerations: {
    count: Number,             // Daily generation count
    date: Date                 // Last generation date (for daily reset)
  }
}
```

## Validation Rules

### Plan Preview
- `prompt`: Required, string, 10-1000 characters
- `sessionId`: Required, string, max 100 characters
- `editedPlan`: Optional, must be object
- `history`: Optional, must be array

### Task Generation
- `prompt`: Required, string, 10-1000 characters

### Prompt History
- `sessionId` (query): Optional, string, max 100 characters
- `limit` (query): Optional, integer, 1-100

### Clear Prompts
- `daysOld` (query): Optional, integer, 1-365

## Rate Limiting & Usage Controls

### Daily Limit Middleware

The `checkAIDailyLimit` middleware enforces daily usage limits:

1. Checks user's `aiGenerations.count` and `aiGenerations.date`
2. Resets count if date has changed (new day)
3. Returns `429 Too Many Requests` if limit exceeded
4. Configured via `MAX_AI_GENERATIONS_PER_DAY` environment variable

### Refinement Limits

Per-session refinement limits:
- Default: 5 refinements per session
- Configured via `CONVERSATION_REFINEMENT_LIMIT` environment variable
- Prevents excessive API calls to LLM service
- Returns `429 Too Many Requests` when exceeded

### Prompt Length Limits

- Maximum prompt length: 1000 characters
- Minimum prompt length: 10 characters (prevents empty/trivial requests)

## Service Layer Architecture

### ai.service.js

Handles all AI-related business logic:

**Main Functions:**
- `getAIPlanPreview(userId, previewData)` - Generate or refine task plan
- `generateAndSaveTasks(userId, prompt)` - Generate and save tasks to database
- `getUserAIStats(userId)` - Get comprehensive usage statistics
- `getUserPromptHistory(userId, filters)` - Get prompt history with filtering
- `getSessionHistory(userId)` - Get sessions grouped by sessionId
- `clearOldPrompts(userId, daysOld)` - Delete old prompt history

**Key Features:**
- Prompt validation and sanitization
- Session management and tracking
- Usage increment logic
- Integration with LLM service
- Error handling with appropriate status codes

## LLM Service Integration

The AI domain relies on `src/services/llm.service.js`:

### Functions Used:
- `generateTasksFromPrompt(prompt)` - One-shot task generation
- `generateOrRefineTasks(prompt, history)` - Conversational refinement

### Expected Response Format:
```javascript
{
  tasks: [
    {
      title: String,
      description: String,
      priority: String,  // Low, Medium, High
      dueDate: Date,
      tags: [String],
      subTasks: [
        {
          text: String,
          completed: Boolean
        }
      ]
    }
  ]
}
```

## Usage Examples

### Initial Task Generation

```javascript
POST /api/ai/tasks/preview
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt": "Create a 30-day fitness plan for weight loss",
  "sessionId": "fitness-plan-2024-12-25",
  "history": []
}
```

### Refining a Plan

```javascript
POST /api/ai/tasks/preview
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt": "Add more cardio exercises and reduce rest days",
  "sessionId": "fitness-plan-2024-12-25",
  "editedPlan": {
    "tasks": [...]
  },
  "history": [
    {
      "role": "user",
      "content": "Create a 30-day fitness plan for weight loss"
    },
    {
      "role": "assistant",
      "content": "..."
    }
  ]
}
```

### Saving Generated Tasks

```javascript
POST /api/ai/tasks/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt": "Create a weekly meal prep plan"
}
```

### Checking Usage Statistics

```javascript
GET /api/ai/stats
Authorization: Bearer <token>
```

### Viewing Prompt History

```javascript
// Get all prompts
GET /api/ai/prompts/history?limit=50
Authorization: Bearer <token>

// Get prompts for specific session
GET /api/ai/prompts/history?sessionId=fitness-plan-2024-12-25
Authorization: Bearer <token>
```

### Viewing Sessions

```javascript
GET /api/ai/sessions
Authorization: Bearer <token>
```

### Clearing Old Prompts

```javascript
// Delete prompts older than 60 days
DELETE /api/ai/prompts/history?daysOld=60
Authorization: Bearer <token>
```

## Authorization

All endpoints require authentication via the `protect` middleware. All operations are scoped to the authenticated user - users can only access their own prompts, statistics, and history.

## Error Handling

The domain uses consistent error handling:

- **400 Bad Request**: Invalid input (missing/invalid prompt, sessionId, etc.)
- **429 Too Many Requests**: Daily limit or refinement limit exceeded
- **500 Internal Server Error**: LLM service errors, database errors

Service-layer errors include `statusCode` property for proper HTTP response codes.

## Environment Variables

```bash
# AI Configuration
MAX_AI_GENERATIONS_PER_DAY=10           # Daily generation limit per user
CONVERSATION_REFINEMENT_LIMIT=5         # Max refinements per session
```

## Integration Notes

### Current State
- **Status**: ✅ Refactored to Phase 0 architecture
- **Location**: `src/api/ai_refactored/`
- **Old Location**: `src/api/ai/` (to be archived after testing)

### Migration Steps
1. Test all endpoints with various prompts
2. Test daily limit enforcement
3. Test refinement limit enforcement
4. Update `src/routes/index.js` to import from `ai_refactored/`
5. Archive old `ai/` directory as `ai_old/`
6. Rename `ai_refactored/` to `ai/`
7. Update any external documentation or frontend integration

### Breaking Changes
None! The API contract remains identical to the original implementation. All endpoints, request/response formats, and behavior are preserved.

### New Features
- ✅ Added `GET /api/ai/stats` endpoint for usage statistics
- ✅ Added `GET /api/ai/prompts/history` for prompt history
- ✅ Added `GET /api/ai/sessions` for session-grouped history
- ✅ Added `DELETE /api/ai/prompts/history` for history cleanup
- ✅ Comprehensive input validation
- ✅ Better error messages with proper status codes
- ✅ Separated business logic into service layer
- ✅ Enhanced statistics tracking

## Testing Checklist

### Task Generation
- [ ] Generate initial task plan with valid prompt
- [ ] Refine task plan (1-5 refinements)
- [ ] Apply refinement to edited plan
- [ ] Reject prompt shorter than 10 characters
- [ ] Reject prompt longer than 1000 characters
- [ ] Reject missing sessionId
- [ ] Reject refinements beyond limit (6th attempt)
- [ ] Generate and save tasks directly
- [ ] Handle LLM service errors gracefully

### Rate Limiting
- [ ] Daily limit enforcement works
- [ ] Daily count resets at midnight
- [ ] Refinement limit per session works
- [ ] Initial prompts increment daily count
- [ ] Refinements don't increment daily count

### Statistics
- [ ] Get accurate usage statistics
- [ ] Total prompts count is correct
- [ ] Initial vs refinement prompts counted correctly
- [ ] Average refinements calculated correctly
- [ ] Daily usage shows current count

### Prompt History
- [ ] Get all prompts sorted by date
- [ ] Filter prompts by sessionId
- [ ] Limit works correctly (default 50, max 100)
- [ ] Sessions grouped correctly
- [ ] Last 20 sessions returned
- [ ] Delete old prompts works
- [ ] Prompts older than X days deleted

### Edge Cases
- [ ] Handle empty history array
- [ ] Handle malformed editedPlan
- [ ] Handle invalid sessionId format
- [ ] Handle LLM returning empty tasks
- [ ] Handle LLM returning invalid task structure
- [ ] Handle concurrent requests
- [ ] Handle network timeouts

## Performance Considerations

- **Indexing**: Prompt schema includes index on `user` field
- **Daily Limit Check**: Efficient check before expensive LLM calls
- **Bulk Insert**: Uses `insertMany()` for task creation
- **History Pagination**: Default limit prevents overwhelming responses
- **Session Grouping**: MongoDB aggregation for efficient grouping

## Future Enhancements

Potential improvements for future iterations:

1. **Custom Templates**: Save and reuse prompt templates
2. **Shared Templates**: Share templates with community
3. **Template Categories**: Organize templates by category
4. **Export/Import**: Export task plans as JSON/CSV
5. **Prompt Suggestions**: Suggest related prompts based on history
6. **Multi-language Support**: Generate tasks in different languages
7. **Cost Tracking**: Track API costs per user
8. **A/B Testing**: Test different LLM models/prompts
9. **Feedback Loop**: Rate generated plans to improve AI
10. **Voice Input**: Generate tasks from voice recordings

## Related Domains

- **Tasks**: Generated tasks are saved to tasks domain
- **Users**: Daily limits and usage tracking stored in user model
- **Admin** (future): Monitor AI usage across all users

---

**Last Updated**: December 2024  
**Architecture Version**: Phase 0  
**Status**: ✅ Complete and ready for integration
