import { config as dotenvConfig } from 'dotenv';
import { AppConfig } from '../types';

// Load environment variables
dotenvConfig();

const requiredEnvVars = [
  'JWT_SECRET',
  'DATABASE_PATH'
] as const;

// Validate required environment variables
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Required environment variable ${envVar} is not set`);
  }
}

const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
  
  database: {
    path: process.env.DATABASE_PATH!,
    enableWAL: process.env.NODE_ENV !== 'test',
    busyTimeout: parseInt(process.env.DB_BUSY_TIMEOUT || '30000', 10),
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10)
  },
  
  security: {
    jwtSecret: process.env.JWT_SECRET!,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '900000', 10) // 15 minutes
  },
  
  rateLimits: {
    api: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
      standardHeaders: true,
      legacyHeaders: false
    },
    purchase: {
      windowMs: parseInt(process.env.PURCHASE_RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
      max: parseInt(process.env.PURCHASE_RATE_LIMIT_MAX || '10', 10),
      standardHeaders: true,
      legacyHeaders: false
    },
    auth: {
      windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
      max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5', 10),
      standardHeaders: true,
      legacyHeaders: false
    }
  },
  
  cors: {
    origins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
  },
  
  logging: {
    level: (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
    file: process.env.LOG_FILE
  }
};

// Validate configuration
if (config.port < 1 || config.port > 65535) {
  throw new Error(`Invalid port number: ${config.port}`);
}

if (config.security.bcryptRounds < 10 || config.security.bcryptRounds > 15) {
  throw new Error('Bcrypt rounds must be between 10 and 15');
}

if (config.security.jwtSecret.length < 32) {
  throw new Error('JWT secret must be at least 32 characters long');
}

export default config;
