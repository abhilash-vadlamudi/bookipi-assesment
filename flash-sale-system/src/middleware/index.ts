import express, { Request, Response, NextFunction } from 'express';
import { RateLimitRequestHandler } from 'express-rate-limit';
import { body, validationResult, ValidationChain } from 'express-validator';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';
import { ParamsDictionary } from 'express-serve-static-core';

import logger from '../utils/logger';
import { SecurityUtils } from '../utils/security';
import config from '../config';
import { ApiErrorResponse } from '../types';

// Rate limiting middleware for different endpoints
export const apiRateLimit: RateLimitRequestHandler = rateLimit({
  windowMs: config.rateLimits.api.windowMs,
  max: config.rateLimits.api.max,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again later.',
    statusCode: 429
  } as ApiErrorResponse,
  standardHeaders: config.rateLimits.api.standardHeaders || true,
  legacyHeaders: config.rateLimits.api.legacyHeaders || false,
  handler: (req: Request, res: Response) => {
    logger.security('Rate limit exceeded', {
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      path: req.path,
      method: req.method
    });

    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP. Please try again later.',
      statusCode: 429,
      timestamp: new Date().toISOString()
    } as ApiErrorResponse);
  }
});

export const purchaseRateLimit: RateLimitRequestHandler = rateLimit({
  windowMs: config.rateLimits.purchase.windowMs,
  max: config.rateLimits.purchase.max,
  message: {
    success: false,
    message: 'Too many purchase attempts. Please slow down.',
    statusCode: 429
  } as ApiErrorResponse,
  standardHeaders: config.rateLimits.purchase.standardHeaders || true,
  legacyHeaders: config.rateLimits.purchase.legacyHeaders || false,
  handler: (req: Request, res: Response) => {
    logger.security('Purchase rate limit exceeded', {
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      userId: req.body?.userId
    });

    res.status(429).json({
      success: false,
      message: 'Too many purchase attempts. Please slow down.',
      statusCode: 429,
      timestamp: new Date().toISOString()
    } as ApiErrorResponse);
  }
});

export const authRateLimit: RateLimitRequestHandler = rateLimit({
  windowMs: config.rateLimits.auth.windowMs,
  max: config.rateLimits.auth.max,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.',
    statusCode: 429
  } as ApiErrorResponse,
  keyGenerator: (req: Request) => {
    // Use email + IP for auth rate limiting to prevent targeted attacks
    const email = req.body?.email || '';
    const ip = req.ip || '127.0.0.1';
    return SecurityUtils.generateRateLimitKey(ip, email);
  },
  handler: (req: Request, res: Response) => {
    logger.security('Auth rate limit exceeded', {
      ip: req.ip || 'unknown',
      email: SecurityUtils.hashForLogging(req.body?.email || ''),
      userAgent: req.get('User-Agent') || 'unknown'
    });

    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts. Please try again later.',
      statusCode: 429,
      timestamp: new Date().toISOString()
    } as ApiErrorResponse);
  }
});

// Slow down middleware for suspicious behavior
// Remove suspicious activity slow down (not needed)
// Using rate limiting instead for better control

// Request ID and timing middleware
export const requestMetadata = (req: Request, res: Response, next: NextFunction): void => {
  req.requestId = SecurityUtils.generateRequestId();
  req.startTime = Date.now();

  // Set context for logger
  logger.setContext({
    requestId: req.requestId,
    ip: req.ip || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    method: req.method,
    path: req.path
  });

  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.requestId);

  next();
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const originalSend = res.send;

  res.send = function(data: unknown) {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('Content-Length'),
      userId: req.user?.userId
    });

    return originalSend.call(this, data);
  };

  next();
};

// Authentication middleware
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      logger.security('Authentication failed - no token provided', {
        ip: req.ip,
        path: req.path
      });

      res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
        statusCode: 401,
        timestamp: new Date().toISOString()
      } as ApiErrorResponse);
      return;
    }

    const decoded = SecurityUtils.verifyToken(token);
    req.user = decoded;

    // Update logger context with user info
    logger.setContext({
      userId: decoded.userId,
      userRole: decoded.role
    });

    next();
  } catch (error) {
    logger.security('Authentication failed - invalid token', {
      ip: req.ip,
      path: req.path,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(401).json({
      success: false,
      message: 'Invalid token.',
      statusCode: 401,
      timestamp: new Date().toISOString()
    } as ApiErrorResponse);
  }
};

// Authorization middleware for admin routes
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required.',
      statusCode: 401,
      timestamp: new Date().toISOString()
    } as ApiErrorResponse);
    return;
  }

  if (req.user.role !== 'admin') {
    logger.security('Authorization failed - insufficient permissions', {
      userId: req.user.userId,
      role: req.user.role,
      path: req.path
    });

    res.status(403).json({
      success: false,
      message: 'Admin access required.',
      statusCode: 403,
      timestamp: new Date().toISOString()
    } as ApiErrorResponse);
    return;
  }

  next();
};

// Input validation middleware
export const validateInput = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Input validation failed', {
        errors: errors.array(),
        body: req.body,
        userId: req.user?.userId
      });

      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
        statusCode: 400,
        timestamp: new Date().toISOString()
      });
      return;
    }

    next();
  };
};

// Common validation chains
export const purchaseValidation = [
  body('flashSaleId')
    .isInt({ gt: 0 })
    .withMessage('Flash sale ID must be a positive integer'),
  body('productId')
    .optional()
    .isInt({ gt: 0 })
    .withMessage('Product ID must be a positive integer')
];

export const authValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Valid email address required'),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
];

export const profileUpdateValidation = [
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Valid email address required'),
  body('timezone')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('Timezone must be a valid string')
];

export const flashSaleValidation = [
  body('name')
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Flash sale name must be 1-200 characters'),
  body('startTime')
    .isISO8601()
    .withMessage('Start time must be valid ISO 8601 date'),
  body('endTime')
    .isISO8601()
    .withMessage('End time must be valid ISO 8601 date')
    .custom((endTime, { req }) => {
      if (new Date(endTime) <= new Date(req.body.startTime)) {
        throw new Error('End time must be after start time');
      }
      return true;
    }),
  body('products')
    .isArray({ min: 1 })
    .withMessage('At least one product is required')
];

// Flash sale update validation (fields are optional)
export const flashSaleUpdateValidation = [
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Flash sale name must be 1-200 characters'),
  body('startTime')
    .optional()
    .isISO8601()
    .withMessage('Start time must be valid ISO 8601 date'),
  body('endTime')
    .optional()
    .isISO8601()
    .withMessage('End time must be valid ISO 8601 date')
    .custom((endTime, { req }) => {
      // Only validate if both dates are provided
      if (endTime && req.body.startTime && new Date(endTime) <= new Date(req.body.startTime)) {
        throw new Error('End time must be after start time');
      }
      return true;
    }),
  body('products')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one product is required')
];

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Additional security headers beyond helmet
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  next();
};

// HTTP Parameter Pollution protection
export const hppProtection = hpp({
  whitelist: ['sort', 'fields'] // Allow these parameters to be arrays
});

// Data sanitization middleware
export const sanitizeData = (req: Request, res: Response, next: NextFunction): void => {
  // Sanitize against NoSQL injection attacks
  mongoSanitize()(req, res, () => {
    // Additional custom sanitization for body only
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    
    next();
  });
};

// Sanitize object recursively
function sanitizeObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return SecurityUtils.sanitizeInput(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

// Health check middleware
export const healthCheck = (req: Request, res: Response, next: NextFunction): void => {
  if (req.path === '/health') {
    res.json({
      success: true,
      message: 'Server is healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0'
    });
    return;
  }
  next();
};

// Error handling middleware
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.userId,
    requestId: req.requestId
  });

  // Don't leak error details in production
  const isDevelopment = config.nodeEnv === 'development';

  const errorResponse: ApiErrorResponse = {
    success: false,
    message: 'Internal server error',
    statusCode: 500,
    timestamp: new Date().toISOString(),
    path: req.path
  };

  if (isDevelopment) {
    errorResponse.error = err.message;
  }

  res.status(500).json(errorResponse);
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response): void => {
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    success: false,
    message: 'Route not found',
    statusCode: 404,
    timestamp: new Date().toISOString(),
    path: req.path
  } as ApiErrorResponse);
};

// Performance monitoring middleware
export const performanceMonitor = (req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const duration = diff[0] * 1000 + diff[1] * 1e-6; // Convert to milliseconds

    if (duration > 1000) { // Log slow requests (>1 second)
      logger.warn('Slow request detected', {
        path: req.path,
        method: req.method,
        duration,
        statusCode: res.statusCode,
        userId: req.user?.userId
      });
    }

    logger.performance(req.path, duration, {
      method: req.method,
      statusCode: res.statusCode,
      userId: req.user?.userId
    });
  });

  next();
};

export default {
  apiRateLimit,
  purchaseRateLimit,
  authRateLimit,
  requestMetadata,
  requestLogger,
  authenticate,
  requireAdmin,
  validateInput,
  purchaseValidation,
  authValidation,
  profileUpdateValidation,
  flashSaleValidation,
  flashSaleUpdateValidation,
  securityHeaders,
  hppProtection,
  sanitizeData,
  healthCheck,
  errorHandler,
  notFoundHandler,
  performanceMonitor
};
