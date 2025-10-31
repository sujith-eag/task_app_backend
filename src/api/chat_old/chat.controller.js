// controllers/chatController.js
import Conversation from '../../models/conversationModel.js';
import Message from '../../models/messageModel.js';

// { userId: Set(socketId) }
const onlineUsers = {}; // keep as plain object of Sets


const broadcastOnlineUsers = (io) => {
    // Send an array of user IDs that are currently online
    io.emit('onlineUsersUpdate', Object.keys(onlineUsers));
};


export const handleConnection = (socket, io) => {
  const userId = socket.user?.id;
  if (!userId) {
    console.warn('Socket connected without user attached, disconnecting', socket.id);
    socket.disconnect(true);
    return;
  }

  // Track sockets per user (use Set to avoid dupes)
  if (!onlineUsers[userId]) onlineUsers[userId] = new Set();
  onlineUsers[userId].add(socket.id);
  
  broadcastOnlineUsers(io); // Notify everyone of the new online user
  
  console.log(`User connected: ${socket.user.name || userId} (Socket ID: ${socket.id})`);

  // SEND MESSAGE: use callback ack from client. Define senderId outside try so catch can safely reference it.
  socket.on('sendMessage', async (data, callback) => {
    const senderId = userId;
    try {
      console.log(`[sendMessage] Received from ${socket.user.name}:`, data);
      
      const { recipientId, content, tempId } = data || {};

      // Validate
      if (!recipientId || !content?.trim()) {
        if (callback) callback({ success: false, error: 'Invalid message payload.' });
        return;
      }

      // Find or create conversation
      let conversation = await Conversation.findOne({
        participants: { $all: [senderId, recipientId] },
      });
      if (!conversation) {
        conversation = await Conversation.create({ participants: [senderId, recipientId] });
      }

      // Save message
      let newMessage = await Message.create({
        conversation: conversation._id,
        sender: senderId,
        content,
      });
      await newMessage.populate('sender', 'name avatar');

      // Convert Mongoose document to a plain object to add a property
      const finalMessage = newMessage.toObject(); 
      finalMessage.tempId = tempId; // Attach the original tempId to the response
  
      // Add this line to update the conversation's lastMessage field
      conversation.lastMessage = newMessage._id;
      await conversation.save();

      // Ack sender with saved message
      if (callback) callback({ success: true, message: finalMessage });

      // Emit to recipient devices (if any)
      const recipientSockets = onlineUsers[recipientId] ? Array.from(onlineUsers[recipientId]) : [];
      recipientSockets.forEach(sid => io.to(sid).emit('receiveMessage', newMessage));

      // Emit to all sender devices (so every open tab sees it)
      const senderSockets = onlineUsers[senderId] ? Array.from(onlineUsers[senderId]) : [];
      senderSockets.forEach(sid => io.to(sid).emit('receiveMessage', newMessage));

    } catch (err) {
      console.error(`Error handling sendMessage from ${senderId}:`, err);
      if (callback) callback({ success: false, error: 'Failed to send message.' });
    }
  });

  // Typing indicators
  socket.on('startTyping', ({ recipientId, conversationId }) => {
    const recipientSockets = onlineUsers[recipientId] ? Array.from(onlineUsers[recipientId]) : [];
    recipientSockets.forEach(sid => io.to(sid).emit('typing', { conversationId, from: userId }));
  });

  socket.on('stopTyping', ({ recipientId, conversationId }) => {
    const recipientSockets = onlineUsers[recipientId] ? Array.from(onlineUsers[recipientId]) : [];
    recipientSockets.forEach(sid => io.to(sid).emit('stopTyping', { conversationId, from: userId }));
  });

  
  socket.on('messagesRead', async ({ conversationId, readerId }) => {
      // Update all messages in the conversation that were not sent by the reader
      await Message.updateMany(
          { conversation: conversationId, sender: { $ne: readerId }, status: { $ne: 'read' } },
          { $set: { status: 'read' } }
      );

      // Find the other participant to notify them
      const conversation = await Conversation.findById(conversationId);
      const otherParticipantId = conversation.participants.find(p => p.toString() !== readerId);
      
      // Notify the other user's devices that their messages have been read
      const socketsToNotify = onlineUsers[otherParticipantId] ? Array.from(onlineUsers[otherParticipantId]) : [];
      socketsToNotify.forEach(sid => io.to(sid).emit('messagesUpdatedToRead', { conversationId }));
  });

  // Disconnect cleanup
  socket.on('disconnect', (reason) => {
    console.log(`User disconnected: ${socket.user?.name || userId} (Socket ID: ${socket.id}) reason=${reason}`);
    if (onlineUsers[userId]) {
      onlineUsers[userId].delete(socket.id);
      if (onlineUsers[userId].size === 0) delete onlineUsers[userId];
    }

    broadcastOnlineUsers(io); // Notify everyone that a user went offline
  });
};