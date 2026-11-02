import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/db.js';

describe('Auth API Endpoints', () => {
  beforeEach(async () => {
    // Clean test users
    await prisma.message.deleteMany();
    await prisma.roomMember.deleteMany();
    await prisma.room.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. Successfully registers a new user with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Test User',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({
      username: 'testuser',
      email: 'test@example.com',
      displayName: 'Test User',
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('2. Rejects registration with invalid email or short password (server validation)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'bad',
        email: 'not-an-email',
        password: '123',
        displayName: '',
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('details');
  });

  it('3. Rejects registration with duplicate username or email', async () => {
    // First registration
    await request(app).post('/api/auth/register').send({
      username: 'existing',
      email: 'existing@example.com',
      password: 'password123',
      displayName: 'Existing User',
    });

    // Duplicate username
    const resDupUser = await request(app).post('/api/auth/register').send({
      username: 'existing',
      email: 'different@example.com',
      password: 'password123',
      displayName: 'Different User',
    });
    expect(resDupUser.status).toBe(409);
    expect(resDupUser.body.error).toMatch(/username is already taken/i);

    // Duplicate email
    const resDupEmail = await request(app).post('/api/auth/register').send({
      username: 'unique_user',
      email: 'existing@example.com',
      password: 'password123',
      displayName: 'Unique User',
    });
    expect(resDupEmail.status).toBe(409);
    expect(resDupEmail.body.error).toMatch(/email address is already in use/i);
  });

  it('4. Successfully logs in with valid credentials and rejects invalid passwords', async () => {
    await request(app).post('/api/auth/register').send({
      username: 'loginuser',
      email: 'login@example.com',
      password: 'correct_password',
      displayName: 'Login User',
    });

    // Valid login
    const resSuccess = await request(app).post('/api/auth/login').send({
      identifier: 'loginuser',
      password: 'correct_password',
    });
    expect(resSuccess.status).toBe(200);
    expect(resSuccess.body).toHaveProperty('token');
    expect(resSuccess.body.user.username).toBe('loginuser');

    // Invalid password
    const resFail = await request(app).post('/api/auth/login').send({
      identifier: 'loginuser',
      password: 'wrong_password',
    });
    expect(resFail.status).toBe(401);
    expect(resFail.body.error).toMatch(/invalid/i);
  });

  it('5. Protects /api/auth/me against missing or invalid JWT tokens', async () => {
    // Missing token
    const resMissing = await request(app).get('/api/auth/me');
    expect(resMissing.status).toBe(401);

    // Invalid token
    const resInvalid = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token-string');
    expect(resInvalid.status).toBe(403);
  });
});
