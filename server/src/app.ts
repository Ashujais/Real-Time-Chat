import express from 'express';
import cors from 'cors';
import path from 'path';
import { authRouter } from './routes/auth.routes.js';
import { roomsRouter } from './routes/rooms.routes.js';
import { messagesRouter } from './routes/messages.routes.js';
import { uploadRouter } from './routes/upload.routes.js';

export const app = express();

app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded images statically
const uploadsDir = path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount API routes
app.use('/api/auth', authRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/upload', uploadRouter);

// Global 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Centralized error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error', details: err?.message });
});
