import Conversation from '../models/conversationModel.js';
import Message from '../models/messageModel.js';

// This object will track online users:
const onlineUsers = {}; // { userId: [socketId1, socketId2] }

export const handleConnection = (socket, io) => {

    const userId = socket.user.id;

    // Track multiple sockets per user
    if (!onlineUsers[userId]){ 
        onlineUsers[userId] = [];
    }
    onlineUsers[userId].push(socket.id);

    // Listen for new messages
// In handleConnection function, this replaces the existing 'sendMessage' listener

socket.on('sendMessage', async (data, callback) => {
    try {
        const { recipientId, content } = data;
        const senderId = socket.user.id;
        
        if (!recipientId || !content?.trim()) {
            // Acknowledge the error back to the sender
            if (callback) callback({ success: false, error: 'Invalid message payload.' });
            return; 
        }

        // --- Database Logic (remains the same, it's already correct) ---
        let conversation = await Conversation.findOne({
            participants: { $all: [senderId, recipientId] },
        });
        if (!conversation) {
            conversation = await Conversation.create({ participants: [senderId, recipientId] });
        }
        const newMessage = await Message.create({
            conversation: conversation._id,
            sender: senderId,
            content: content,
        });
        
        // --- Refined Real-Time Emission Logic ---
        await newMessage.populate('sender', 'name avatar');
        
        // Always acknowledge success to the sender now that the message is saved
        if (callback) callback({ success: true, message: newMessage });
        
        // Emit the message only to the recipient's connected devices
        const recipientSockets = onlineUsers[recipientId] || [];
        recipientSockets.forEach(socketId => {
            io.to(socketId).emit('receiveMessage', newMessage);
        });

    } catch (error) {
        console.error(`Error handling sendMessage from user ${senderId}:`, error);
        if (callback) callback({ success: false, error: 'Failed to send message.' });
    }
});

    // --- Handle typing indicators ---
    socket.on('startTyping', (data) => {
        const { recipientId } = data;
        const recipientSockets = onlineUsers[recipientId] || [];
        recipientSockets.forEach(socketId => {
            io.to(socketId).emit('typing', { conversationId: data.conversationId });
        });
    });

    socket.on('stopTyping', (data) => {
        const { recipientId } = data;
        const recipientSockets = onlineUsers[recipientId] || [];
        recipientSockets.forEach(socketId => {
            io.to(socketId).emit('stopTyping', { conversationId: data.conversationId });
        });
    });


    // Remove user from online users list on disconnection
    // --- Handle disconnect ---
  socket.on('disconnect', () => {
  console.log(`User disconnected: ${socket.user.name} (Socket ID: ${socket.id})`);
    if (onlineUsers[userId]) {
      onlineUsers[userId] = onlineUsers[userId].filter((id) => id !== socket.id);
      if (onlineUsers[userId].length === 0) {
        delete onlineUsers[userId];
      }
    }
  });
};