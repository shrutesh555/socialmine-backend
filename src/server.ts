import express from 'express';
import dotenv from 'dotenv';
import { configureSecurityMiddleware } from './middleware/security.config';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { apiLimiter, authLimiter, submissionLimiter, referralLimiter, campaignLimiter } from './middleware/rate-limiter.middleware';

// Import ALL routes
import authRoutes from './routes/auth.routes';
import campaignRoutes from './routes/campaign.routes';
import submissionRoutes from './routes/submission.routes';
import referralRoutes from './routes/referral.routes';
import tokenRoutes from './routes/token.routes';
import taskRoutes from './routes/task.routes';
import uploadRoutes from './routes/upload.routes';
import profileRoutes from './routes/profile.routes';
import reviewRoutes from './routes/review.routes';
import paymentRoutes from './routes/payment.routes';
import leaderboardRoutes from './routes/leaderboard.routes';
import analyticsRoutes from './routes/analytics.routes';
import settingsRoutes from './routes/settings.routes';
import messageRoutes from './routes/message.routes';
import postRoutes from './routes/post.routes';
import commentRoutes from './routes/comment.routes';
import notificationRoutes from './routes/notification.routes';
import roleRoutes from './routes/role.routes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================

// 1. Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 2. Security middleware (helmet + CORS)
configureSecurityMiddleware(app);

// 3. Request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ============================================
// RATE LIMITING
// ============================================
app.use('/api/', apiLimiter);

// ============================================
// API ROUTES
// ============================================

// Auth routes with stricter rate limiting
app.use('/api/v1/auth', authLimiter, authRoutes);

// Core platform routes
app.use('/api/v1/tokens', tokenRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/leaderboard', leaderboardRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/roles', roleRoutes);

// Social features
app.use('/api/v1/posts', postRoutes);
app.use('/api/v1/comments', commentRoutes);

// Campaign routes with campaign creation limiter
app.use('/api/v1/campaigns', (req, res, next) => {
  if (req.method === 'POST' && !req.path.includes('/join')) {
    return campaignLimiter(req, res, next);
  }
  next();
}, campaignRoutes);

// Submission routes with submission limiter
app.use('/api/v1/submissions', submissionLimiter, submissionRoutes);

// Referral routes with referral limiter
app.use('/api/v1/referrals', (req, res, next) => {
  if (req.method === 'POST' && req.path.includes('/generate')) {
    return referralLimiter(req, res, next);
  }
  next();
}, referralRoutes);

// ============================================
// ERROR HANDLING
// ============================================
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log('🚀 ========================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🚀 API URL: http://localhost:${PORT}/api/v1`);
  console.log('🚀 ========================================');
  console.log('✅ All routes registered');
  console.log('✅ Security middleware enabled');
  console.log('✅ Rate limiting enabled');
  console.log('🚀 ========================================');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.error('❌ UNHANDLED REJECTION:', err.name, err.message);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err.name, err.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

export default app;