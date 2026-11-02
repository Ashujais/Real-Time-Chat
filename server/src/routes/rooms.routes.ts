import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { emitToRoom } from '../sockets/socketService.js';

export const roomsRouter = Router();

const createRoomSchema = z.object({
  name: z
    .string()
    .min(2, 'Room name must be at least 2 characters')
    .max(50, 'Room name cannot exceed 50 characters')
    .regex(/^[a-zA-Z0-9_\- ]+$/, 'Room name can only contain letters, numbers, spaces, hyphens, and underscores'),
  description: z.string().max(255, 'Description cannot exceed 255 characters').optional(),
  isPrivate: z.boolean().optional().default(false),
});

const createDirectSchema = z.object({
  recipientId: z.string().uuid('Invalid recipient user ID'),
});

const messagesQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(30),
  cursor: z.string().optional(),
});

// GET /api/rooms - List all rooms the authenticated user belongs to
roomsRouter.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const memberships = await prisma.roomMember.findMany({
      where: { userId },
      include: {
        room: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                sender: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { room: { updatedAt: 'desc' } },
    });

    const roomsWithDetails = await Promise.all(
      memberships.map(async (membership) => {
        const room = membership.room;
        const lastReadAt = membership.lastReadAt;

        // Unread message count: messages created after lastReadAt by other users that are not deleted
        const unreadCount = await prisma.message.count({
          where: {
            roomId: room.id,
            senderId: { not: userId },
            createdAt: { gt: lastReadAt },
            isDeleted: false,
          },
        });

        // For DIRECT rooms, identify the other participant
        let otherUser = null;
        let displayName = room.name;

        if (room.type === 'DIRECT') {
          const otherMember = room.members.find((m) => m.userId !== userId);
          if (otherMember) {
            otherUser = otherMember.user;
            displayName = otherMember.user.displayName;
          }
        }

        const lastMsg = room.messages[0] || null;

        return {
          id: room.id,
          name: room.name,
          displayName,
          type: room.type,
          description: room.description,
          isPrivate: room.isPrivate,
          createdById: room.createdById,
          createdAt: room.createdAt,
          updatedAt: room.updatedAt,
          memberCount: room.members.length,
          members: room.members.map((m) => ({
            id: m.user.id,
            username: m.user.username,
            displayName: m.user.displayName,
            avatarUrl: m.user.avatarUrl,
            role: m.role,
          })),
          otherUser,
          unreadCount,
          lastMessage: lastMsg
            ? {
                id: lastMsg.id,
                content: lastMsg.isDeleted ? 'This message was deleted' : lastMsg.content,
                imageUrl: lastMsg.isDeleted ? null : lastMsg.imageUrl,
                createdAt: lastMsg.createdAt,
                sender: lastMsg.sender,
              }
            : null,
        };
      })
    );

    // Sort by latest message date or room update date
    roomsWithDetails.sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : new Date(a.updatedAt).getTime();
      const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : new Date(b.updatedAt).getTime();
      return timeB - timeA;
    });

    res.json({ rooms: roomsWithDetails });
  } catch (error) {
    console.error('Fetch rooms error:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// GET /api/rooms/public - Browse public group rooms not yet joined
roomsRouter.get('/public', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const userMemberships = await prisma.roomMember.findMany({
      where: { userId },
      select: { roomId: true },
    });
    const joinedRoomIds = userMemberships.map((m) => m.roomId);

    const publicRooms = await prisma.room.findMany({
      where: {
        type: 'GROUP',
        isPrivate: false,
        id: { notIn: joinedRoomIds },
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      rooms: publicRooms.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        memberCount: r._count.members,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error('Fetch public rooms error:', error);
    res.status(500).json({ error: 'Failed to fetch public rooms' });
  }
});

// POST /api/rooms - Create a new group room
roomsRouter.post('/', authenticateToken, validateBody(createRoomSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, description, isPrivate } = req.body;

    const trimmedName = name.trim();

    const existing = await prisma.room.findFirst({
      where: {
        name: { equals: trimmedName },
        type: 'GROUP',
      },
    });

    if (existing) {
      res.status(409).json({ error: `A room named "${trimmedName}" already exists.` });
      return;
    }

    const room = await prisma.room.create({
      data: {
        name: trimmedName,
        description: description?.trim() || null,
        isPrivate: !!isPrivate,
        type: 'GROUP',
        createdById: userId,
        members: {
          create: {
            userId,
            role: 'ADMIN',
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    res.status(201).json({
      message: 'Room created successfully',
      room: {
        id: room.id,
        name: room.name,
        displayName: room.name,
        type: room.type,
        description: room.description,
        isPrivate: room.isPrivate,
        createdById: room.createdById,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
        memberCount: 1,
        unreadCount: 0,
        otherUser: null,
        lastMessage: null,
        members: room.members.map((m) => ({
          id: m.user.id,
          username: m.user.username,
          displayName: m.user.displayName,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
        })),
      },
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// POST /api/rooms/direct - Start or find existing direct message room
roomsRouter.post('/direct', authenticateToken, validateBody(createDirectSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { recipientId } = req.body;

    if (recipientId === userId) {
      res.status(400).json({ error: 'You cannot start a direct message with yourself.' });
      return;
    }

    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    });

    if (!recipient) {
      res.status(404).json({ error: 'Recipient user not found.' });
      return;
    }

    const existingRoom = await prisma.room.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: recipientId } } },
        ],
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (existingRoom) {
      res.status(200).json({
        room: {
          id: existingRoom.id,
          name: recipient.displayName,
          displayName: recipient.displayName,
          type: 'DIRECT',
          description: null,
          isPrivate: true,
          createdById: existingRoom.createdById,
          createdAt: existingRoom.createdAt,
          updatedAt: existingRoom.updatedAt,
          memberCount: 2,
          unreadCount: 0,
          otherUser: recipient,
          members: existingRoom.members.map((m) => ({
            id: m.user.id,
            username: m.user.username,
            displayName: m.user.displayName,
            avatarUrl: m.user.avatarUrl,
            role: m.role,
          })),
        },
      });
      return;
    }

    const newRoom = await prisma.room.create({
      data: {
        type: 'DIRECT',
        isPrivate: true,
        createdById: userId,
        members: {
          create: [
            { userId, role: 'MEMBER' },
            { userId: recipientId, role: 'MEMBER' },
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    res.status(201).json({
      room: {
        id: newRoom.id,
        name: recipient.displayName,
        displayName: recipient.displayName,
        type: 'DIRECT',
        description: null,
        isPrivate: true,
        createdById: newRoom.createdById,
        createdAt: newRoom.createdAt,
        updatedAt: newRoom.updatedAt,
        memberCount: 2,
        unreadCount: 0,
        otherUser: recipient,
        members: newRoom.members.map((m) => ({
          id: m.user.id,
          username: m.user.username,
          displayName: m.user.displayName,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
        })),
      },
    });
  } catch (error) {
    console.error('Direct message room error:', error);
    res.status(500).json({ error: 'Failed to create or fetch direct message room' });
  }
});

// POST /api/rooms/:id/join - Join a public group room
roomsRouter.post('/:id/join', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const roomId = req.params.id as string;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }

    if (room.type === 'DIRECT') {
      res.status(403).json({ error: 'Cannot join direct message rooms directly.' });
      return;
    }

    if (room.isPrivate) {
      res.status(403).json({ error: 'This room is private.' });
      return;
    }

    const existingMember = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: { roomId, userId },
      },
    });

    if (existingMember) {
      res.status(400).json({ error: 'You are already a member of this room.' });
      return;
    }

    await prisma.roomMember.create({
      data: {
        roomId,
        userId,
        role: 'MEMBER',
      },
    });

    emitToRoom(roomId, 'member_joined', {
      roomId,
      user: {
        id: req.user!.id,
        username: req.user!.username,
        displayName: req.user!.displayName,
      },
    });

    res.json({ message: 'Successfully joined room', roomId });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// POST /api/rooms/:id/leave - Leave a group room
roomsRouter.post('/:id/leave', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const roomId = req.params.id as string;

    const membership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!membership) {
      res.status(400).json({ error: 'You are not a member of this room.' });
      return;
    }

    await prisma.roomMember.delete({
      where: { roomId_userId: { roomId, userId } },
    });

    emitToRoom(roomId, 'member_left', {
      roomId,
      userId,
      username: req.user!.username,
    });

    res.json({ message: 'Successfully left room', roomId });
  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({ error: 'Failed to leave room' });
  }
});

// GET /api/rooms/:id - Get single room metadata (Verifies membership!)
roomsRouter.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const roomId = req.params.id as string;

    // Check membership on server!
    const membership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: {
        room: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, username: true, displayName: true, avatarUrl: true },
                },
              },
            },
          },
        },
      },
    });

    if (!membership) {
      res.status(403).json({ error: 'Access denied: You are not a member of this room.' });
      return;
    }

    const room = membership.room;
    let otherUser = null;
    let displayName = room.name;

    if (room.type === 'DIRECT') {
      const otherMember = room.members.find((m) => m.userId !== userId);
      if (otherMember) {
        otherUser = otherMember.user;
        displayName = otherMember.user.displayName;
      }
    }

    res.json({
      room: {
        id: room.id,
        name: room.name,
        displayName,
        type: room.type,
        description: room.description,
        isPrivate: room.isPrivate,
        createdById: room.createdById,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
        memberCount: room.members.length,
        otherUser,
        members: room.members.map((m) => ({
          id: m.user.id,
          username: m.user.username,
          displayName: m.user.displayName,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
        })),
      },
    });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// GET /api/rooms/:id/messages - Paginated message history (CRITICAL CHECK: only room members!)
roomsRouter.get('/:id/messages', authenticateToken, validateQuery(messagesQuerySchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const roomId = req.params.id as string;
    const limit = Number(req.query.limit) || 30;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    // 1. Verify user is a member of the room on the server
    const membership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!membership) {
      res.status(403).json({ error: 'Access denied: You are not a member of this room.' });
      return;
    }

    // 2. Determine cursor condition
    let cursorDate: Date | undefined;
    if (cursor) {
      const cursorMessage = await prisma.message.findUnique({
        where: { id: cursor },
        select: { createdAt: true },
      });
      if (cursorMessage) {
        cursorDate = cursorMessage.createdAt;
      }
    }

    // Fetch messages before cursorDate (older messages)
    const messages = await prisma.message.findMany({
      where: {
        roomId,
        ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
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
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    const resultMessages = hasMore ? messages.slice(0, limit) : messages;

    resultMessages.reverse();

    const nextCursor = hasMore && resultMessages.length > 0 ? resultMessages[0].id : null;

    res.json({
      messages: resultMessages.map((m) => ({
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
      })),
      hasMore,
      nextCursor,
    });
  } catch (error) {
    console.error('Fetch messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/rooms/:id/read - Mark room messages as read
roomsRouter.post('/:id/read', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const roomId = req.params.id as string;

    const membership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!membership) {
      res.status(403).json({ error: 'Access denied: You are not a member of this room.' });
      return;
    }

    const now = new Date();
    await prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { lastReadAt: now },
    });

    res.json({ success: true, lastReadAt: now });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark room as read' });
  }
});

// GET /api/rooms/:id/sync - Sync missed messages after connection drop
roomsRouter.get('/:id/sync', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const roomId = req.params.id as string;
    const since = req.query.since ? new Date(req.query.since as string) : null;

    // Check membership on server
    const membership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!membership) {
      res.status(403).json({ error: 'Access denied: You are not a member of this room.' });
      return;
    }

    const messages = await prisma.message.findMany({
      where: {
        roomId,
        ...(since && !isNaN(since.getTime()) ? { createdAt: { gt: since } } : {}),
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

    res.json({
      messages: messages.map((m) => ({
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
      })),
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Failed to sync messages' });
  }
});
