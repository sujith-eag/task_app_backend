

/**
 * Handles all Socket.IO events related to the live attendance feature.
 * @param {Socket} socket - The connected socket instance for a single user.
 */
export const handleAttendanceConnection = (socket) => {
  // Listen for a teacher joining a session-specific room
  socket.on('join-session-room', (sessionId) => {
    if (!sessionId) return;
    socket.join(sessionId); // Add the teacher's socket to the room
    console.log(`[Attendance] Socket ${socket.id} joined room ${sessionId}`);
  });

  // Listen for a teacher leaving a session-specific room
  socket.on('leave-session-room', (sessionId) => {
    if (!sessionId) return;
    socket.leave(sessionId); // Remove the teacher's socket from the room
    console.log(`[Attendance] Socket ${socket.id} left room ${sessionId}`);
  });

  // No 'disconnect' logic is needed here because the main server
  // disconnect event automatically removes the socket from all rooms it has joined.
};