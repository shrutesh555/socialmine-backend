import { Request, Response, NextFunction } from 'express';

// Custom error class
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error handler middleware
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new AppError(message, 404, 'RESOURCE_NOT_FOUND');
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new AppError(message, 400, 'DUPLICATE_ENTRY');
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((val: any) => val.message)
      .join(', ');
    error = new AppError(message, 400, 'VALIDATION_ERROR');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = new AppError(message, 401, 'INVALID_TOKEN');
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = new AppError(message, 401, 'TOKEN_EXPIRED');
  }

  // Prisma errors
  if (err.code === 'P2002') {
    const message = 'A record with this unique field already exists';
    error = new AppError(message, 400, 'UNIQUE_CONSTRAINT_VIOLATION');
  }

  if (err.code === 'P2025') {
    const message = 'Record not found';
    error = new AppError(message, 404, 'RECORD_NOT_FOUND');
  }

  // Send response
  const statusCode = error.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Something went wrong'
      : error.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message,
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
      }),
    },
  });
};

// Async handler wrapper to catch errors in async route handlers
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};
