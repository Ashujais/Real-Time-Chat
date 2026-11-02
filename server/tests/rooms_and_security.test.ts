import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/db.js';

describe('Room Access & Server-Side Security Checks', () => {
  let userAToken: string;
  let userBToken: string;
  let userCToken: string;
  let userAId: string;
  let userBId: string;
  let userCId: string;

  beforeEach(async () => {
    await prisma.message.deleteMany();
    await prisma.roomMember.deleteMany();
    await prisma.room.deleteMany();
    await prisma.user.deleteMany();

    // Register User A
    const resA = await request(app).post('/api/auth/register').send({
      username: 'usera',
      email: 'usera@example.com',
      password: 'password123',
      displayName: 'User A',
    });
    userAToken = resA.body.token;
    userAId = resA.body.user.id;

    // Register User B
    const resB = await request(app).post('/api/auth/register').send({
      username: 'userb',
      email: 'userb@example.com',
      password: 'password123',
      displayName: 'User B',
    });
    userBToken = resB.body.token;
    userBId = resB.body.user.id;

    // Register User C
    const resC = await request(app).post('/api/auth/register').send({
      username: 'userc',
      email: 'userc@example.com',
      password: 'password123',
      displayName: 'User C',
    });
    userCToken = resC.body.token;
    userCId = resC.body.user.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('6. Creates a group room and assigns creator as ADMIN member', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        name: 'developers',
        description: 'For devs only',
        isPrivate: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.room.name).toBe('developers');
    expect(res.body.room.members).toHaveLength(1);
    expect(res.body.room.members[0].role).toBe('ADMIN');
  });

  it('7. CRITICAL: Strictly denies access (403 Forbidden) to messages for non-members', async () => {
    // User A creates a room
    const createRes = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ name: 'secret-room', isPrivate: true });

    const roomId = createRes.body.room.id;

    // Seed a message from User A
    await prisma.message.create({
      data: {
        roomId,
        senderId: userAId,
        content: 'Confidential message',
      },
    });

    // User A can access messages
    const accessResA = await request(app)
      .get(`/api/rooms/${roomId}/messages`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(accessResA.status).toBe(200);
    expect(accessResA.body.messages).toHaveLength(1);

    // User B is NOT a member -> Server MUST reject with 403 Forbidden
    const accessResB = await request(app)
      .get(`/api/rooms/${roomId}/messages`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(accessResB.status).toBe(403);
    expect(accessResB.body.error).toMatch(/access denied/i);

    // User C is NOT a member -> Server MUST reject room metadata with 403 Forbidden
    const roomMetaResC = await request(app)
      .get(`/api/rooms/${roomId}`)
      .set('Authorization', `Bearer ${userCToken}`);
    expect(roomMetaResC.status).toBe(403);
  });

  it('8. Allows user to join public room and grants message access after joining', async () => {
    // User A creates public room
    const roomRes = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ name: 'public-lounge', isPrivate: false });
    const roomId = roomRes.body.room.id;

    // User B joins the public room
    const joinRes = await request(app)
      .post(`/api/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(joinRes.status).toBe(200);

    // Now User B has authorized access to messages
    const messagesRes = await request(app)
      .get(`/api/rooms/${roomId}/messages`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(messagesRes.status).toBe(200);
  });

  it('9. Direct Messages: creates 1-on-1 room between 2 users and denies 3rd party eavesdropping', async () => {
    // User A starts DM with User B
    const dmRes = await request(app)
      .post('/api/rooms/direct')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ recipientId: userBId });

    expect([200, 201]).toContain(dmRes.status);
    const dmRoomId = dmRes.body.room.id;

    // Both User A and User B can access
    const resA = await request(app)
      .get(`/api/rooms/${dmRoomId}/messages`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(resA.status).toBe(200);

    const resB = await request(app)
      .get(`/api/rooms/${dmRoomId}/messages`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(resB.status).toBe(200);

    // Third party User C is NOT part of the DM and must receive 403
    const resC = await request(app)
      .get(`/api/rooms/${dmRoomId}/messages`)
      .set('Authorization', `Bearer ${userCToken}`);
    expect(resC.status).toBe(403);
  });
});
