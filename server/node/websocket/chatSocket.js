const jwt = require('jsonwebtoken');

const setupChatSocket = (io) => {
  const chatNamespace = io.of('/chat');
  const connectedUsers = new Map();

  chatNamespace.on('connection', (socket) => {
    let isAuthenticated = false;

    socket.on('authenticate', (data) => {
      try {
        const decoded = jwt.verify(data.token, process.env.JWT_SECRET || 'default_secret');
        socket.user = decoded;
        isAuthenticated = true;
        connectedUsers.set(socket.id, decoded.id || decoded.username);
        socket.emit('authenticated', { status: 'success' });
      } catch (err) {
        socket.emit('unauthorized', { error: 'Invalid token' });
        socket.disconnect(true);
      }
    });

    socket.use(([event, ...args], next) => {
      if (!isAuthenticated && event !== 'authenticate') {
        return next(new Error('Authentication required'));
      }
      next();
    });

    socket.on('join_conversation', (conversationId) => {
      socket.join(conversationId);
      socket.emit('joined', { conversationId });
    });

    socket.on('leave_conversation', (conversationId) => {
      socket.leave(conversationId);
      socket.emit('left', { conversationId });
    });

    socket.on('typing', (data) => {
      const { conversationId, isTyping } = data;
      socket.to(conversationId).emit('typing', {
        userId: socket.user.id || socket.user.username,
        isTyping
      });
    });

    socket.on('send_message', async (data) => {
      try {
        const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:5000';
        
        // Fetch is built-in in Node v18+
        const response = await fetch(`${pythonBackendUrl}/api/chat/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.token || socket.handshake.auth?.token}`
          },
          body: JSON.stringify({
            userId: socket.user.id || socket.user.username,
            message: data.message,
            conversationId: data.conversationId
          })
        });

        if (!response.ok) {
          throw new Error('Python backend error');
        }

        const result = await response.json();
        
        if (data.conversationId) {
            chatNamespace.to(data.conversationId).emit('new_message', result);
        } else {
            socket.emit('new_message', result);
        }

      } catch (error) {
        socket.emit('error', { message: 'Failed to process message' });
      }
    });

    socket.on('disconnect', () => {
      connectedUsers.delete(socket.id);
    });
  });
};

module.exports = { setupChatSocket };
