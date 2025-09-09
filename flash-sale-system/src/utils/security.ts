import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';
import { JWTPayload, User } from '../types';
import logger from './logger';

export class SecurityUtils {
  private static readonly JWT_SECRET = config.security.jwtSecret;
  private static readonly JWT_EXPIRES_IN = config.security.jwtExpiresIn;
  private static readonly BCRYPT_ROUNDS = config.security.bcryptRounds;

  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    try {
      const hash = await bcrypt.hash(password, this.BCRYPT_ROUNDS);
      logger.debug('Password hashed successfully');
      return hash;
    } catch (error) {
      logger.error('Failed to hash password', { error });
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Verify a password against its hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      const isValid = await bcrypt.compare(password, hash);
      logger.debug('Password verification completed', { isValid });
      return isValid;
    } catch (error) {
      logger.error('Password verification failed', { error });
      return false;
    }
  }

  /**
   * Generate a JWT token
   */
  static generateToken(user: Pick<User, 'id' | 'email' | 'role'>): string {
    try {
      const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
        userId: user.id,
        email: user.email,
        role: user.role
      };

      const token = jwt.sign(payload, this.JWT_SECRET, {
        expiresIn: this.JWT_EXPIRES_IN,
        issuer: 'flash-sale-system',
        audience: 'flash-sale-users'
      } as jwt.SignOptions);

      logger.audit('JWT token generated', 'auth', user.id, { userId: user.id });
      return token;
    } catch (error) {
      logger.error('Failed to generate JWT token', { error, userId: user.id });
      throw new Error('Token generation failed');
    }
  }

  /**
   * Verify and decode a JWT token
   */
  static verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET, {
        issuer: 'flash-sale-system',
        audience: 'flash-sale-users'
      }) as JWTPayload;

      logger.debug('JWT token verified successfully', { userId: decoded.userId });
      return decoded;
    } catch (error) {
      logger.security('Invalid JWT token verification attempt', { error });
      
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  /**
   * Generate a secure random string
   */
  static generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate a unique request ID
   */
  static generateRequestId(): string {
    return uuidv4();
  }

  /**
   * Validate password strength
   */
  static validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must be less than 128 characters long');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common weak patterns
    const commonPatterns = [
      /(.)\1{2,}/, // Repeated characters (aaa, 111)
      /012|123|234|345|456|567|678|789|890/, // Sequential numbers
      /abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i // Sequential letters
    ];

    for (const pattern of commonPatterns) {
      if (pattern.test(password)) {
        errors.push('Password contains weak patterns (repeated or sequential characters)');
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize input to prevent XSS
   */
  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove < and >
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Generate a hash for rate limiting keys
   */
  static generateRateLimitKey(ip: string, identifier?: string): string {
    const data = identifier ? `${ip}:${identifier}` : ip;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  static constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Generate CSRF token
   */
  static generateCSRFToken(): string {
    return crypto.randomBytes(32).toString('base64');
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Validate user ID format
   */
  static validateUserId(userId: string): boolean {
    // Allow alphanumeric and some special characters, length 1-100
    const userIdRegex = /^[a-zA-Z0-9._-]{1,100}$/;
    return userIdRegex.test(userId);
  }

  /**
   * Generate API key
   */
  static generateApiKey(): string {
    const prefix = 'fs_'; // flash-sale prefix
    const randomPart = crypto.randomBytes(32).toString('base64')
      .replace(/[+/=]/g, '') // Remove problematic characters
      .substring(0, 40);
    
    return `${prefix}${randomPart}`;
  }

  /**
   * Hash sensitive data for logging (one-way hash)
   */
  static hashForLogging(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 8);
  }
}

export default SecurityUtils;
