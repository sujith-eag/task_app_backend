/**
 * Socket.IO Chat Handler
 * Real-time messaging with service layer integration
 */

import * as messagesService from '../services/messages.service.js';
import * as conversationsService from '../services/conversations.service.js';
import { validateSocketMessage } from '../validators/chat.validator.js';

// Track online users: { userId: Set(socketId) }
const onlineUsers = {};

/**
 * Broadcast online users to all connected clients
 */
const broadcastOnlineUsers = (io) => {
    io.emit('onlineUsersUpdate', Object.keys(onlineUsers));
};

/**
 * Get recipient socket IDs
 */
const getRecipientSockets = (recipientId) => {
    return onlineUsers[recipientId] ? Array.from(onlineUsers[recipientId]) : [];
};

/**
 * Get sender socket IDs
 */
const getSenderSockets = (senderId) => {
    return onlineUsers[senderId] ? Array.from(onlineUsers[senderId]) : [];
};

/**
 * Handle socket connection and events
 */
export const handleConnection = (socket, io) => {
    const userId = socket.user?.id;
    
    if (!userId) {
        console.warn('Socket connected without user attached, disconnecting', socket.id);
        socket.disconnect(true);
        return;
    }

    // Track user's socket connections
    if (!onlineUsers[userId]) {
        onlineUsers[userId] = new Set();
    }
    onlineUsers[userId].add(socket.id);
    
    broadcastOnlineUsers(io);
    console.log(`User connected: ${socket.user.name || userId} (Socket ID: ${socket.id})`);

    // ========================================
    // SEND MESSAGE EVENT
    // ========================================
    socket.on('sendMessage', async (data, callback) => {
        const senderId = userId;
        
        try {
            console.log(`[sendMessage] Received from ${socket.user.name}:`, data);
            
            // Validate input
            const validationErrors = validateSocketMessage(data);
            if (validationErrors.length > 0) {
                if (callback) {
                    callback({
                        success: false,
                        error: validationErrors.join(', ')
                    });
                }
                return;
            }

            const { recipientId, content, tempId } = data;

            // Find or create conversation using service
            const conversation = await conversationsService.findOrCreateConversation(
                senderId,
                recipientId
            );

            // Create message using service
            const message = await messagesService.createMessage(
                conversation._id,
                senderId,
                content
            );

            // Attach tempId for client-side optimistic updates
            const messageWithTempId = {
                ...message.toObject(),
                tempId
            };

            // Acknowledge sender
            if (callback) {
                callback({
                    success: true,
                    message: messageWithTempId
                });
            }

            // Emit to recipient's devices
            const recipientSockets = getRecipientSockets(recipientId);
            recipientSockets.forEach(sid => {
                io.to(sid).emit('receiveMessage', message);
            });

            // Emit to sender's other devices
            const senderSockets = getSenderSockets(senderId);
            senderSockets.forEach(sid => {
                if (sid !== socket.id) { // Don't send back to originating socket
                    io.to(sid).emit('receiveMessage', message);
                }
            });

        } catch (err) {
            console.error(`Error handling sendMessage from ${senderId}:`, err);
            if (callback) {
                callback({
                    success: false,
                    error: err.message || 'Failed to send message'
                });
            }
        }
    });

    // ========================================
    // TYPING INDICATORS
    // ========================================
    socket.on('startTyping', ({ recipientId, conversationId }) => {
        const recipientSockets = getRecipientSockets(recipientId);
        recipientSockets.forEach(sid => {
            io.to(sid).emit('typing', {
                conversationId,
                from: userId
            });
        });
    });

    socket.on('stopTyping', ({ recipientId, conversationId }) => {
        const recipientSockets = getRecipientSockets(recipientId);
        recipientSockets.forEach(sid => {
            io.to(sid).emit('stopTyping', {
                conversationId,
                from: userId
            });
        });
    });

    // ========================================
    // MARK MESSAGES AS READ
    // ========================================
    socket.on('messagesRead', async ({ conversationId, readerId }) => {
        try {
            // Use service to mark messages as read
            await messagesService.markMessagesAsRead(conversationId, readerId);

            // Get the other participant
            const conversation = await conversationsService.getConversationById(
                conversationId,
                readerId
            );
            
            const otherParticipantId = conversation.participants.find(
                p => p._id.toString() !== readerId
            )?._id.toString();

            if (otherParticipantId) {
                // Notify the other user's devices
                const socketsToNotify = getRecipientSockets(otherParticipantId);
                socketsToNotify.forEach(sid => {
                    io.to(sid).emit('messagesUpdatedToRead', { conversationId });
                });
            }
        } catch (err) {
            console.error('Error marking messages as read:', err);
        }
    });

    // ========================================
    // DISCONNECT CLEANUP
    // ========================================
    socket.on('disconnect', (reason) => {
        console.log(`User disconnected: ${socket.user?.name || userId} (Socket ID: ${socket.id}) reason=${reason}`);
        
        if (onlineUsers[userId]) {
            onlineUsers[userId].delete(socket.id);
            if (onlineUsers[userId].size === 0) {
                delete onlineUsers[userId];
            }
        }

        broadcastOnlineUsers(io);
    });
};

/**
 * Get currently online users (for external access if needed)
 */
export const getOnlineUsers = () => {
    return Object.keys(onlineUsers);
};

/**
 * Check if a user is online
 */
export const isUserOnline = (userId) => {
    return !!onlineUsers[userId] && onlineUsers[userId].size > 0;
};
