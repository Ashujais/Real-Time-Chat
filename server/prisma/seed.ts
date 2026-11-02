import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.message.deleteMany();
  await prisma.roomMember.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create Demo Users
  const alice = await prisma.user.create({
    data: {
      username: 'alice',
      email: 'alice@example.com',
      displayName: 'Alice Walker',
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    },
  });

  const bob = await prisma.user.create({
    data: {
      username: 'bob',
      email: 'bob@example.com',
      displayName: 'Bob Vance',
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    },
  });

  const charlie = await prisma.user.create({
    data: {
      username: 'charlie',
      email: 'charlie@example.com',
      displayName: 'Charlie Brown',
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    },
  });

  const diana = await prisma.user.create({
    data: {
      username: 'diana',
      email: 'diana@example.com',
      displayName: 'Diana Prince',
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    },
  });

  console.log('✅ Users created: alice, bob, charlie, diana (password: password123)');

  // 2. Create Group Rooms
  const generalRoom = await prisma.room.create({
    data: {
      name: 'general',
      description: 'Company-wide announcements and general discussion',
      type: 'GROUP',
      isPrivate: false,
      createdById: alice.id,
      members: {
        create: [
          { userId: alice.id, role: 'ADMIN', lastReadAt: new Date() },
          { userId: bob.id, role: 'MEMBER', lastReadAt: new Date(Date.now() - 3600000) },
          { userId: charlie.id, role: 'MEMBER', lastReadAt: new Date() },
          { userId: diana.id, role: 'MEMBER', lastReadAt: new Date() },
        ],
      },
    },
  });

  const engineeringRoom = await prisma.room.create({
    data: {
      name: 'engineering',
      description: 'System architecture, code reviews, and tech discussions',
      type: 'GROUP',
      isPrivate: false,
      createdById: alice.id,
      members: {
        create: [
          { userId: alice.id, role: 'ADMIN', lastReadAt: new Date() },
          { userId: bob.id, role: 'MEMBER', lastReadAt: new Date(Date.now() - 1800000) },
          { userId: diana.id, role: 'MEMBER', lastReadAt: new Date() },
        ],
      },
    },
  });

  const randomRoom = await prisma.room.create({
    data: {
      name: 'random',
      description: 'Watercooler chat, pets, hobby projects, and banter',
      type: 'GROUP',
      isPrivate: false,
      createdById: charlie.id,
      members: {
        create: [
          { userId: charlie.id, role: 'ADMIN', lastReadAt: new Date() },
          { userId: alice.id, role: 'MEMBER', lastReadAt: new Date() },
          { userId: bob.id, role: 'MEMBER', lastReadAt: new Date() },
        ],
      },
    },
  });

  // 3. Create Direct Message Room between Alice and Bob
  const aliceBobDm = await prisma.room.create({
    data: {
      type: 'DIRECT',
      isPrivate: true,
      createdById: alice.id,
      members: {
        create: [
          { userId: alice.id, role: 'MEMBER', lastReadAt: new Date() },
          { userId: bob.id, role: 'MEMBER', lastReadAt: new Date(Date.now() - 600000) }, // 10 min ago so Alice's recent msg is unread!
        ],
      },
    },
  });

  console.log('✅ Rooms created: #general, #engineering, #random, DM(Alice <-> Bob)');

  // 4. Seed Messages in #general
  const now = Date.now();
  await prisma.message.createMany({
    data: [
      {
        roomId: generalRoom.id,
        senderId: alice.id,
        content: 'Welcome to the new real-time chat application! 🎉',
        createdAt: new Date(now - 7200000),
      },
      {
        roomId: generalRoom.id,
        senderId: bob.id,
        content: 'Looks fantastic! Does it support real-time typing indicators and online presence?',
        createdAt: new Date(now - 7100000),
      },
      {
        roomId: generalRoom.id,
        senderId: alice.id,
        content: 'Yes! Fully backed by WebSockets with automatic reconnection synchronization and server-side membership checks.',
        createdAt: new Date(now - 7000000),
      },
      {
        roomId: generalRoom.id,
        senderId: charlie.id,
        content: 'I love how clean the UI feels. Scrolling up loads older messages smoothly too.',
        createdAt: new Date(now - 6900000),
      },
      {
        roomId: generalRoom.id,
        senderId: diana.id,
        content: 'And server validation on every route ensures unauthorized users cannot snoop on rooms they do not belong to.',
        createdAt: new Date(now - 6800000),
      },
      {
        roomId: generalRoom.id,
        senderId: alice.id,
        content: 'Check out the image sharing feature as well!',
        imageUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80',
        createdAt: new Date(now - 600000),
      },
    ],
  });

  // Seed Messages in #engineering
  await prisma.message.createMany({
    data: [
      {
        roomId: engineeringRoom.id,
        senderId: alice.id,
        content: 'We set up SQLite + Prisma with WAL mode for zero-friction local execution.',
        createdAt: new Date(now - 5000000),
      },
      {
        roomId: engineeringRoom.id,
        senderId: diana.id,
        content: 'The reconnect handler syncs any missed messages with cursor timestamps without duplicate delivery.',
        createdAt: new Date(now - 4800000),
      },
      {
        roomId: engineeringRoom.id,
        senderId: bob.id,
        content: 'Tested the message edit and delete actions as well — works like a charm.',
        isEdited: true,
        createdAt: new Date(now - 4500000),
      },
    ],
  });

  // Seed Messages in DM (Alice -> Bob)
  await prisma.message.createMany({
    data: [
      {
        roomId: aliceBobDm.id,
        senderId: bob.id,
        content: 'Hey Alice, do you have a moment to review the real-time chat architecture?',
        createdAt: new Date(now - 1200000),
      },
      {
        roomId: aliceBobDm.id,
        senderId: alice.id,
        content: 'Hey Bob! Absolutely, all automated tests are passing and the WebSocket server is running.',
        createdAt: new Date(now - 900000),
      },
      {
        roomId: aliceBobDm.id,
        senderId: alice.id,
        content: 'I left an unread message here so you can test the badge counter when you log in!',
        createdAt: new Date(now - 300000), // Newer than Bob's lastReadAt
      },
    ],
  });

  console.log('✅ Sample messages seeded across channels and direct messages');
  console.log('🚀 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
