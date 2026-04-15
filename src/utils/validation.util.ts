import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';

// ============================================
// VALIDATION MIDDLEWARE
// ============================================

export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: error.issues.map((err: any) => ({
              field: err.path.join('.'),
              message: err.message,
            })),
          },
        });
      }
      next(error);
    }
  };
};

// ============================================
// AUTH SCHEMAS
// ============================================

export const signupSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username must be at most 30 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    userType: z.enum(['MINER', 'PROJECT_OWNER', 'BOTH']).optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

// ============================================
// TOKEN SCHEMAS
// ============================================

export const tokenSubmitSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Token name must be at least 2 characters'),
    symbol: z.string().min(2, 'Symbol must be at least 2 characters').max(10, 'Symbol too long'),
    description: z.string().min(10, 'Description must be at least 10 characters'),
    contractAddress: z.string().optional(),
    blockchain: z.string().min(2, 'Blockchain is required'),
    logoUrl: z.string().url('Invalid logo URL').optional().or(z.literal('')),
    websiteUrl: z.string().url('Invalid website URL').optional().or(z.literal('')),
    twitterUrl: z.string().url('Invalid Twitter URL').optional().or(z.literal('')),
    discordUrl: z.string().url('Invalid Discord URL').optional().or(z.literal('')),
    telegramUrl: z.string().url('Invalid Telegram URL').optional().or(z.literal('')),
  }),
});

export const tokenUpdateSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    symbol: z.string().min(2).max(10).optional(),
    description: z.string().min(10).optional(),
    contractAddress: z.string().optional(),
    blockchain: z.string().optional(),
    logoUrl: z.string().url().optional().or(z.literal('')),
    websiteUrl: z.string().url().optional().or(z.literal('')),
    twitterUrl: z.string().url().optional().or(z.literal('')),
    discordUrl: z.string().url().optional().or(z.literal('')),
    telegramUrl: z.string().url().optional().or(z.literal('')),
  }),
});

// ============================================
// CAMPAIGN SCHEMAS
// ============================================

export const campaignCreateSchema = z.object({
  body: z.object({
    tokenId: z.string().uuid('Invalid token ID'),
    name: z.string().min(3, 'Campaign name must be at least 3 characters').max(100),
    description: z.string().min(10, 'Description must be at least 10 characters'),
    imageUrl: z.string().url('Invalid image URL').optional().or(z.literal('')),
    type: z.enum(['SPRINT', 'KARMA', 'CIRCLE', 'COMPETITION']),
    startDate: z.string().datetime('Invalid start date'),
    endDate: z.string().datetime('Invalid end date'),
    totalRewardPool: z.number().positive('Reward pool must be positive'),
    participantLimit: z.number().int().positive().optional(),
  }),
});

export const campaignUpdateSchema = z.object({
  body: z.object({
    name: z.string().min(3).max(100).optional(),
    description: z.string().min(10).optional(),
    imageUrl: z.string().url().optional().or(z.literal('')),
    type: z.enum(['SPRINT', 'KARMA', 'CIRCLE', 'COMPETITION']).optional(),
    status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    totalRewardPool: z.number().positive().optional(),
    participantLimit: z.number().int().positive().optional(),
  }),
});

// ============================================
// TASK SCHEMAS
// ============================================

export const taskCreateSchema = z.object({
  body: z.object({
    campaignId: z.string().uuid('Invalid campaign ID'),
    title: z.string().min(3, 'Title must be at least 3 characters').max(200),
    description: z.string().min(10, 'Description must be at least 10 characters'),
    type: z.enum([
      // ACTION Category
      'VISIT_LINK',
      'INVITES',
      'PARTNERSHIP',
      // SOCIAL Category
      'TWITTER_FOLLOW',
      'TWITTER_RETWEET',
      'TWITTER_LIKE',
      'TWITTER_POST',
      'DISCORD_JOIN',
      'TELEGRAM_JOIN',
      'TIKTOK',
      // ANSWER Category
      'UPLOAD',
      'POLL',
      'TEXT_ANSWER',
      'NUMBER_ANSWER',
      'URL_ANSWER',
      // ON-CHAIN Category
      'TOKEN_HOLD',
      'ONCHAIN_ACTION',
      // CUSTOM Category
      'QUIZ',
      'SURVEY',
      'CONTENT_CREATION',
      'CUSTOM',
      'REFERRAL',
    ]),
    verificationType: z.enum(['AUTO', 'MANUAL', 'HYBRID']),
    requirements: z.record(z.string(), z.any()).optional(),
    experiencePoints: z.number().int().min(0, 'Experience points must be non-negative'), // Changed from rewardXP
    reward: z.number().min(0, 'Reward must be non-negative'), // Changed from rewardTokens
    order: z.number().int().min(0).optional(),
    isRequired: z.boolean().optional(),
    estimatedTime: z.number().int().positive('Estimated time must be positive').optional(),
  }),
});

export const taskUpdateSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().min(10).optional(),
    type: z.enum([
      // ACTION Category
      'VISIT_LINK',
      'INVITES',
      'PARTNERSHIP',
      // SOCIAL Category
      'TWITTER_FOLLOW',
      'TWITTER_RETWEET',
      'TWITTER_LIKE',
      'TWITTER_POST',
      'DISCORD_JOIN',
      'TELEGRAM_JOIN',
      'TIKTOK',
      // ANSWER Category
      'UPLOAD',
      'POLL',
      'TEXT_ANSWER',
      'NUMBER_ANSWER',
      'URL_ANSWER',
      // ON-CHAIN Category
      'TOKEN_HOLD',
      'ONCHAIN_ACTION',
      // CUSTOM Category
      'QUIZ',
      'SURVEY',
      'CONTENT_CREATION',
      'CUSTOM',
      'REFERRAL',
    ]).optional(),
    verificationType: z.enum(['AUTO', 'MANUAL', 'HYBRID']).optional(),
    requirements: z.record(z.string(), z.any()).optional(),
    experiencePoints: z.number().int().min(0).optional(), // Changed from rewardXP
    reward: z.number().min(0).optional(), // Changed from rewardTokens
    order: z.number().int().min(0).optional(),
    isRequired: z.boolean().optional(),
    estimatedTime: z.number().int().positive().optional(),
  }),
});

export const taskReorderSchema = z.object({
  body: z.object({
    campaignId: z.string().uuid('Invalid campaign ID'),
    taskOrders: z.array(
      z.object({
        taskId: z.string().uuid('Invalid task ID'),
        order: z.number().int().min(0),
      })
    ).min(1, 'At least one task order is required'),
  }),
});

// ============================================
// SUBMISSION SCHEMAS
// ============================================

export const submissionCreateSchema = z.object({
  body: z.object({
    taskId: z.string().uuid('Invalid task ID'),
    proofUrl: z.string().url('Invalid proof URL').optional().or(z.literal('')),
    proofText: z.string().optional(),
    proofFiles: z.array(z.string().url()).optional(),
  }),
});

export const submissionUpdateSchema = z.object({
  body: z.object({
    proofUrl: z.string().url('Invalid proof URL').optional().or(z.literal('')),
    proofText: z.string().optional(),
    proofFiles: z.array(z.string().url()).optional(),
  }),
});

// ============================================
// REVIEW SCHEMAS
// ============================================

export const reviewCreateSchema = z.object({
  body: z.object({
    submissionId: z.string().uuid('Invalid submission ID'),
    approved: z.boolean(),
    rating: z.number().int().min(1).max(5).optional(),
    feedback: z.string().optional(),
  }),
});

export const bulkReviewSchema = z.object({
  body: z.object({
    reviews: z.array(
      z.object({
        submissionId: z.string().uuid('Invalid submission ID'),
        approved: z.boolean(),
        rating: z.number().int().min(1).max(5).optional(),
        feedback: z.string().optional(),
      })
    ).min(1, 'At least one review is required'),
  }),
});

// ============================================
// PAYMENT SCHEMAS
// ============================================

export const paymentCreateSchema = z.object({
  body: z.object({
    campaignId: z.string().uuid('Invalid campaign ID'),
    recipientId: z.string().uuid('Invalid recipient ID'),
    amount: z.number().positive('Amount must be positive'),
    tokenSymbol: z.string().optional(),
    blockchain: z.string().optional(),
    txHash: z.string().optional(),
  }),
});

export const paymentProcessSchema = z.object({
  body: z.object({
    status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']),
    txHash: z.string().optional(),
    failureReason: z.string().optional(),
  }),
});

// ============================================
// PROFILE SCHEMAS
// ============================================

export const updateProfileSchema = z.object({
  body: z.object({
    displayName: z.string().min(2).max(50).optional(),
    bio: z.string().max(500).optional(),
    avatarUrl: z.string().url().optional().or(z.literal('')),
  }),
});

// ============================================
// POST SCHEMAS (for social features)
// ============================================

export const createPostSchema = z.object({
  body: z.object({
    content: z.string().min(1, 'Post content is required').max(5000, 'Post is too long'),
    mediaUrls: z.array(z.string().url()).optional(),
    visibility: z.enum(['PUBLIC', 'FOLLOWERS_ONLY', 'PRIVATE']).optional(),
  }),
});

export const updatePostSchema = z.object({
  body: z.object({
    content: z.string().min(1).max(5000).optional(),
    visibility: z.enum(['PUBLIC', 'FOLLOWERS_ONLY', 'PRIVATE']).optional(),
  }),
});

// ============================================
// COMMENT SCHEMAS (for social features)
// ============================================

export const createCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1, 'Comment content is required').max(2000, 'Comment is too long'),
    parentCommentId: z.string().uuid().optional(),
  }),
});

export const updateCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1, 'Comment content is required').max(2000, 'Comment is too long'),
  }),
});