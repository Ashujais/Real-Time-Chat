import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/db.js';

describe('Messages, Pagination, Editing, Deleting & Sync', () => {
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;
  let testRoomId: string;

  beforeEach(async () => {
    await prisma.message.deleteMany();
    await prisma.roomMember.deleteMany();
    await prisma.room.deleteMany();
    await prisma.user.deleteMany();

    const resA = await request(app).post('/api/auth/register').send({
      username: 'alice_msg',
      email: 'alice_msg@example.com',
      password: 'password123',
      displayName: 'Alice M',
    });
    userAToken = resA.body.token;
    userAId = resA.body.user.id;

    const resB = await request(app).post('/api/auth/register').send({
      username: 'bob_msg',
      email: 'bob_msg@example.com',
      password: 'password123',
      displayName: 'Bob M',
    });
    userBToken = resB.body.token;
    userBId = resB.body.user.id;

    // Create room with Alice and Bob
    const room = await prisma.room.create({
      data: {
        name: 'test-chat',
        type: 'GROUP',
        createdById: userAId,
        members: {
          create: [
            { userId: userAId, role: 'ADMIN' },
            { userId: userBId, role: 'MEMBER' },
          ],
        },
      },
    });
    testRoomId = room.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('10. Paginates message history using cursor and limit', async () => {
    // Create 15 messages with distinct timestamps
    for (let i = 1; i <= 15; i++) {
      await prisma.message.create({
        data: {
          roomId: testRoomId,
          senderId: userAId,
          content: `Message #${i}`,
          createdAt: new Date(Date.now() - (15 - i) * 10000),
        },
      });
    }

    // Request first page with limit 5 (most recent messages)
    const page1 = await request(app)
      .get(`/api/rooms/${testRoomId}/messages?limit=5`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(page1.status).toBe(200);
    expect(page1.body.messages).toHaveLength(5);
    expect(page1.body.hasMore).toBe(true);
    expect(page1.body.nextCursor).toBeDefined();

    // Request second page using cursor
    const page2 = await request(app)
      .get(`/api/rooms/${testRoomId}/messages?limit=5&cursor=${page1.body.nextCursor}`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(page2.status).toBe(200);
    expect(page2.body.messages).toHaveLength(5);
    // Oldest message on page 1 should be newer than newest message on page 2
    expect(new Date(page1.body.messages[0].createdAt).getTime()).toBeGreaterThan(
      new Date(page2.body.messages[0].createdAt).getTime()
    );
  });

  it('11. Accurately tracks unread counts and resets on mark_read', async () => {
    // Alice sends 3 messages
    await prisma.message.createMany({
      data: [
        { roomId: testRoomId, senderId: userAId, content: 'Hi Bob 1' },
        { roomId: testRoomId, senderId: userAId, content: 'Hi Bob 2' },
        { roomId: testRoomId, senderId: userAId, content: 'Hi Bob 3' },
      ],
    });

    // Check Bob's room list - Bob should see 3 unread messages
    const roomsResBefore = await request(app)
      .get('/api/rooms')
      .set('Authorization', `Bearer ${userBToken}`);

    expect(roomsResBefore.status).toBe(200);
    const roomForBob = roomsResBefore.body.rooms.find((r: any) => r.id === testRoomId);
    expect(roomForBob.unreadCount).toBe(3);

    // Bob marks the room as read
    const markReadRes = await request(app)
      .post(`/api/rooms/${testRoomId}/read`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(markReadRes.status).toBe(200);

    // Check Bob's room list again - unreadCount should be 0
    const roomsResAfter = await request(app)
      .get('/api/rooms')
      .set('Authorization', `Bearer ${userBToken}`);
    const roomAfter = roomsResAfter.body.rooms.find((r: any) => r.id === testRoomId);
    expect(roomAfter.unreadCount).toBe(0);
  });

  it('12. Allows author to edit their own message and forbids other users', async () => {
    const msg = await prisma.message.create({
      data: {
        roomId: testRoomId,
        senderId: userAId,
        content: 'Original content',
      },
    });

    // Alice edits her own message -> 200 OK
    const editResSuccess = await request(app)
      .put(`/api/messages/${msg.id}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ content: 'Updated content' });

    expect(editResSuccess.status).toBe(200);
    expect(editResSuccess.body.message.content).toBe('Updated content');
    expect(editResSuccess.body.message.isEdited).toBe(true);

    // Bob attempts to edit Alice's message -> 403 Forbidden
    const editResForbidden = await request(app)
      .put(`/api/messages/${msg.id}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ content: 'Hacked by Bob' });

    expect(editResForbidden.status).toBe(403);
    expect(editResForbidden.body.error).toMatch(/not allowed/i);
  });

  it('13. Allows author to delete their own message and forbids non-author non-admin users', async () => {
    const msg = await prisma.message.create({
      data: {
        roomId: testRoomId,
        senderId: userAId,
        content: 'To be deleted',
      },
    });

    // Bob (not author, not admin) attempts to delete Alice's message -> 403 Forbidden
    const delResForbidden = await request(app)
      .delete(`/api/messages/${msg.id}`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(delResForbidden.status).toBe(403);

    // Alice deletes her own message -> 200 OK
    const delResSuccess = await request(app)
      .delete(`/api/messages/${msg.id}`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(delResSuccess.status).toBe(200);
    expect(delResSuccess.body.success).toBe(true);

    // Deleted message content should be masked
    const checkMsg = await prisma.message.findUnique({ where: { id: msg.id } });
    expect(checkMsg?.isDeleted).toBe(true);
    expect(checkMsg?.content).toBe('This message was deleted');
  });

  it('14. Syncs missed messages after reconnection timestamp without message loss', async () => {
    const checkpoint = new Date(Date.now() - 5000);

    // Create 2 messages before checkpoint
    await prisma.message.create({
      data: {
        roomId: testRoomId,
        senderId: userAId,
        content: 'Before checkpoint',
        createdAt: new Date(checkpoint.getTime() - 10000),
      },
    });

    // Create 2 messages after checkpoint (during dropped connection)
    await prisma.message.create({
      data: {
        roomId: testRoomId,
        senderId: userAId,
        content: 'Missed message 1',
        createdAt: new Date(checkpoint.getTime() + 1000),
      },
    });
    await prisma.message.create({
      data: {
        roomId: testRoomId,
        senderId: userAId,
        content: 'Missed message 2',
        createdAt: new Date(checkpoint.getTime() + 2000),
      },
    });

    // Client reconnects and requests sync since checkpoint
    const syncRes = await request(app)
      .get(`/api/rooms/${testRoomId}/sync?since=${checkpoint.toISOString()}`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(syncRes.status).toBe(200);
    expect(syncRes.body.messages).toHaveLength(2);
    expect(syncRes.body.messages[0].content).toBe('Missed message 1');
    expect(syncRes.body.messages[1].content).toBe('Missed message 2');
  });
});
