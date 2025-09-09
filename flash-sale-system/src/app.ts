import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import middleware from './middleware';
import config from './config';
import { Database } from './models/database';
import logger from './utils/logger';

// Import routes
import flashSaleRoutes from './routes/flashSale';
import authRoutes from './routes/auth';

class FlashSaleApp {
  private app: Application;
  private port: number;
  private db: Database;

  constructor() {
    this.app = express();
    this.port = config.port;
    this.db = Database.getInstance();
    this.initializeDatabase();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // Database is initialized through singleton pattern
      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database:', { error: error instanceof Error ? error.message : 'Unknown error' });
      process.exit(1);
    }
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    this.app.use(cors({
      origin: config.cors.origins,
      credentials: config.cors.credentials,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Custom middleware
    this.app.use(middleware.healthCheck);
    this.app.use(middleware.requestMetadata);
    this.app.use(middleware.requestLogger);
    this.app.use(middleware.securityHeaders);
    this.app.use(middleware.hppProtection);
    this.app.use(middleware.sanitizeData);

    // Rate limiting
    this.app.use('/api', middleware.apiRateLimit);
    this.app.use('/api/auth', middleware.authRateLimit);
    this.app.use('/api/flash-sale/purchase', middleware.purchaseRateLimit);
  }

  private initializeRoutes(): void {
    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/flash-sales', flashSaleRoutes);

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'Flash Sale System API',
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          auth: {
            register: 'POST /api/auth/register',
            login: 'POST /api/auth/login',
            profile: 'GET /api/auth/profile',
            logout: 'POST /api/auth/logout'
          },
          flashSale: {
            status: 'GET /api/flash-sale/status',
            purchase: 'POST /api/flash-sale/purchase',
            userStatus: 'GET /api/flash-sale/user/:userId/purchase',
            userHistory: 'GET /api/flash-sale/user/:userId/history'
          },
          admin: {
            createFlashSale: 'POST /api/flash-sale/admin/create',
            flashSaleStats: 'GET /api/flash-sale/admin/:flashSaleId/stats'
          }
        }
      });
    });

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        statusCode: 404,
        timestamp: new Date().toISOString(),
        path: req.originalUrl
      });
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(middleware.errorHandler);
  }

  public start(): void {
    this.app.listen(this.port, () => {
      logger.info(`Flash Sale System running on port ${this.port}`, {
        environment: config.nodeEnv,
        port: this.port,
        endpoints: {
          health: `http://localhost:${this.port}/health`,
          api: `http://localhost:${this.port}/`,
          docs: `http://localhost:${this.port}/`
        }
      });
    });
  }

  public getApp(): Application {
    return this.app;
  }

  public async close(): Promise<void> {
    try {
      await this.db.close();
      logger.info('Application closed gracefully');
    } catch (error) {
      logger.error('Error closing application:', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
}

export default FlashSaleApp;
