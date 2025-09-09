import winston from 'winston';
import config from '../config';
import { LogContext } from '../types';

// Custom format for structured logging
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}`;
  })
);

// Create transports array
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      customFormat
    )
  })
];

// Add file transport if configured
if (config.logging.file) {
  transports.push(
    new winston.transports.File({
      filename: config.logging.file,
      format: customFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  transports,
  exitOnError: false
});

// Logger wrapper with context support
class Logger {
  private context: LogContext = {};

  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  clearContext(): void {
    this.context = {};
  }

  private log(level: string, message: string, meta: Record<string, unknown> = {}): void {
    logger.log(level, message, { ...this.context, ...meta });
  }

  error(message: string, meta: Record<string, unknown> = {}): void {
    this.log('error', message, meta);
  }

  warn(message: string, meta: Record<string, unknown> = {}): void {
    this.log('warn', message, meta);
  }

  info(message: string, meta: Record<string, unknown> = {}): void {
    this.log('info', message, meta);
  }

  debug(message: string, meta: Record<string, unknown> = {}): void {
    this.log('debug', message, meta);
  }

  // Security-specific logging methods
  security(action: string, details: Record<string, unknown> = {}): void {
    this.info(`[SECURITY] ${action}`, { ...details, security: true });
  }

  audit(action: string, resource: string, resourceId?: string, details: Record<string, unknown> = {}): void {
    this.info(`[AUDIT] ${action}`, { 
      action, 
      resource, 
      resourceId, 
      ...details, 
      audit: true 
    });
  }

  performance(operation: string, duration: number, details: Record<string, unknown> = {}): void {
    this.info(`[PERFORMANCE] ${operation}`, { 
      operation, 
      duration, 
      ...details, 
      performance: true 
    });
  }
}

// Create singleton instance
const loggerInstance = new Logger();

export default loggerInstance;
