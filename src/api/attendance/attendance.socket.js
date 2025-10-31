/**
 * Attendance Socket Handler (Phase 0 - Attendance Domain)
 * 
 * Handles real-time attendance updates via Socket.IO
 */

class AttendanceSocketHandler {
  /**
   * Initialize socket handlers
   * @param {object} io - Socket.IO server instance
   */
  initialize(io) {
    io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`);
      
      // Join session room (for teacher to receive real-time updates)
      socket.on('join-session-room', (data) => {
        const { sessionId, userRole } = data;
        
        if (!sessionId) {
          socket.emit('error', { message: 'Session ID is required' });
          return;
        }
        
        const roomName = `session_${sessionId}`;
        socket.join(roomName);
        
        console.log(`${userRole || 'User'} joined session room: ${roomName}`);
        
        socket.emit('joined-session-room', {
          sessionId,
          roomName,
          message: 'Successfully joined session room'
        });
      });
      
      // Leave session room
      socket.on('leave-session-room', (data) => {
        const { sessionId } = data;
        
        if (!sessionId) {
          socket.emit('error', { message: 'Session ID is required' });
          return;
        }
        
        const roomName = `session_${sessionId}`;
        socket.leave(roomName);
        
        console.log(`User left session room: ${roomName}`);
        
        socket.emit('left-session-room', {
          sessionId,
          roomName,
          message: 'Successfully left session room'
        });
      });
      
      // Disconnect handler
      socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
      });
    });
  }
  
  /**
   * Emit attendance marked event
   * @param {object} io - Socket.IO server instance
   * @param {string} sessionId - Class session ID
   * @param {object} data - { recordId, studentId, status, markedAt }
   */
  emitAttendanceMarked(io, sessionId, data) {
    io.to(`session_${sessionId}`).emit('attendance-marked', data);
  }
  
  /**
   * Emit attendance updated event
   * @param {object} io - Socket.IO server instance
   * @param {string} sessionId - Class session ID
   * @param {object} data - { recordId, studentId, status }
   */
  emitAttendanceUpdated(io, sessionId, data) {
    io.to(`session_${sessionId}`).emit('attendance-updated', data);
  }
  
  /**
   * Emit session finalized event
   * @param {object} io - Socket.IO server instance
   * @param {string} sessionId - Class session ID
   * @param {object} data - { sessionId, attendanceSummary }
   */
  emitSessionFinalized(io, sessionId, data) {
    io.to(`session_${sessionId}`).emit('session-finalized', data);
  }
  
  /**
   * Emit code regenerated event
   * @param {object} io - Socket.IO server instance
   * @param {string} sessionId - Class session ID
   * @param {object} data - { attendanceCode, codeExpiresAt }
   */
  emitCodeRegenerated(io, sessionId, data) {
    io.to(`session_${sessionId}`).emit('code-regenerated', data);
  }
}

export default new AttendanceSocketHandler();
