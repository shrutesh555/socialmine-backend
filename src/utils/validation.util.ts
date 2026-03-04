import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

export const signupSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'any.required': 'Password is required',
  }),
  username: Joi.string().min(3).max(30).alphanum().required().messages({
    'string.min': 'Username must be at least 3 characters long',
    'string.max': 'Username cannot exceed 30 characters',
    'string.alphanum': 'Username can only contain letters and numbers',
    'any.required': 'Username is required',
  }),
  userType: Joi.string().valid('MINER', 'PROJECT_OWNER').default('MINER'),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: errors,
        },
      });
    }

    req.body = value;
    next();
  };
};

export const createPostSchema = Joi.object({
  content: Joi.string().min(1).max(5000).required().messages({
    'string.min': 'Post content cannot be empty',
    'string.max': 'Post content cannot exceed 5000 characters',
    'any.required': 'Post content is required',
  }),
  visibility: Joi.string().valid('PUBLIC', 'FOLLOWERS_ONLY', 'PRIVATE').default('PUBLIC'),
});

export const updatePostSchema = Joi.object({
  content: Joi.string().min(1).max(5000).messages({
    'string.min': 'Post content cannot be empty',
    'string.max': 'Post content cannot exceed 5000 characters',
  }),
  visibility: Joi.string().valid('PUBLIC', 'FOLLOWERS_ONLY', 'PRIVATE'),
}).min(1);

export const createCommentSchema = Joi.object({
  postId: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid post ID format',
    'any.required': 'Post ID is required',
  }),
  content: Joi.string().min(1).max(2000).required().messages({
    'string.min': 'Comment cannot be empty',
    'string.max': 'Comment cannot exceed 2000 characters',
    'any.required': 'Comment content is required',
  }),
  parentCommentId: Joi.string().uuid().optional().messages({
    'string.guid': 'Invalid parent comment ID format',
  }),
});

export const updateCommentSchema = Joi.object({
  content: Joi.string().min(1).max(2000).required().messages({
    'string.min': 'Comment cannot be empty',
    'string.max': 'Comment cannot exceed 2000 characters',
    'any.required': 'Comment content is required',
  }),
});

export const updateProfileSchema = Joi.object({
  displayName: Joi.string().min(1).max(100).optional().messages({
    'string.min': 'Display name cannot be empty',
    'string.max': 'Display name cannot exceed 100 characters',
  }),
  bio: Joi.string().max(500).optional().allow('').messages({
    'string.max': 'Bio cannot exceed 500 characters',
  }),
  avatarUrl: Joi.string().uri().optional().allow('').messages({
    'string.uri': 'Avatar URL must be a valid URL',
  }),
}).min(1);