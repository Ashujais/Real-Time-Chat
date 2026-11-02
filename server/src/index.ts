import http from 'http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { config } from './config.js';
import { setupSocketHandlers } from './sockets/socketHandler.js';
import { setIO } from './sockets/socketService.js';
import { prisma } from './db.js';

export const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

setIO(io);
setupSocketHandlers(io);

const PORT = config.port;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`🚀 Chat Server running on http://localhost:${PORT}`);
    console.log(`⚡ WebSocket server active and ready`);
  });
}

process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});
