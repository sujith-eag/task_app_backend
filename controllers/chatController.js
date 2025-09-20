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
    socket.on('sendMessage', async (data) => {
        try {
            const { recipientId, content } = data;
            // Basic validation
            if (!recipientId || !content?.trim()) {
                return socket.emit('sendMessageError', { message: 'Invalid message payload.' });
            }   

        const senderId = socket.user.id;

            // Find or create a conversation between the two users
            let conversation = await Conversation.findOne({
                participants: { $all: [senderId, recipientId] },
            });

            if (!conversation) {
                conversation = await Conversation.create({ participants: [senderId, recipientId] });
            }

            // Create the new message and save it to the database
            const newMessage = await Message.create({
                conversation: conversation._id,
                sender: senderId,
                content: content,
            });

            // If the recipient is online, emit the message to them in real-time

            // --- REFINED EMISSION LOGIC ---
            // Get all of the recipient's online socket IDs
            const recipientSockets = onlineUsers[recipientId] || [];

            // Check if the recipient is actually online
            if (recipientSockets.length > 0) {
                // Populate the sender's info to send along with the message
                await newMessage.populate('sender', 'name avatar');
                
                // Emit the message to each of the recipient's connected devices
                recipientSockets.forEach(socketId => {
                    io.to(socketId).emit('receiveMessage', newMessage);
                });
            }
        } catch (error) {
            console.error(`Error sending message from ${userId} to ${recipientId}:`, error);            
            // Optionally, emit an error event back to the sender
            socket.emit('sendMessageError', { message: 'Failed to send message.' });
        }
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