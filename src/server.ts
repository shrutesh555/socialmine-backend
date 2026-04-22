import express from 'express';
import dotenv from 'dotenv';
import { configureSecurityMiddleware } from './middleware/security.config';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { apiLimiter, authLimiter, submissionLimiter, referralLimiter, campaignLimiter } from './middleware/rate-limiter.middleware';

// Import routes
import authRoutes from './routes/auth.routes';
import campaignRoutes from './routes/campaign.routes';
import submissionRoutes from './routes/submission.routes';
import referralRoutes from './routes/referral.routes';
import tokenRoutes from './routes/token.routes';

// DEBUG: Task routes import with error handling
console.log('🔍 Attempting to import task routes...');
let taskRoutes: any;
try {
  taskRoutes = require('./routes/task.routes').default;
  console.log('✅ Task routes imported successfully');
  console.log('✅ Task routes type:', typeof taskRoutes);
  console.log('✅ Task routes constructor:', taskRoutes?.constructor?.name);
  console.log('✅ Task routes has stack:', !!taskRoutes?.stack);
  console.log('✅ Task routes stack length:', taskRoutes?.stack?.length || 0);
  
  // Show what routes are actually in the router
  if (taskRoutes?.stack && taskRoutes.stack.length > 0) {
    console.log('✅ Routes found in task router:');
    taskRoutes.stack.forEach((layer: any, index: number) => {
      const route = layer.route;
      if (route) {
        const methods = Object.keys(route.methods || {}).join(', ').toUpperCase();
        console.log(`   ${index + 1}. ${methods} ${route.path}`);
      }
    });
  } else {
    console.warn('⚠️  Task router stack is EMPTY!');
  }
} catch (error) {
  console.error('❌ TASK ROUTES IMPORT FAILED:');
  console.error(error);
  taskRoutes = null;
}

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE - ORDER IS IMPORTANT!
// ============================================

// 1. Body parsing middleware (before any routes)
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
// HEALTH CHECK (No rate limiting)
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
// RATE LIMITING - Apply before routes
// ============================================

// General API rate limiter for all routes
app.use('/api/', apiLimiter);

// ============================================
// API ROUTES with specific rate limiters
// ============================================

// Auth routes with stricter rate limiting
app.use('/api/v1/auth', authLimiter, authRoutes);

// Token routes (medium rate limit)
app.use('/api/v1/tokens', tokenRoutes);

// Task routes with detailed debugging
console.log('🔍 Attempting to register task routes...');
if (taskRoutes) {
  console.log('🔍 Registering at path: /api/v1/tasks');
  console.log('🔍 Router object:', {
    type: typeof taskRoutes,
    hasStack: !!taskRoutes.stack,
    stackLength: taskRoutes.stack?.length || 0
  });
  
  app.use('/api/v1/tasks', taskRoutes);
  console.log('✅ Task routes registered successfully');
  
  // Verify by checking app stack
  const appRouter = (app as any)._router;
  if (appRouter) {
    const taskLayer = appRouter.stack.find((layer: any) => 
      layer.regexp && layer.regexp.toString().includes('tasks')
    );
    console.log('✅ Verification: Task route found in app stack:', !!taskLayer);
  }
} else {
  console.error('❌ Task routes is NULL - cannot register!');
}

// Campaign routes with campaign creation limiter for POST
app.use('/api/v1/campaigns', (req, res, next) => {
  if (req.method === 'POST' && !req.path.includes('/join')) {
    return campaignLimiter(req, res, next);
  }
  next();
}, campaignRoutes);

// Submission routes with submission limiter
app.use('/api/v1/submissions', submissionLimiter, submissionRoutes);

// Referral routes with referral limiter for POST
app.use('/api/v1/referrals', (req, res, next) => {
  if (req.method === 'POST' && req.path.includes('/generate')) {
    return referralLimiter(req, res, next);
  }
  next();
}, referralRoutes);

// ============================================
// ERROR HANDLING - Must be last!
// ============================================

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log('🚀 ========================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🚀 API URL: http://localhost:${PORT}/api/v1`);
  console.log(`🚀 Health: http://localhost:${PORT}/health`);
  console.log('🚀 ========================================');
  console.log('✅ Security middleware enabled');
  console.log('✅ Rate limiting enabled');
  console.log('✅ Error handling configured');
  console.log('🚀 ========================================');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.error('❌ UNHANDLED REJECTION! Shutting down...');
  console.error(err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.error('❌ UNCAUGHT EXCEPTION! Shutting down...');
  console.error(err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

export default app;