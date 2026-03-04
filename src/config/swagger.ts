import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SocialMine API Documentation',
      version: '1.0.0',
      description: 'Complete API documentation for SocialMine - A social mining platform backend',
      contact: {
        name: 'SocialMine Team',
        email: 'support@socialmine.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Development server',
      },
      {
        url: 'https://your-production-url.com/api/v1',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token (obtained from login)',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            username: { type: 'string' },
            userType: { type: 'string', enum: ['MINER', 'PROJECT_OWNER', 'BOTH'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Post: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            content: { type: 'string' },
            visibility: { type: 'string', enum: ['PUBLIC', 'FOLLOWERS_ONLY', 'PRIVATE'] },
            likesCount: { type: 'integer' },
            commentsCount: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Comment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            postId: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            content: { type: 'string' },
            parentCommentId: { type: 'string', format: 'uuid', nullable: true },
            likesCount: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
    tags: [
      { name: 'Authentication', description: 'User authentication endpoints' },
      { name: 'Posts', description: 'Post management endpoints' },
      { name: 'Comments', description: 'Comment management endpoints' },
      { name: 'Profile', description: 'User profile endpoints' },
      { name: 'Notifications', description: 'Notification endpoints' },
      { name: 'Upload', description: 'File upload endpoints' },
    ],
  },
  apis: ['./src/routes/*.ts'], // Path to API routes
};

export const swaggerSpec = swaggerJsdoc(options);