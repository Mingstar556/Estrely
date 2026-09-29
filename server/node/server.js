const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const xss = require('xss-clean');
const hpp = require('hpp');
const { createProxyMiddleware } = require('http-proxy-middleware');

const securityMiddleware = require('./middleware/security');
const { generalLimiter } = require('./middleware/rateLimiter');
const apiRoutes = require('./routes/api');
const { setupChatSocket } = require('./websocket/chatSocket');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});
app.set('io', io);

setupChatSocket(io);

app.use(helmet());
app.use(cors());
app.use(generalLimiter);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(xss());
app.use(hpp());
app.use(securityMiddleware);

app.use(morgan('dev'));

const pcAppDir = path.join(__dirname, '../../pc');
app.use(express.static(pcAppDir));

const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:5000';

app.use('/api', apiRoutes);
app.use('/api', createProxyMiddleware({
  target: pythonBackendUrl,
  changeOrigin: true,
  pathFilter: (path) => !path.startsWith('/api/health') && !path.startsWith('/api/status')
}));

app.get('*', (req, res) => {
  res.sendFile(path.join(pcAppDir, 'index.html'));
});

const PORT = process.env.NODE_PORT || 3000;
server.listen(PORT, () => {
  console.log(`API Gateway is running on port ${PORT}`);
  console.log(`Serving static files from: ${pcAppDir}`);
  console.log(`Proxying /api requests to: ${pythonBackendUrl}`);
});
