import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { AuthUser } from '../middleware/auth.js';

interface AuthenticatedSocket extends Socket {
  user?: AuthUser;
}

// Track active connections per user: userId -> Set of socketIds
export const onlineUsers = new Map<string, Set<string>>();

export function setupSocketHandlers(io: Server) {
  // Authentication middleware for Socket.IO
  io.use((socket: AuthenticatedSocket, next) => {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers['authorization']?.startsWith('Bearer ')
        ? socket.handshake.headers['authorization'].slice(7)
        : null);

    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as AuthUser;
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', async (socket: AuthenticatedSocket) => {
    const user = socket.user!;
    const userId = user.id;

    // 1. Manage online presence
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    const userSockets = onlineUsers.get(userId)!;
    const isFirstConnection = userSockets.size === 0;
    userSockets.add(socket.id);

    // Join personal room for targeted events (e.g. multi-tab sync, incoming DM notifications)
    socket.join(`user:${userId}`);

    // Automatically join socket to all rooms the user is authorized to be in
    try {
      const memberships = await prisma.roomMember.findMany({
        where: { userId },
        select: { roomId: true },
      });

      for (const m of memberships) {
        socket.join(m.roomId);
      }
    } catch (err) {
      console.error(`Failed to join rooms for user ${userId}:`, err);
    }

    // Broadcast online status if this is the user's first active socket
    if (isFirstConnection) {
      io.emit('user_presence', {
        userId,
        status: 'online',
      });
    }

    // Return list of currently online user IDs
    socket.on('get_online_users', (callback) => {
      if (typeof callback === 'function') {
        callback(Array.from(onlineUsers.keys()));
      }
    });

    // Request to join a room's socket channel (verified against database membership)
    socket.on('join_room_socket', async ({ roomId }, callback) => {
      try {
        const membership = await prisma.roomMember.findUnique({
          where: { roomId_userId: { roomId, userId } },
        });

        if (!membership) {
          if (typeof callback === 'function') {
            callback({ error: 'Forbidden: You are not a member of this room' });
          }
          return;
        }

        socket.join(roomId);
        if (typeof callback === 'function') {
          callback({ success: true });
        }
      } catch (err) {
        if (typeof callback === 'function') {
          callback({ error: 'Internal server error while joining room socket' });
        }
      }
    });

    // Sending a message
    socket.on('send_message', async (data, callback) => {
      try {
        const { roomId, content, imageUrl, clientTempId } = data || {};

        if (!roomId || (!content?.trim() && !imageUrl)) {
          if (typeof callback === 'function') {
            callback({ error: 'Room ID and message content or image are required.' });
          }
          return;
        }

        const trimmedContent = (content || '').trim();
        if (trimmedContent.length > 4000) {
          if (typeof callback === 'function') {
            callback({ error: 'Message content cannot exceed 4000 characters.' });
          }
          return;
        }

        // CRITICAL CHECK: Verify sender is a member of the room on the server!
        const membership = await prisma.roomMember.findUnique({
          where: { roomId_userId: { roomId, userId } },
        });

        if (!membership) {
          if (typeof callback === 'function') {
            callback({ error: 'Forbidden: You are not a member of this room.' });
          }
          return;
        }

        // Idempotency check with clientTempId to prevent duplicates upon network retry
        if (clientTempId) {
          const existing = await prisma.message.findFirst({
            where: {
              roomId,
              senderId: userId,
              clientTempId,
            },
            include: {
              sender: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          });

          if (existing) {
            const existingPayload = {
              id: existing.id,
              roomId: existing.roomId,
              senderId: existing.senderId,
              content: existing.content,
              imageUrl: existing.imageUrl,
              isEdited: existing.isEdited,
              isDeleted: existing.isDeleted,
              clientTempId: existing.clientTempId,
              createdAt: existing.createdAt,
              updatedAt: existing.updatedAt,
              sender: existing.sender,
            };
            if (typeof callback === 'function') {
              callback({ success: true, message: existingPayload, deduplicated: true });
            }
            return;
          }
        }

        // Create message in database
        const message = await prisma.message.create({
          data: {
            roomId,
            senderId: userId,
            content: trimmedContent,
            imageUrl: imageUrl || null,
            clientTempId: clientTempId || null,
          },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        });

        // Update room updatedAt timestamp
        await prisma.room.update({
          where: { id: roomId },
          data: { updatedAt: new Date() },
        });

        const messagePayload = {
          id: message.id,
          roomId: message.roomId,
          senderId: message.senderId,
          content: message.content,
          imageUrl: message.imageUrl,
          isEdited: message.isEdited,
          isDeleted: message.isDeleted,
          clientTempId: message.clientTempId,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
          sender: message.sender,
        };

        // Broadcast to all room members
        io.to(roomId).emit('new_message', messagePayload);

        // Acknowledge back to sender
        if (typeof callback === 'function') {
          callback({ success: true, message: messagePayload });
        }
      } catch (err) {
        console.error('Error handling send_message:', err);
        if (typeof callback === 'function') {
          callback({ error: 'Failed to send message.' });
        }
      }
    });

    // Typing start indicator
    socket.on('typing_start', async ({ roomId }) => {
      if (!roomId) return;
      try {
        // Verify membership before broadcasting typing
        const membership = await prisma.roomMember.findUnique({
          where: { roomId_userId: { roomId, userId } },
        });
        if (!membership) return;

        socket.to(roomId).emit('user_typing', {
          roomId,
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
          },
        });
      } catch (err) {
        console.error('typing_start error:', err);
      }
    });

    // Typing stop indicator
    socket.on('typing_stop', ({ roomId }) => {
      if (!roomId) return;
      socket.to(roomId).emit('user_stop_typing', {
        roomId,
        userId,
      });
    });

    // Mark room as read via WebSocket
    socket.on('mark_read', async ({ roomId }, callback) => {
      if (!roomId) return;
      try {
        const now = new Date();
        await prisma.roomMember.update({
          where: { roomId_userId: { roomId, userId } },
          data: { lastReadAt: now },
        });

        // Sync read status to user's other open tabs
        socket.to(`user:${userId}`).emit('room_read_ack', {
          roomId,
          lastReadAt: now,
        });

        if (typeof callback === 'function') {
          callback({ success: true, lastReadAt: now });
        }
      } catch (err) {
        console.error('mark_read socket error:', err);
      }
    });

    // Sync missed messages on reconnection (prevents losing or duplicating messages)
    socket.on('sync_missed', async (data, callback) => {
      try {
        const { roomSyncList } = data || {};
        if (!Array.isArray(roomSyncList)) {
          if (typeof callback === 'function') {
            callback({ error: 'roomSyncList must be an array' });
          }
          return;
        }

        const syncResults: Record<string, any[]> = {};

        for (const item of roomSyncList) {
          const { roomId, since } = item;
          if (!roomId) continue;

          // Check membership
          const membership = await prisma.roomMember.findUnique({
            where: { roomId_userId: { roomId, userId } },
          });

          if (!membership) continue;

          const sinceDate = since ? new Date(since) : membership.lastReadAt;

          const missedMessages = await prisma.message.findMany({
            where: {
              roomId,
              createdAt: { gt: sinceDate },
            },
            include: {
              sender: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          });

          syncResults[roomId] = missedMessages.map((m) => ({
            id: m.id,
            roomId: m.roomId,
            senderId: m.senderId,
            content: m.isDeleted ? 'This message was deleted' : m.content,
            imageUrl: m.isDeleted ? null : m.imageUrl,
            isEdited: m.isEdited,
            isDeleted: m.isDeleted,
            clientTempId: m.clientTempId,
            createdAt: m.createdAt,
            updatedAt: m.updatedAt,
            sender: m.sender,
          }));
        }

        if (typeof callback === 'function') {
          callback({ success: true, missedMessages: syncResults });
        }
      } catch (err) {
        console.error('sync_missed error:', err);
        if (typeof callback === 'function') {
          callback({ error: 'Failed to sync missed messages' });
        }
      }
    });

    // Disconnect event
    socket.on('disconnect', () => {
      const remainingSockets = onlineUsers.get(userId);
      if (remainingSockets) {
        remainingSockets.delete(socket.id);
        if (remainingSockets.size === 0) {
          onlineUsers.delete(userId);
          io.emit('user_presence', {
            userId,
            status: 'offline',
            lastSeen: new Date(),
          });
        }
      }
    });
  });
}
