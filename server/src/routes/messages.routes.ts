import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { emitToRoom } from '../sockets/socketService.js';

export const messagesRouter = Router();

const editMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(4000, 'Message cannot exceed 4000 characters'),
});

// PUT /api/messages/:id - Edit own message
messagesRouter.put('/:id', authenticateToken, validateBody(editMessageSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const messageId = req.params.id as string;
    const { content } = req.body;

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });

    if (!message) {
      res.status(404).json({ error: 'Message not found.' });
      return;
    }

    if (message.isDeleted) {
      res.status(400).json({ error: 'Cannot edit a deleted message.' });
      return;
    }

    // Only the author can edit their message!
    if (message.senderId !== userId) {
      res.status(403).json({ error: 'You are not allowed to edit this message.' });
      return;
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: content.trim(),
        isEdited: true,
      },
      include: {
        sender: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });

    const responsePayload = {
      id: updated.id,
      roomId: updated.roomId,
      senderId: updated.senderId,
      content: updated.content,
      imageUrl: updated.imageUrl,
      isEdited: updated.isEdited,
      isDeleted: updated.isDeleted,
      clientTempId: updated.clientTempId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      sender: updated.sender,
    };

    emitToRoom(updated.roomId, 'message_edited', responsePayload);

    res.json({ message: responsePayload });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// DELETE /api/messages/:id - Delete own message
messagesRouter.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const messageId = req.params.id as string;

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      res.status(404).json({ error: 'Message not found.' });
      return;
    }

    // Check if user is author or room admin
    const membership = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: { roomId: message.roomId, userId },
      },
    });

    const isAuthor = message.senderId === userId;
    const isAdmin = membership?.role === 'ADMIN';

    if (!isAuthor && !isAdmin) {
      res.status(403).json({ error: 'You are not allowed to delete this message.' });
      return;
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: 'This message was deleted',
        imageUrl: null,
        isDeleted: true,
      },
    });

    emitToRoom(updated.roomId, 'message_deleted', {
      id: updated.id,
      roomId: updated.roomId,
    });

    res.json({ success: true, messageId: updated.id });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});
