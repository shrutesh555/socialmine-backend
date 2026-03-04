// tests/setup.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Clean up database before tests
beforeAll(async () => {
  console.log('Setting up tests...');
});

// Clean up after all tests
afterAll(async () => {
  await prisma.$disconnect();
  console.log('Tests completed. Cleaned up.');
});

export { prisma };