import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    const hashedPassword = await bcrypt.hash('Admin123!', 10);
    
    const admin = await prisma.user.create({
      data: {
        email: 'admin@socialmine.com',
        username: 'admin',
        passwordHash: hashedPassword,
        userType: 'ADMIN',
        emailVerified: true,
      },
    });

    console.log('✅ Admin user created successfully!');
    console.log('Email:', admin.email);
    console.log('Password: Admin123!');
    console.log('User Type:', admin.userType);
    
  } catch (error) {
    console.error('❌ Error creating admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();