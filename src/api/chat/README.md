# Chat Domain - Phase 0 Architecture

## Overview

The **Chat** domain handles real-time messaging between users with support for conversations, typing indicators, read receipts, and online presence. This refactored implementation follows the Phase 0 architecture pattern with clear separation of concerns.

## Directory Structure

```
src/api/chat_refactored/
├── controllers/
│   ├── conversations.controller.js   # HTTP handlers for conversations
│   └── messages.controller.js        # HTTP handlers for messages
├── services/
│   ├── conversations.service.js      # Business logic for conversations
│   └── messages.service.js           # Business logic for messages
├── socket/
│   └── chat.socket.js                # Socket.IO real-time messaging
├── routes/
│   └── chat.routes.js                # API route definitions
├── validators/
│   └── chat.validator.js             # Input validation rules
└── README.md                          # This file
```

## Features

### Conversations
- ✅ **Find or Create**: Automatically create conversations between two users
- ✅ **List Conversations**: Get all conversations for a user (sorted by recent)
- ✅ **View Conversation**: Get specific conversation with participant details
- ✅ **Delete Conversation**: Remove conversation and all messages
- ✅ **Last Message**: Track most recent message for UI previews

### Messages
- ✅ **Real-time Messaging**: Send/receive messages via Socket.IO
- ✅ **HTTP Endpoints**: REST API for message operations
- ✅ **Pagination**: Load messages in chunks (default 50)
- ✅ **Read Receipts**: Track message read status (sent/delivered/read)
- ✅ **Unread Counts**: Get unread message counts per conversation or total
- ✅ **Message Search**: Search messages within a conversation
- ✅ **Message Deletion**: Delete own messages

### Real-time Features
- ✅ **Socket.IO Integration**: Instant message delivery
- ✅ **Typing Indicators**: Show when users are typing
- ✅ **Online Presence**: Track and broadcast online users
- ✅ **Multi-device Support**: Sync across multiple browser tabs/devices
- ✅ **Optimistic Updates**: Client-side tempId for immediate UI feedback

## API Endpoints

### Conversation Endpoints

#### GET /api/chat/conversations
Get all conversations for the authenticated user.

**Response:** `200 OK`
```json
[
  {
    "_id": "conv_id",
    "participants": [
      {
        "_id": "user_id_1",
        "name": "Alice",
        "avatar": "avatar_url"
      },
      {
        "_id": "user_id_2",
        "name": "Bob",
        "avatar": "avatar_url"
      }
    ],
    "lastMessage": {
      "_id": "message_id",
      "content": "Hello!",
      "createdAt": "2024-12-25T10:00:00.000Z"
    },
    "createdAt": "2024-12-20T09:00:00.000Z",
    "updatedAt": "2024-12-25T10:00:00.000Z"
  }
]
```

#### POST /api/chat/conversations
Find or create a conversation with another user.

**Request Body:**
```json
{
  "recipientId": "user_id"
}
```

**Response:** `200 OK` (same structure as GET conversations)

#### GET /api/chat/conversations/:id
Get a specific conversation by ID.

**Response:** `200 OK` (single conversation object)

#### DELETE /api/chat/conversations/:id
Delete a conversation.

**Response:** `200 OK`
```json
{
  "id": "conv_id"
}
```

### Message Endpoints

#### GET /api/chat/conversations/:id/messages
Get messages for a conversation with pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Messages per page (default: 50, max: 100)

**Response:** `200 OK`
```json
[
  {
    "_id": "message_id",
    "conversation": "conv_id",
    "sender": {
      "_id": "user_id",
      "name": "Alice",
      "avatar": "avatar_url"
    },
    "content": "Hello! How are you?",
    "status": "read",
    "createdAt": "2024-12-25T10:00:00.000Z",
    "updatedAt": "2024-12-25T10:05:00.000Z"
  }
]
```

#### POST /api/chat/conversations/:id/messages
Create a new message (typically handled via Socket.IO).

**Request Body:**
```json
{
  "content": "Hello! How are you?"
}
```

**Response:** `201 Created`

#### GET /api/chat/conversations/:id/messages/search
Search messages in a conversation.

**Query Parameters:**
- `q`: Search query (required)

**Response:** `200 OK` (array of matching messages)

#### GET /api/chat/conversations/:id/messages/unread
Get unread message count for a specific conversation.

**Response:** `200 OK`
```json
{
  "count": 5
}
```

#### GET /api/chat/messages/unread/total
Get total unread message count across all conversations.

**Response:** `200 OK`
```json
{
  "count": 12
}
```

#### PUT /api/chat/conversations/:id/messages/read
Mark all messages in a conversation as read.

**Response:** `200 OK`
```json
{
  "modifiedCount": 5,
  "conversationId": "conv_id"
}
```

#### DELETE /api/chat/messages/:id
Delete a specific message (only sender can delete their own messages).

**Response:** `200 OK`
```json
{
  "id": "message_id"
}
```

## Socket.IO Events

### Client → Server

#### `sendMessage`
Send a new message.

**Payload:**
```javascript
{
  recipientId: "user_id",
  content: "Hello!",
  tempId: "temp_uuid" // For optimistic updates
}
```

**Callback Response:**
```javascript
{
  success: true,
  message: {
    _id: "message_id",
    conversation: "conv_id",
    sender: { ... },
    content: "Hello!",
    status: "sent",
    createdAt: "...",
    tempId: "temp_uuid"
  }
}
```

#### `startTyping`
Indicate user is typing.

**Payload:**
```javascript
{
  recipientId: "user_id",
  conversationId: "conv_id"
}
```

#### `stopTyping`
Indicate user stopped typing.

**Payload:**
```javascript
{
  recipientId: "user_id",
  conversationId: "conv_id"
}
```

#### `messagesRead`
Mark messages as read.

**Payload:**
```javascript
{
  conversationId: "conv_id",
  readerId: "user_id"
}
```

### Server → Client

#### `receiveMessage`
Receive a new message.

**Payload:**
```javascript
{
  _id: "message_id",
  conversation: "conv_id",
  sender: { ... },
  content: "Hello!",
  status: "sent",
  createdAt: "..."
}
```

#### `typing`
User is typing.

**Payload:**
```javascript
{
  conversationId: "conv_id",
  from: "user_id"
}
```

#### `stopTyping`
User stopped typing.

**Payload:**
```javascript
{
  conversationId: "conv_id",
  from: "user_id"
}
```

#### `messagesUpdatedToRead`
Messages have been read.

**Payload:**
```javascript
{
  conversationId: "conv_id"
}
```

#### `onlineUsersUpdate`
Online users list updated.

**Payload:**
```javascript
["user_id_1", "user_id_2", "user_id_3"]
```

## Data Models

### Conversation Schema

```javascript
{
  participants: [ObjectId],      // Array of 2 user IDs
  lastMessage: ObjectId,         // Reference to most recent message
  createdAt: Date,              // Auto-generated
  updatedAt: Date               // Auto-generated
}
```

### Message Schema

```javascript
{
  conversation: ObjectId,        // Reference to conversation (indexed)
  sender: ObjectId,             // Reference to user who sent message
  content: String,              // Message text (required, trimmed)
  status: String,               // Enum: sent, delivered, read (default: sent)
  createdAt: Date,             // Auto-generated
  updatedAt: Date              // Auto-generated
}
```

## Validation Rules

### Conversation Creation
- `recipientId`: Required, must be valid MongoDB ObjectId

### Message Creation
- `content`: Required, 1-5000 characters

### Message Pagination
- `page`: Optional, positive integer (default: 1)
- `limit`: Optional, 1-100 (default: 50)

### Message Search
- `q`: Required, 1-100 characters

### Socket.IO Message
- `recipientId`: Required, valid string
- `content`: Required, 1-5000 characters
- `tempId`: Optional, for optimistic updates

## Authorization

All endpoints require authentication via the `protect` middleware. Authorization is enforced at the service layer:

- **Conversation Access**: Users can only access conversations they're participants in
- **Message Operations**: Users can only read messages from their conversations
- **Message Deletion**: Users can only delete their own messages
- **403 Forbidden**: Returned when attempting unauthorized access

## Error Handling

The domain uses consistent error handling:

- **400 Bad Request**: Invalid input (missing required fields, validation errors)
- **403 Forbidden**: Unauthorized access to conversation/message
- **404 Not Found**: Conversation or message not found
- **500 Internal Server Error**: Unexpected server errors

Service-layer errors include `statusCode` property for proper HTTP response codes.

## Service Layer Architecture

### conversations.service.js

Handles conversation operations:
- `findOrCreateConversation(senderId, recipientId)` - Find or create conversation
- `getUserConversations(userId)` - Get all user's conversations
- `getConversationById(conversationId, userId)` - Get specific conversation
- `updateLastMessage(conversationId, messageId)` - Update last message reference
- `verifyParticipant(conversationId, userId)` - Check user is participant
- `deleteConversation(conversationId, userId)` - Delete conversation

### messages.service.js

Handles message operations:
- `createMessage(conversationId, senderId, content)` - Create new message
- `getConversationMessages(conversationId, userId, pagination)` - Get messages with pagination
- `markMessagesAsRead(conversationId, readerId)` - Mark messages as read
- `getUnreadCount(conversationId, userId)` - Get unread count for conversation
- `getTotalUnreadCount(userId)` - Get total unread count
- `deleteMessage(messageId, userId)` - Delete message
- `searchMessages(conversationId, userId, query)` - Search messages

## Socket.IO Architecture

### chat.socket.js

**Features:**
- Online user tracking with multi-device support
- Message sending with service layer integration
- Typing indicators
- Read receipts
- Optimistic updates with tempId
- Error handling with client callbacks

**Helper Functions:**
- `broadcastOnlineUsers(io)` - Broadcast online user list
- `getRecipientSockets(recipientId)` - Get recipient's socket IDs
- `getSenderSockets(senderId)` - Get sender's socket IDs
- `getOnlineUsers()` - Get list of online users
- `isUserOnline(userId)` - Check if user is online

## Usage Examples

### Creating a Conversation

```javascript
POST /api/chat/conversations
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.
Content-Type: application/json

{
  "recipientId": "507f1f77bcf86cd799439011"
}
```

### Sending a Message (Socket.IO)

```javascript
socket.emit('sendMessage', {
  recipientId: "507f1f77bcf86cd799439011",
  content: "Hello! How are you?",
  tempId: "temp-uuid-123"
}, (response) => {
  if (response.success) {
    console.log('Message sent:', response.message);
  } else {
    console.error('Error:', response.error);
  }
});
```

### Getting Messages with Pagination

```javascript
GET /api/chat/conversations/507f1f77bcf86cd799439011/messages?page=1&limit=50
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.
```

### Marking Messages as Read

```javascript
PUT /api/chat/conversations/507f1f77bcf86cd799439011/messages/read
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.
```

### Typing Indicators

```javascript
// Start typing
socket.emit('startTyping', {
  recipientId: "507f1f77bcf86cd799439011",
  conversationId: "607f1f77bcf86cd799439012"
});

// Stop typing
socket.emit('stopTyping', {
  recipientId: "507f1f77bcf86cd799439011",
  conversationId: "607f1f77bcf86cd799439012"
});

// Listen for typing
socket.on('typing', ({ conversationId, from }) => {
  console.log(`User ${from} is typing in ${conversationId}`);
});
```

### Searching Messages

```javascript
GET /api/chat/conversations/507f1f77bcf86cd799439011/messages/search?q=hello
Auth: Browser: httpOnly cookie `jwt` (use a central apiClient with credentials). For non-browser/testing, send `Cookie: jwt=YOUR_TOKEN`.
```

## Integration Notes

### Current State
- **Status**: ✅ Refactored to Phase 0 architecture
- **Location**: `src/api/chat_refactored/`
- **Old Location**: `src/api/chat/` (to be archived after testing)

### Migration Steps
1. Test all endpoints with existing data
2. Test Socket.IO events in real-time
3. Update `src/routes/index.js` to import from `chat_refactored/`
4. Update `server.js` to use new socket handler
5. Archive old `chat/` directory as `chat_old/`
6. Rename `chat_refactored/` to `chat/`
7. Update any external documentation or frontend integration

### Breaking Changes
None! The API contract remains identical to the original implementation. All endpoints, Socket.IO events, and behavior are preserved.

### New Features
- ✅ Added validation middleware with detailed error messages
- ✅ Added `GET /api/chat/conversations/:id` endpoint
- ✅ Added `GET /api/chat/messages/unread/total` for total unread count
- ✅ Added `GET /api/chat/conversations/:id/messages/unread` for conversation unread count
- ✅ Added `GET /api/chat/conversations/:id/messages/search` for message search
- ✅ Added `DELETE /api/chat/messages/:id` for message deletion
- ✅ Added `DELETE /api/chat/conversations/:id` for conversation deletion
- ✅ Improved error messages with proper status codes
- ✅ Added comprehensive input validation
- ✅ Separated business logic into service layer

## Testing Checklist

### Conversation Operations
- [ ] Create new conversation
- [ ] Find existing conversation
- [ ] Get all conversations
- [ ] Get specific conversation by ID
- [ ] Delete conversation
- [ ] Verify participant authorization
- [ ] Handle non-existent recipient
- [ ] Handle invalid conversation ID

### Message Operations (HTTP)
- [ ] Get messages with default pagination
- [ ] Get messages with custom pagination
- [ ] Create message via HTTP endpoint
- [ ] Mark messages as read
- [ ] Get unread count for conversation
- [ ] Get total unread count
- [ ] Search messages
- [ ] Delete own message
- [ ] Verify cannot delete others' messages
- [ ] Handle non-existent conversation
- [ ] Handle invalid message content

### Socket.IO Operations
- [ ] Connect to socket
- [ ] Send message
- [ ] Receive message
- [ ] Multi-device message sync
- [ ] Typing indicators (start/stop)
- [ ] Online presence updates
- [ ] Read receipts
- [ ] Optimistic updates with tempId
- [ ] Error callbacks
- [ ] Disconnect cleanup

### Edge Cases
- [ ] Empty message content
- [ ] Message exceeding 5000 characters
- [ ] Invalid MongoDB ObjectId
- [ ] Unauthorized conversation access
- [ ] Concurrent message sends
- [ ] Network disconnections
- [ ] Multiple tabs/devices

## Performance Considerations

- **Indexing**: Message schema includes index on `conversation` field for efficient querying
- **Pagination**: Default 50 messages per page to prevent overwhelming responses
- **Socket.IO**: Multi-device support with Set-based socket tracking
- **Online Users**: Efficient in-memory tracking with automatic cleanup
- **Read Status**: Bulk updates with `updateMany()` for efficiency

## Future Enhancements

Potential improvements for future iterations:

1. **Message Reactions**: Emoji reactions to messages
2. **File Attachments**: Share files/images in chat
3. **Voice Messages**: Record and send audio messages
4. **Group Chats**: Support for multi-user conversations
5. **Message Editing**: Edit sent messages
6. **Message Formatting**: Markdown or rich text support
7. **Push Notifications**: Mobile/desktop notifications
8. **Message Encryption**: End-to-end encryption
9. **Chat History Export**: Download conversation history
10. **Block Users**: Block/unblock functionality

## Related Domains

- **Users**: Conversation participants and authentication
- **Files** (future): Share files in conversations
- **Admin**: Moderation and monitoring

---

**Last Updated**: December 2024  
**Architecture Version**: Phase 0  
**Status**: ✅ Complete and ready for integration
