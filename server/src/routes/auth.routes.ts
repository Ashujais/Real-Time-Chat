import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { authenticateToken, AuthUser } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

export const authRouter = Router();

const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters long')
    .max(20, 'Username must be at most 20 characters long')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email('Please provide a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  displayName: z
    .string()
    .min(1, 'Display name cannot be empty')
    .max(50, 'Display name must be at most 50 characters'),
  avatarUrl: z.string().optional(),
});

const loginSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

function generateToken(user: { id: string; username: string; email: string; displayName: string }) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
    },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
authRouter.post('/register', validateBody(registerSchema), async (req: Request, res: Response) => {
  try {
    const { username, email, password, displayName, avatarUrl } = req.body;

    // Check existing username
    const existingUsername = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });
    if (existingUsername) {
      res.status(409).json({ error: 'Username is already taken' });
      return;
    }

    // Check existing email
    const existingEmail = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existingEmail) {
      res.status(409).json({ error: 'Email address is already in use' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        displayName: displayName.trim(),
        passwordHash,
        avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`,
      },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    const token = generateToken(user);
    res.status(201).json({
      message: 'Account created successfully',
      token,
      user,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// POST /api/auth/login
authRouter.post('/login', validateBody(loginSchema), async (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body;
    const lowerIdentifier = identifier.toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: lowerIdentifier }, { email: lowerIdentifier }],
      },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid username/email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid username/email or password' });
      return;
    }

    const safeUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };

    const token = generateToken(safeUser);
    res.status(200).json({
      message: 'Logged in successfully',
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// GET /api/auth/me
authRouter.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Me endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users (search/list users to start DM or view profiles)
authRouter.get('/users', authenticateToken, async (req: Request, res: Response) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const currentUserId = req.user!.id;

    const users = await prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        ...(search
          ? {
              OR: [
                { username: { contains: search } },
                { displayName: { contains: search } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
      },
      take: 50,
      orderBy: { username: 'asc' },
    });

    res.json({ users });
  } catch (error) {
    console.error('Users search error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});
