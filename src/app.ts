import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Import routes - ONLY ONCE
import authRoutes from './routes/auth.routes';
import postRoutes from './routes/post.routes';
import commentRoutes from './routes/comment.routes';
import profileRoutes from './routes/profile.routes';
import notificationRoutes from './routes/notification.routes';
import uploadRoutes from './routes/upload.routes';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import tokenRoutes from './routes/token.routes';
import campaignRoutes from './routes/campaign.routes';

// DEBUG: Wrap task routes import in try-catch
console.log('🔍 Attempting to import task routes...');
let taskRoutes: any;
try {
  taskRoutes = require('./routes/task.routes').default;
  console.log('✅ Task routes imported successfully:', !!taskRoutes);
  console.log('✅ Task routes type:', typeof taskRoutes);
  console.log('✅ Task routes stack:', taskRoutes?.stack?.length || 0);
} catch (error) {
  console.error('❌ TASK ROUTES IMPORT FAILED:', error);
  taskRoutes = null;
}

import submissionRoutes from './routes/submission.routes';
import reviewRoutes from './routes/review.routes';
import paymentRoutes from './routes/payment.routes';
import leaderboardRoutes from './routes/leaderboard.routes';
import analyticsRoutes from './routes/analytics.routes';
import settingsRoutes from './routes/settings.routes';
import messageRoutes from './routes/message.routes';
import referralRoutes from './routes/referral.routes';

dotenv.config();

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration - Allow frontend on port 3001
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Compression
app.use(compression());

// Logging
app.use(morgan('dev'));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
});

app.use('/api', limiter);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'SocialMine API Docs',
}));

// API routes
const apiVersion = process.env.API_VERSION || 'v1';
app.use(`/api/${apiVersion}/auth`, authRoutes);
app.use(`/api/${apiVersion}/posts`, postRoutes);
app.use(`/api/${apiVersion}/comments`, commentRoutes);
app.use(`/api/${apiVersion}/profile`, profileRoutes);
app.use(`/api/${apiVersion}/notifications`, notificationRoutes);
app.use(`/api/${apiVersion}/upload`, uploadRoutes);
app.use(`/api/${apiVersion}/tokens`, tokenRoutes);
app.use(`/api/${apiVersion}/campaigns`, campaignRoutes);

// Register task routes with error handling
console.log('🔍 Registering task routes at:', `/api/${apiVersion}/tasks`);
if (taskRoutes) {
  app.use(`/api/${apiVersion}/tasks`, taskRoutes);
  console.log('✅ Task routes registered successfully');
} else {
  console.error('❌ Task routes is null/undefined - NOT REGISTERED');
}

app.use(`/api/${apiVersion}/submissions`, submissionRoutes);
app.use(`/api/${apiVersion}/reviews`, reviewRoutes);
app.use(`/api/${apiVersion}/payments`, paymentRoutes);
app.use(`/api/${apiVersion}/leaderboard`, leaderboardRoutes);
app.use(`/api/${apiVersion}/analytics`, analyticsRoutes);
app.use(`/api/${apiVersion}/settings`, settingsRoutes);
app.use(`/api/${apiVersion}/messages`, messageRoutes);
app.use(`/api/${apiVersion}/referrals`, referralRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
    },
  });
});

export default app;