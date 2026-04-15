import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SocialMine API Documentation',
      version: '1.0.0',
      description: 'Complete API documentation for SocialMine - A crypto marketing platform connecting token owners with miners for promotional campaigns',
      contact: {
        name: 'SocialMine Team',
        email: 'support@socialmine.io',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://socialmine-backend-production.up.railway.app',
        description: 'Production server',
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints',
      },
      {
        name: 'Tokens',
        description: 'Token submission and management',
      },
      {
        name: 'Campaigns',
        description: 'Campaign creation and management',
      },
      {
        name: 'Tasks',
        description: 'Campaign task management',
      },
      {
        name: 'Submissions',
        description: 'Task submission and proof management',
      },
      {
        name: 'Reviews',
        description: 'Submission review and approval',
      },
      {
        name: 'Payments',
        description: 'Token distribution and payment tracking',
      },
      {
        name: 'Leaderboard',
        description: 'Rankings and leaderboards',
      },
      {
        name: 'Analytics',
        description: 'Statistics and analytics',
      },
      {
        name: 'Profile',
        description: 'User profile management',
      },
      {
        name: 'Notifications',
        description: 'Notification management',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token in the format: Bearer <token>',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'NOT_FOUND',
                },
                message: {
                  type: 'string',
                  example: 'Resource not found',
                },
              },
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            email: {
              type: 'string',
              format: 'email',
            },
            username: {
              type: 'string',
            },
            userType: {
              type: 'string',
              enum: ['PROJECT_OWNER', 'MINER'],
            },
            emailVerified: {
              type: 'boolean',
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'SUSPENDED', 'BANNED'],
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Token: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
            },
            symbol: {
              type: 'string',
            },
            blockchain: {
              type: 'string',
            },
            contractAddress: {
              type: 'string',
            },
            logoUrl: {
              type: 'string',
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'APPROVED', 'REJECTED'],
            },
          },
        },
        Campaign: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
            },
            description: {
              type: 'string',
            },
            type: {
              type: 'string',
              enum: ['SOCIAL_MEDIA', 'CONTENT_CREATION', 'COMMUNITY_BUILDING', 'TRADING', 'CUSTOM'],
            },
            status: {
              type: 'string',
              enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'],
            },
            startDate: {
              type: 'string',
              format: 'date-time',
            },
            endDate: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Task: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            title: {
              type: 'string',
            },
            description: {
              type: 'string',
            },
            type: {
              type: 'string',
              enum: ['TWITTER_FOLLOW', 'TWITTER_RETWEET', 'TWITTER_LIKE', 'TELEGRAM_JOIN', 'DISCORD_JOIN', 'CONTENT_CREATION', 'CUSTOM'],
            },
            rewardXP: {
              type: 'integer',
            },
            rewardTokens: {
              type: 'number',
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            total: {
              type: 'integer',
            },
            page: {
              type: 'integer',
            },
            limit: {
              type: 'integer',
            },
            totalPages: {
              type: 'integer',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts'], // Path to API routes
};

export const swaggerSpec = swaggerJsdoc(options);