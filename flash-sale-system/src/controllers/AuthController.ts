import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { UserModel } from '../models/User';
import { SecurityUtils } from '../utils/security';
import logger from '../utils/logger';
import { ApiResponse, ApiErrorResponse, JWTPayload } from '../types';

export class AuthController {
  private userModel: UserModel;

  constructor() {
    this.userModel = new UserModel();
  }

  /**
   * User registration
   */
  async register(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'Validation failed',
          error: errors.array().map(err => err.msg).join(', '),
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      const { email, password, confirmPassword, timezone } = req.body;

      // Check if passwords match
      if (password !== confirmPassword) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: 'PASSWORDS_DO_NOT_MATCH',
          message: 'Passwords do not match',
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      // Generate user ID (simple timestamp-based for now)
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Attempt to create user
      const user = await this.userModel.create({
        id: userId,
        email,
        password,
        role: 'user',
        timezone: timezone || 'UTC'
      });

      logger.info('User registered successfully', {
        userId: user.id,
        email: SecurityUtils.hashForLogging(email),
        duration: Date.now() - startTime,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown'
      });

      // Remove sensitive data from response
      const { password_hash, ...userWithoutPassword } = user;

      const successResponse: ApiResponse<typeof userWithoutPassword> = {
        success: true,
        data: userWithoutPassword,
        message: 'User registered successfully',
        timestamp: new Date().toISOString()
      };

      res.status(201).json(successResponse);
    } catch (error) {
      logger.error('Registration error', {
        error,
        email: SecurityUtils.hashForLogging(req.body?.email || ''),
        duration: Date.now() - startTime,
        ip: req.ip || 'unknown'
      });

      const errorResponse: ApiErrorResponse = {
        success: false,
        message: 'Registration failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  /**
   * User login
   */
  async login(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'Validation failed',
          error: errors.array().map(err => err.msg).join(', '),
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      const { email, password } = req.body;

      // Attempt authentication
      const authResult = await this.userModel.authenticate(email, password);

      if (!authResult) {
        // Log failed login attempt
        logger.security('Failed login attempt', {
          email: SecurityUtils.hashForLogging(email),
          reason: 'Invalid credentials',
          ip: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          duration: Date.now() - startTime
        });

        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'Invalid email or password',
          statusCode: 401,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(401).json(errorResponse);
        return;
      }

      const { user, token } = authResult;

      logger.info('User logged in successfully', {
        userId: user.id,
        email: SecurityUtils.hashForLogging(email),
        role: user.role,
        duration: Date.now() - startTime,
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown'
      });

      const { password_hash, ...userWithoutPassword } = user;

      const successResponse: ApiResponse<{
        user: typeof userWithoutPassword;
        token: string;
        expiresIn: string;
      }> = {
        success: true,
        data: {
          user: userWithoutPassword,
          token,
          expiresIn: '24h'
        },
        message: 'Login successful',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(successResponse);
    } catch (error) {
      logger.error('Login error', {
        error,
        email: SecurityUtils.hashForLogging(req.body?.email || ''),
        duration: Date.now() - startTime,
        ip: req.ip || 'unknown'
      });

      const errorResponse: ApiErrorResponse = {
        success: false,
        message: 'Login failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'User not authenticated',
          statusCode: 401,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(401).json(errorResponse);
        return;
      }

      const user = await this.userModel.findById(userId);

      if (!user) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'User not found',
          statusCode: 404,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(404).json(errorResponse);
        return;
      }

      // Remove sensitive data
      const { password_hash, ...userWithoutPassword } = user;

      const successResponse: ApiResponse<typeof userWithoutPassword> = {
        success: true,
        data: userWithoutPassword,
        message: 'Profile retrieved successfully',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(successResponse);
    } catch (error) {
      logger.error('Get profile error', {
        error,
        userId: req.user?.userId,
        ip: req.ip || 'unknown'
      });

      const errorResponse: ApiErrorResponse = {
        success: false,
        message: 'Failed to retrieve profile',
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'User not authenticated',
          statusCode: 401,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(401).json(errorResponse);
        return;
      }

      const { email, timezone } = req.body;

      // Update the profile
      const updatedUser = await this.userModel.updateProfile(userId, { email, timezone });

      // Remove sensitive data
      const { password_hash, ...userWithoutPassword } = updatedUser;

      const successResponse: ApiResponse<typeof userWithoutPassword> = {
        success: true,
        data: userWithoutPassword,
        message: 'Profile updated successfully',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(successResponse);
    } catch (error) {
      logger.error('Update profile error', {
        error,
        userId: req.user?.userId,
        ip: req.ip || 'unknown'
      });

      const errorResponse: ApiErrorResponse = {
        success: false,
        message: 'Failed to update profile',
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Change password
   */
  async changePassword(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'Validation failed',
          error: errors.array().map(err => err.msg).join(', '),
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      const userId = req.user?.userId;
      const { currentPassword, newPassword, confirmPassword } = req.body;

      if (!userId) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'User not authenticated',
          statusCode: 401,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(401).json(errorResponse);
        return;
      }

      if (!currentPassword || !newPassword) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'Current password and new password are required',
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      if (newPassword !== confirmPassword) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'New passwords do not match',
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      // Get current user to verify current password
      const user = await this.userModel.findById(userId);
      if (!user) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'User not found',
          statusCode: 404,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(404).json(errorResponse);
        return;
      }

      // Verify current password
      const isCurrentPasswordValid = await SecurityUtils.verifyPassword(currentPassword!, user.password_hash!);
      if (!isCurrentPasswordValid) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'Current password is incorrect',
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      // Update password using the changePassword method
      await this.userModel.changePassword(userId, currentPassword, newPassword);

      logger.info('Password changed successfully', {
        userId,
        duration: Date.now() - startTime,
        ip: req.ip || 'unknown'
      });

      const successResponse: ApiResponse<null> = {
        success: true,
        data: null,
        message: 'Password changed successfully',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(successResponse);
    } catch (error) {
      logger.error('Change password error', {
        error,
        userId: req.user?.userId,
        duration: Date.now() - startTime,
        ip: req.ip || 'unknown'
      });

      const errorResponse: ApiErrorResponse = {
        success: false,
        message: 'Failed to change password',
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Logout (optional - mainly for audit purposes since JWT is stateless)
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (userId) {
        logger.info('User logged out', {
          userId,
          ip: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown'
        });
      }

      const successResponse: ApiResponse<null> = {
        success: true,
        data: null,
        message: 'Logout successful',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(successResponse);
    } catch (error) {
      logger.error('Logout error', {
        error,
        userId: req.user?.userId,
        ip: req.ip || 'unknown'
      });

      const errorResponse: ApiErrorResponse = {
        success: false,
        message: 'Logout failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }
}

export default AuthController;
