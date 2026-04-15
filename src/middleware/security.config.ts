import helmet from 'helmet';
import cors from 'cors';
import { Express } from 'express';

export const configureSecurityMiddleware = (app: Express) => {
  // Helmet - Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // Disable for development
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // CORS Configuration
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3001',
    'http://localhost:3001',
    'http://localhost:3000',
  ];

  // Add production URLs if they exist
  if (process.env.PRODUCTION_FRONTEND_URL) {
    allowedOrigins.push(process.env.PRODUCTION_FRONTEND_URL);
  }

  app.use(
    cors({
      origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) === -1) {
          const msg = `The CORS policy for this site does not allow access from the specified origin: ${origin}`;
          return callback(new Error(msg), false);
        }
        return callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
      ],
      exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
      maxAge: 86400, // 24 hours
    })
  );

  // Additional security headers
  app.use((req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions policy
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=()'
    );

    next();
  });

  console.log('✅ Security middleware configured');
  console.log('📝 Allowed origins:', allowedOrigins);
};
