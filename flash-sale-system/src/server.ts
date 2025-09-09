#!/usr/bin/env node

/**
 * Flash Sale System Server Entry Point
 * 
 * This file initializes and starts the Flash Sale System server.
 * It handles graceful shutdown and error handling.
 */

import FlashSaleApp from './app';
import logger from './utils/logger';
import config from './config';

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error('Unhandled Rejection:', {
    reason: reason instanceof Error ? reason.message : String(reason),
    promise: String(promise),
    timestamp: new Date().toISOString()
  });
  process.exit(1);
});

// Initialize and start the application
const app = new FlashSaleApp();

// Graceful shutdown handling
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    await app.close();
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server
try {
  app.start();
  
  logger.info('Flash Sale System started successfully', {
    environment: config.nodeEnv,
    port: config.port,
    timestamp: new Date().toISOString()
  });
} catch (error) {
  logger.error('Failed to start Flash Sale System:', {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
}

export default app;
