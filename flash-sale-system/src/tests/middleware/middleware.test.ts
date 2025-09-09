// Mock dependencies before imports
jest.mock('../../utils/security');
jest.mock('../../utils/logger');

// Mock express-validator
const mockValidationResult = jest.fn();
const mockBody = jest.fn().mockReturnValue({
  isString: jest.fn().mockReturnThis(),
  trim: jest.fn().mockReturnThis(),
  isLength: jest.fn().mockReturnThis(),
  notEmpty: jest.fn().mockReturnThis(),
  withMessage: jest.fn().mockReturnThis(),
  isUUID: jest.fn().mockReturnThis(),
  isEmail: jest.fn().mockReturnThis(),
  normalizeEmail: jest.fn().mockReturnThis(),
  isStrongPassword: jest.fn().mockReturnThis(),
  matches: jest.fn().mockReturnThis(),
  optional: jest.fn().mockReturnThis(),
  isInt: jest.fn().mockReturnThis(),
  toInt: jest.fn().mockReturnThis(),
  isISO8601: jest.fn().mockReturnThis(),
  toDate: jest.fn().mockReturnThis(),
  isDecimal: jest.fn().mockReturnThis(),
  toFloat: jest.fn().mockReturnThis(),
  isBoolean: jest.fn().mockReturnThis(),
  toBoolean: jest.fn().mockReturnThis(),
  isIn: jest.fn().mockReturnThis(),
  custom: jest.fn().mockReturnThis(),
  isArray: jest.fn().mockReturnThis(),
  run: jest.fn().mockResolvedValue(undefined)
});

jest.mock('express-validator', () => ({
  validationResult: mockValidationResult,
  body: mockBody
}));

import { Request, Response, NextFunction } from 'express';
import { authenticate, requireAdmin, validateInput, apiRateLimit } from '../../middleware';
import SecurityUtils from '../../utils/security';
import logger from '../../utils/logger';

describe('Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockSecurityUtils: jest.Mocked<typeof SecurityUtils>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSecurityUtils = SecurityUtils as jest.Mocked<typeof SecurityUtils>;
    
    mockRequest = {
      headers: {},
      body: {},
      path: '/api/test'
    } as any;

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    } as any;

    mockNext = jest.fn();
    
    mockSecurityUtils.verifyToken = jest.fn();
    logger.security = jest.fn();
    logger.setContext = jest.fn();
  });

  describe('authenticate', () => {
    it('should authenticate valid token successfully', () => {
      const mockPayload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user' as const,
        iat: 1234567890,
        exp: 1234567999
      };

      mockRequest.header = jest.fn().mockReturnValue('Bearer valid_token');
      mockSecurityUtils.verifyToken.mockReturnValue(mockPayload);

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSecurityUtils.verifyToken).toHaveBeenCalledWith('valid_token');
      expect(mockRequest.user).toEqual(mockPayload);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject request without authorization header', () => {
      mockRequest.header = jest.fn().mockReturnValue(undefined);

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied. No token provided.',
        statusCode: 401,
        timestamp: expect.any(String)
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', () => {
      mockRequest.header = jest.fn().mockReturnValue('Bearer invalid_token');

      mockSecurityUtils.verifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token.',
        statusCode: 401,
        timestamp: expect.any(String)
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('should allow access for admin user', () => {
      mockRequest.user = {
        userId: 'admin123',
        email: 'admin@example.com',
        role: 'admin' as const,
        iat: 1234567890,
        exp: 1234567999
      };

      requireAdmin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject request for non-admin user', () => {
      mockRequest.user = {
        userId: 'user123',
        email: 'user@example.com',
        role: 'user' as const,
        iat: 1234567890,
        exp: 1234567999
      };

      requireAdmin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Admin access required.',
        statusCode: 403,
        timestamp: expect.any(String)
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validateInput', () => {
    const mockValidations = [
      { run: jest.fn().mockResolvedValue(undefined) } as any,
      { run: jest.fn().mockResolvedValue(undefined) } as any
    ];

    beforeEach(() => {
      mockValidations.forEach(validation => {
        (validation.run as jest.Mock).mockClear();
      });
    });

    it('should pass validation when no errors', async () => {
      mockValidationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => []
      });

      const middleware = validateInput(mockValidations);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockValidations[0].run).toHaveBeenCalledWith(mockRequest);
      expect(mockValidations[1].run).toHaveBeenCalledWith(mockRequest);
      expect(mockValidationResult).toHaveBeenCalledWith(mockRequest);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject request with validation errors', async () => {
      const mockErrors = [
        { msg: 'Email is required', param: 'email' },
        { msg: 'Password too short', param: 'password' }
      ];

      mockValidationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => mockErrors
      });

      mockRequest.user = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user' as const,
        iat: 1234567890,
        exp: 1234567999
      };

      const middleware = validateInput(mockValidations);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        errors: mockErrors,
        statusCode: 400,
        timestamp: expect.any(String)
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting configuration', () => {
      expect(apiRateLimit).toBeDefined();
      expect(typeof apiRateLimit).toBe('function');
    });
  });
});
