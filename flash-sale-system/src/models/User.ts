import { Database } from './database';
import logger from '../utils/logger';
import SecurityUtils from '../utils/security';
import { TimezoneUtils } from '../utils/timezone';
import { User, JWTPayload } from '../types';

export class UserModel {
  private database: Database;

  constructor() {
    this.database = Database.getInstance();
  }

  async create(userData: {
    id: string;
    email: string;
    password: string;
    role?: 'user' | 'admin';
    timezone?: string;
  }): Promise<User> {
    try {
      // Validate input
      if (!SecurityUtils.validateEmail(userData.email)) {
        throw new Error('Invalid email format');
      }

      if (!SecurityUtils.validateUserId(userData.id)) {
        throw new Error('Invalid user ID format');
      }

      const passwordValidation = SecurityUtils.validatePasswordStrength(userData.password);
      if (!passwordValidation.isValid) {
        throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
      }

      // Hash password
      const passwordHash = await SecurityUtils.hashPassword(userData.password);

      const sql = `
        INSERT INTO users (id, email, password_hash, role, timezone)
        VALUES (?, ?, ?, ?, ?)
      `;

      await this.database.run(sql, [
        userData.id,
        userData.email.toLowerCase(),
        passwordHash,
        userData.role || 'user',
        userData.timezone || 'UTC'
      ]);

      logger.audit('User created', 'user', userData.id, { 
        email: userData.email, 
        role: userData.role,
        timezone: userData.timezone || 'UTC'
      });

      return this.findById(userData.id) as Promise<User>;
    } catch (error) {
      logger.error('Failed to create user', { error, email: userData.email });
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      const sql = 'SELECT * FROM users WHERE id = ? AND is_active = 1';
      const user = await this.database.get(sql, [id]) as User | undefined;
      return user || null;
    } catch (error) {
      logger.error('Failed to find user by ID', { error, userId: id });
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const sql = 'SELECT * FROM users WHERE email = ? AND is_active = 1';
      const user = await this.database.get(sql, [email.toLowerCase()]) as User | undefined;
      return user || null;
    } catch (error) {
      logger.error('Failed to find user by email', { error, email: SecurityUtils.hashForLogging(email) });
      throw error;
    }
  }

  async authenticate(email: string, password: string): Promise<{ user: User; token: string } | null> {
    try {
      const user = await this.findByEmail(email);
      if (!user) {
        logger.security('Authentication failed - user not found', { email: SecurityUtils.hashForLogging(email) });
        return null;
      }

      // Check if user is locked
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        logger.security('Authentication failed - user locked', { userId: user.id });
        throw new Error('Account is temporarily locked due to multiple failed login attempts');
      }

      // Verify password
      const isValidPassword = await SecurityUtils.verifyPassword(password, user.password_hash!);
      
      if (!isValidPassword) {
        await this.incrementFailedLoginAttempts(user.id);
        logger.security('Authentication failed - invalid password', { userId: user.id });
        return null;
      }

      // Reset failed attempts and update last login
      await this.resetFailedLoginAttempts(user.id);
      await this.updateLastLogin(user.id);

      // Generate token
      const token = SecurityUtils.generateToken(user);

      logger.audit('User authenticated successfully', 'auth', user.id);
      return { user, token };

    } catch (error) {
      logger.error('Authentication process failed', { error, email: SecurityUtils.hashForLogging(email) });
      throw error;
    }
  }

  async updateLastLogin(userId: string): Promise<void> {
    try {
      const sql = 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?';
      await this.database.run(sql, [userId]);
    } catch (error) {
      logger.error('Failed to update last login', { error, userId });
      // Don't throw - this is not critical
    }
  }

  async incrementFailedLoginAttempts(userId: string): Promise<void> {
    try {
      await this.database.beginTransaction();

      // Get current failed attempts
      const user = await this.findById(userId);
      if (!user) {
        await this.database.rollback();
        return;
      }

      const newFailedAttempts = (user.failed_login_attempts || 0) + 1;
      const maxAttempts = 5; // Could be moved to config

      let lockedUntil: string | null = null;
      if (newFailedAttempts >= maxAttempts) {
        // Lock account for 15 minutes
        const lockDuration = 15 * 60 * 1000; // 15 minutes in milliseconds
        lockedUntil = new Date(Date.now() + lockDuration).toISOString();
        
        logger.security('User account locked due to failed login attempts', {
          userId,
          failedAttempts: newFailedAttempts,
          lockedUntil
        });
      }

      const sql = `
        UPDATE users 
        SET failed_login_attempts = ?, locked_until = ?
        WHERE id = ?
      `;

      await this.database.run(sql, [newFailedAttempts, lockedUntil, userId]);
      await this.database.commit();

    } catch (error) {
      await this.database.rollback();
      logger.error('Failed to increment failed login attempts', { error, userId });
    }
  }

  async resetFailedLoginAttempts(userId: string): Promise<void> {
    try {
      const sql = `
        UPDATE users 
        SET failed_login_attempts = 0, locked_until = NULL
        WHERE id = ?
      `;
      await this.database.run(sql, [userId]);
    } catch (error) {
      logger.error('Failed to reset failed login attempts', { error, userId });
      // Don't throw - this is not critical
    }
  }

  async updateProfile(userId: string, updates: Partial<Pick<User, 'email' | 'timezone'>>): Promise<User> {
    try {
      const fields: string[] = [];
      const values: unknown[] = [];

      if (updates.email) {
        if (!SecurityUtils.validateEmail(updates.email)) {
          throw new Error('Invalid email format');
        }
        fields.push('email = ?');
        values.push(updates.email.toLowerCase());
      }

      if (updates.timezone !== undefined) {
        // Validate timezone if provided
        if (updates.timezone && !TimezoneUtils.isValidTimezone(updates.timezone)) {
          throw new Error('Invalid timezone format');
        }
        fields.push('timezone = ?');
        values.push(updates.timezone || 'UTC');
      }

      if (fields.length === 0) {
        throw new Error('No valid fields to update');
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(userId);

      const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
      await this.database.run(sql, values);

      logger.audit('User profile updated', 'user', userId, updates);

      return this.findById(userId) as Promise<User>;
    } catch (error) {
      logger.error('Failed to update user profile', { error, userId });
      throw error;
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await this.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isValidCurrentPassword = await SecurityUtils.verifyPassword(currentPassword, user.password_hash!);
      if (!isValidCurrentPassword) {
        logger.security('Password change failed - invalid current password', { userId });
        throw new Error('Current password is incorrect');
      }

      // Validate new password
      const passwordValidation = SecurityUtils.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        throw new Error(`New password validation failed: ${passwordValidation.errors.join(', ')}`);
      }

      // Hash new password
      const newPasswordHash = await SecurityUtils.hashPassword(newPassword);

      const sql = 'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      await this.database.run(sql, [newPasswordHash, userId]);

      logger.audit('Password changed successfully', 'user', userId);
    } catch (error) {
      logger.error('Failed to change password', { error, userId });
      throw error;
    }
  }

  async deactivate(userId: string): Promise<void> {
    try {
      const sql = 'UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      await this.database.run(sql, [userId]);

      logger.audit('User deactivated', 'user', userId);
    } catch (error) {
      logger.error('Failed to deactivate user', { error, userId });
      throw error;
    }
  }

  async list(options: {
    limit?: number;
    offset?: number;
    role?: 'user' | 'admin';
    isActive?: boolean;
  } = {}): Promise<{ users: Omit<User, 'password_hash'>[]; total: number }> {
    try {
      const { limit = 50, offset = 0, role, isActive = true } = options;

      let whereConditions = ['is_active = ?'];
      let params: unknown[] = [isActive ? 1 : 0];

      if (role) {
        whereConditions.push('role = ?');
        params.push(role);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countSql = `SELECT COUNT(*) as total FROM users WHERE ${whereClause}`;
      const countResult = await this.database.get(countSql, params) as { total: number };

      // Get users (excluding password_hash)
      const sql = `
        SELECT id, email, role, is_active, created_at, last_login, failed_login_attempts
        FROM users 
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;

      const users = await this.database.all(sql, [...params, limit, offset]) as Omit<User, 'password_hash'>[];

      return {
        users,
        total: countResult.total
      };
    } catch (error) {
      logger.error('Failed to list users', { error, options });
      throw error;
    }
  }
}

export default UserModel;
