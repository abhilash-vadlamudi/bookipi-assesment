import { UserModel } from '../../models/User';
import { Database } from '../../models/database';
import SecurityUtils from '../../utils/security';
import { TimezoneUtils } from '../../utils/timezone';
import logger from '../../utils/logger';

// Mock dependencies
jest.mock('../../models/database');
jest.mock('../../utils/security');
jest.mock('../../utils/timezone');
jest.mock('../../utils/logger');

describe('UserModel', () => {
  let userModel: UserModel;
  let mockDatabase: jest.Mocked<Database>;
  let mockSecurityUtils: jest.Mocked<typeof SecurityUtils>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock database instance
    mockDatabase = {
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      close: jest.fn()
    } as any;

    // Mock Database.getInstance
    (Database.getInstance as jest.Mock).mockReturnValue(mockDatabase);
    
    // Mock SecurityUtils
    mockSecurityUtils = SecurityUtils as jest.Mocked<typeof SecurityUtils>;
    mockSecurityUtils.validateEmail.mockReturnValue(true);
    mockSecurityUtils.validateUserId.mockReturnValue(true);
    mockSecurityUtils.validatePasswordStrength.mockReturnValue({ isValid: true, errors: [] });
    mockSecurityUtils.hashPassword.mockResolvedValue('hashed_password');
    mockSecurityUtils.verifyPassword.mockResolvedValue(true);
    mockSecurityUtils.generateToken.mockReturnValue('jwt_token');
    mockSecurityUtils.hashForLogging.mockReturnValue('hashed_email');

    // Mock TimezoneUtils
    (TimezoneUtils.isValidTimezone as jest.Mock).mockReturnValue(true);
    
    userModel = new UserModel();
  });

  describe('create', () => {
    const validUserData = {
      id: 'user123',
      email: 'test@example.com',
      password: 'StrongPassword123!',
      role: 'user' as const,
      timezone: 'America/New_York'
    };

    it('should create user successfully', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        role: 'user',
        timezone: 'America/New_York',
        is_active: 1,
        created_at: new Date().toISOString()
      };

      mockDatabase.run.mockResolvedValue({ id: 'user123', changes: 1 } as any);
      mockDatabase.get.mockResolvedValue(mockUser);

      const result = await userModel.create(validUserData);

      expect(mockSecurityUtils.validateEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockSecurityUtils.validateUserId).toHaveBeenCalledWith('user123');
      expect(mockSecurityUtils.validatePasswordStrength).toHaveBeenCalledWith('StrongPassword123!');
      expect(mockSecurityUtils.hashPassword).toHaveBeenCalledWith('StrongPassword123!');

      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        ['user123', 'test@example.com', 'hashed_password', 'user', 'America/New_York']
      );

      expect(result).toEqual(mockUser);
      expect(logger.audit).toHaveBeenCalledWith(
        'User created',
        'user',
        'user123',
        expect.objectContaining({
          email: 'test@example.com',
          role: 'user',
          timezone: 'America/New_York'
        })
      );
    });

    it('should use default values for optional fields', async () => {
      const minimalUserData = {
        id: 'user123',
        email: 'test@example.com',
        password: 'StrongPassword123!'
      };

      mockDatabase.run.mockResolvedValue({ id: 'user123', changes: 1 } as any);
      mockDatabase.get.mockResolvedValue({});

      await userModel.create(minimalUserData);

      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        ['user123', 'test@example.com', 'hashed_password', 'user', 'UTC']
      );
    });

    it('should throw error for invalid email', async () => {
      mockSecurityUtils.validateEmail.mockReturnValue(false);

      const invalidData = { ...validUserData, email: 'invalid-email' };

      await expect(userModel.create(invalidData)).rejects.toThrow('Invalid email format');
      expect(mockDatabase.run).not.toHaveBeenCalled();
    });

    it('should throw error for invalid user ID', async () => {
      mockSecurityUtils.validateUserId.mockReturnValue(false);

      const invalidData = { ...validUserData, id: 'invalid@id' };

      await expect(userModel.create(invalidData)).rejects.toThrow('Invalid user ID format');
      expect(mockDatabase.run).not.toHaveBeenCalled();
    });

    it('should throw error for weak password', async () => {
      mockSecurityUtils.validatePasswordStrength.mockReturnValue({
        isValid: false,
        errors: ['Password too short', 'Missing special character']
      });

      const invalidData = { ...validUserData, password: 'weak' };

      await expect(userModel.create(invalidData)).rejects.toThrow(
        'Password validation failed: Password too short, Missing special character'
      );
      expect(mockDatabase.run).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database constraint violation');
      mockDatabase.run.mockRejectedValue(dbError);

      await expect(userModel.create(validUserData)).rejects.toThrow('Database constraint violation');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create user',
        { error: dbError, email: 'test@example.com' }
      );
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        role: 'user',
        is_active: 1
      };

      mockDatabase.get.mockResolvedValue(mockUser);

      const result = await userModel.findById('user123');

      expect(mockDatabase.get).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = ? AND is_active = 1',
        ['user123']
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockDatabase.get.mockResolvedValue(undefined);

      const result = await userModel.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database error');
      mockDatabase.get.mockRejectedValue(dbError);

      await expect(userModel.findById('user123')).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to find user by ID',
        { error: dbError, userId: 'user123' }
      );
    });
  });

  describe('findByEmail', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        role: 'user'
      };

      mockDatabase.get.mockResolvedValue(mockUser);

      const result = await userModel.findByEmail('Test@Example.com');

      expect(mockDatabase.get).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = ? AND is_active = 1',
        ['test@example.com'] // should be lowercase
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockDatabase.get.mockResolvedValue(undefined);

      const result = await userModel.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('authenticate', () => {
    const mockUser = {
      id: 'user123',
      email: 'test@example.com',
      password_hash: 'hashed_password',
      role: 'user',
      locked_until: null,
      failed_login_attempts: 0
    };

    it('should authenticate user successfully', async () => {
      mockDatabase.get
        .mockResolvedValueOnce(mockUser) // findByEmail
        .mockResolvedValueOnce({ changes: 1 } as any) // resetFailedLoginAttempts
        .mockResolvedValueOnce({ changes: 1 } as any); // updateLastLogin

      const result = await userModel.authenticate('test@example.com', 'StrongPassword123!');

      expect(mockSecurityUtils.verifyPassword).toHaveBeenCalledWith('StrongPassword123!', 'hashed_password');
      expect(mockSecurityUtils.generateToken).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual({
        user: mockUser,
        token: 'jwt_token'
      });

      expect(logger.audit).toHaveBeenCalledWith(
        'User authenticated successfully',
        'auth',
        'user123'
      );
    });

    it('should return null for non-existent user', async () => {
      mockDatabase.get.mockResolvedValue(null);

      const result = await userModel.authenticate('nonexistent@example.com', 'password');

      expect(result).toBeNull();
      expect(logger.security).toHaveBeenCalledWith(
        'Authentication failed - user not found',
        { email: 'hashed_email' }
      );
    });

    it('should throw error for locked account', async () => {
      const lockedUser = {
        ...mockUser,
        locked_until: new Date(Date.now() + 600000).toISOString() // locked for 10 minutes
      };

      mockDatabase.get.mockResolvedValue(lockedUser);

      await expect(userModel.authenticate('test@example.com', 'password'))
        .rejects.toThrow('Account is temporarily locked');

      expect(logger.security).toHaveBeenCalledWith(
        'Authentication failed - user locked',
        { userId: 'user123' }
      );
    });

    it('should return null for invalid password and increment failed attempts', async () => {
      mockSecurityUtils.verifyPassword.mockResolvedValue(false);
      mockDatabase.get.mockResolvedValue(mockUser);

      const result = await userModel.authenticate('test@example.com', 'wrongpassword');

      expect(result).toBeNull();
      expect(logger.security).toHaveBeenCalledWith(
        'Authentication failed - invalid password',
        { userId: 'user123' }
      );
    });

    it('should handle authentication errors', async () => {
      const authError = new Error('Authentication service unavailable');
      mockDatabase.get.mockRejectedValue(authError);

      await expect(userModel.authenticate('test@example.com', 'password'))
        .rejects.toThrow('Authentication service unavailable');

      expect(logger.error).toHaveBeenCalledWith(
        'Authentication process failed',
        { error: authError, email: 'hashed_email' }
      );
    });
  });

  describe('incrementFailedLoginAttempts', () => {
    const mockUser = {
      id: 'user123',
      failed_login_attempts: 3
    };

    it('should increment failed attempts without locking', async () => {
      mockDatabase.get.mockResolvedValue(mockUser);
      mockDatabase.run.mockResolvedValue({ changes: 1 } as any);

      await userModel.incrementFailedLoginAttempts('user123');

      expect(mockDatabase.beginTransaction).toHaveBeenCalled();
      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        [4, null, 'user123']
      );
      expect(mockDatabase.commit).toHaveBeenCalled();
    });

    it('should lock account after max failed attempts', async () => {
      const userWithMaxAttempts = {
        ...mockUser,
        failed_login_attempts: 4 // Next attempt will be 5th (max)
      };

      mockDatabase.get.mockResolvedValue(userWithMaxAttempts);
      mockDatabase.run.mockResolvedValue({ changes: 1 } as any);

      await userModel.incrementFailedLoginAttempts('user123');

      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        [5, expect.any(String), 'user123'] // Should have locked_until timestamp
      );

      expect(logger.security).toHaveBeenCalledWith(
        'User account locked due to failed login attempts',
        expect.objectContaining({
          userId: 'user123',
          failedAttempts: 5
        })
      );
    });

    it('should handle database errors with rollback', async () => {
      const dbError = new Error('Database error');
      mockDatabase.get.mockRejectedValue(dbError);

      await userModel.incrementFailedLoginAttempts('user123');

      expect(mockDatabase.rollback).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to increment failed login attempts',
        { error: dbError, userId: 'user123' }
      );
    });
  });

  describe('updateProfile', () => {
    it('should update email successfully', async () => {
      const mockUpdatedUser = {
        id: 'user123',
        email: 'newemail@example.com',
        timezone: 'UTC'
      };

      mockDatabase.run.mockResolvedValue({ changes: 1 } as any);
      mockDatabase.get.mockResolvedValue(mockUpdatedUser);

      const result = await userModel.updateProfile('user123', {
        email: 'NewEmail@Example.com'
      });

      expect(mockSecurityUtils.validateEmail).toHaveBeenCalledWith('NewEmail@Example.com');
      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET email = ?'),
        ['newemail@example.com', 'user123']
      );
      expect(result).toEqual(mockUpdatedUser);
    });

    it('should update timezone successfully', async () => {
      const mockUpdatedUser = {
        id: 'user123',
        email: 'test@example.com',
        timezone: 'Europe/London'
      };

      mockDatabase.run.mockResolvedValue({ changes: 1 } as any);
      mockDatabase.get.mockResolvedValue(mockUpdatedUser);

      const result = await userModel.updateProfile('user123', {
        timezone: 'Europe/London'
      });

      expect(TimezoneUtils.isValidTimezone).toHaveBeenCalledWith('Europe/London');
      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET timezone = ?'),
        ['Europe/London', 'user123']
      );
      expect(result).toEqual(mockUpdatedUser);
    });

    it('should throw error for invalid email', async () => {
      mockSecurityUtils.validateEmail.mockReturnValue(false);

      await expect(userModel.updateProfile('user123', {
        email: 'invalid-email'
      })).rejects.toThrow('Invalid email format');

      expect(mockDatabase.run).not.toHaveBeenCalled();
    });

    it('should throw error for invalid timezone', async () => {
      (TimezoneUtils.isValidTimezone as jest.Mock).mockReturnValue(false);

      await expect(userModel.updateProfile('user123', {
        timezone: 'Invalid/Timezone'
      })).rejects.toThrow('Invalid timezone format');

      expect(mockDatabase.run).not.toHaveBeenCalled();
    });

    it('should throw error when no fields to update', async () => {
      await expect(userModel.updateProfile('user123', {}))
        .rejects.toThrow('No valid fields to update');

      expect(mockDatabase.run).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    const mockUser = {
      id: 'user123',
      password_hash: 'old_hashed_password'
    };

    it('should change password successfully', async () => {
      mockDatabase.get.mockResolvedValue(mockUser);
      mockSecurityUtils.hashPassword.mockResolvedValue('new_hashed_password');
      mockDatabase.run.mockResolvedValue({ changes: 1 } as any);

      await userModel.changePassword('user123', 'OldPassword123!', 'NewPassword456!');

      expect(mockSecurityUtils.verifyPassword).toHaveBeenCalledWith('OldPassword123!', 'old_hashed_password');
      expect(mockSecurityUtils.validatePasswordStrength).toHaveBeenCalledWith('NewPassword456!');
      expect(mockSecurityUtils.hashPassword).toHaveBeenCalledWith('NewPassword456!');
      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET password_hash = ?'),
        ['new_hashed_password', 'user123']
      );

      expect(logger.audit).toHaveBeenCalledWith(
        'Password changed successfully',
        'user',
        'user123'
      );
    });

    it('should throw error for non-existent user', async () => {
      mockDatabase.get.mockResolvedValue(null);

      await expect(userModel.changePassword('nonexistent', 'old', 'new'))
        .rejects.toThrow('User not found');
    });

    it('should throw error for incorrect current password', async () => {
      mockDatabase.get.mockResolvedValue(mockUser);
      mockSecurityUtils.verifyPassword.mockResolvedValue(false);

      await expect(userModel.changePassword('user123', 'WrongPassword', 'NewPassword456!'))
        .rejects.toThrow('Current password is incorrect');

      expect(logger.security).toHaveBeenCalledWith(
        'Password change failed - invalid current password',
        { userId: 'user123' }
      );
    });

    it('should throw error for weak new password', async () => {
      mockDatabase.get.mockResolvedValue(mockUser);
      mockSecurityUtils.validatePasswordStrength.mockReturnValue({
        isValid: false,
        errors: ['Password too weak']
      });

      await expect(userModel.changePassword('user123', 'OldPassword123!', 'weak'))
        .rejects.toThrow('New password validation failed: Password too weak');
    });
  });

  describe('list', () => {
    const mockUsers = [
      { id: 'user1', email: 'user1@test.com', role: 'user' },
      { id: 'user2', email: 'user2@test.com', role: 'admin' }
    ];

    it('should list users with default options', async () => {
      mockDatabase.get.mockResolvedValue({ total: 2 });
      mockDatabase.all.mockResolvedValue(mockUsers);

      const result = await userModel.list();

      expect(mockDatabase.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as total'),
        [1] // isActive = true
      );
      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        [1, 50, 0] // isActive, limit, offset
      );
      expect(result).toEqual({
        users: mockUsers,
        total: 2
      });
    });

    it('should list users with custom options', async () => {
      mockDatabase.get.mockResolvedValue({ total: 1 });
      mockDatabase.all.mockResolvedValue([mockUsers[1]]);

      const result = await userModel.list({
        limit: 10,
        offset: 5,
        role: 'admin',
        isActive: false
      });

      expect(mockDatabase.get).toHaveBeenCalledWith(
        expect.stringContaining('WHERE is_active = ? AND role = ?'),
        [0, 'admin'] // isActive = false, role = admin
      );
      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ? OFFSET ?'),
        [0, 'admin', 10, 5]
      );
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database error');
      mockDatabase.get.mockRejectedValue(dbError);

      await expect(userModel.list()).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to list users',
        { error: dbError, options: {} }
      );
    });
  });

  describe('deactivate', () => {
    it('should deactivate user successfully', async () => {
      mockDatabase.run.mockResolvedValue({ changes: 1 } as any);

      await userModel.deactivate('user123');

      expect(mockDatabase.run).toHaveBeenCalledWith(
        'UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['user123']
      );
      expect(logger.audit).toHaveBeenCalledWith(
        'User deactivated',
        'user',
        'user123'
      );
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database error');
      mockDatabase.run.mockRejectedValue(dbError);

      await expect(userModel.deactivate('user123')).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to deactivate user',
        { error: dbError, userId: 'user123' }
      );
    });
  });
});
