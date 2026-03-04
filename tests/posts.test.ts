// tests/posts.test.ts
import request from 'supertest';
import app from '../src/app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Posts API', () => {
  let authToken: string;
  let userId: string;
  let postId: string;

  // Create a test user and login before tests
  beforeAll(async () => {
    // Clean up existing test user
    await prisma.user.deleteMany({
      where: { email: 'posttest@example.com' },
    });

    // Create test user
    await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: 'posttest@example.com',
        username: 'posttest',
        password: 'testpassword123',
      });

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'posttest@example.com',
        password: 'testpassword123',
      });

    authToken = loginResponse.body.data.accessToken;
    userId = loginResponse.body.data.user.id;
  });

  afterAll(async () => {
    // Clean up
    await prisma.user.deleteMany({
      where: { email: 'posttest@example.com' },
    });
    await prisma.$disconnect();
  });

  describe('POST /api/v1/posts', () => {
    it('should create a new post', async () => {
      const response = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'This is a test post',
          visibility: 'PUBLIC',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.content).toBe('This is a test post');
      
      postId = response.body.data.id; // Save for later tests
    });

    it('should reject post without authentication', async () => {
      await request(app)
        .post('/api/v1/posts')
        .send({
          content: 'This should fail',
          visibility: 'PUBLIC',
        })
        .expect(401);
    });

    it('should reject post without content', async () => {
      await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          visibility: 'PUBLIC',
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/posts', () => {
    it('should get all posts', async () => {
      const response = await request(app)
        .get('/api/v1/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('posts');
      expect(Array.isArray(response.body.data.posts)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/posts?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(5);
    });
  });

  describe('POST /api/v1/posts/:id/like', () => {
    it('should like a post', async () => {
      const response = await request(app)
        .post(`/api/v1/posts/${postId}/like`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject duplicate like', async () => {
      await request(app)
        .post(`/api/v1/posts/${postId}/like`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('DELETE /api/v1/posts/:id', () => {
    it('should delete own post', async () => {
      const response = await request(app)
        .delete(`/api/v1/posts/${postId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});