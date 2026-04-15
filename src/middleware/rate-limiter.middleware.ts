import rateLimit from 'express-rate-limit';

// General API rate limiter - 100 requests per 15 minutes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
    },
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/health',
});

// Stricter limiter for authentication endpoints - 5 requests per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login/signup requests per windowMs
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again after 15 minutes.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Only apply to specific auth routes
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Medium limiter for submission endpoints - 30 requests per 15 minutes
export const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 submissions per windowMs
  message: {
    success: false,
    error: {
      code: 'SUBMISSION_RATE_LIMIT_EXCEEDED',
      message: 'Too many submissions, please slow down.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Referral code generation limiter - 10 requests per hour
export const referralLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 referral code generations per hour
  message: {
    success: false,
    error: {
      code: 'REFERRAL_RATE_LIMIT_EXCEEDED',
      message: 'Too many referral code requests, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Campaign creation limiter - 5 campaigns per hour
export const campaignLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 campaign creations per hour
  message: {
    success: false,
    error: {
      code: 'CAMPAIGN_CREATION_RATE_LIMIT_EXCEEDED',
      message: 'Too many campaign creations, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
