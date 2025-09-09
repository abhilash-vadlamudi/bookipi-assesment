import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import config from '../config';
import logger from '../utils/logger';
import { DatabaseTransaction } from '../types';

export class Database implements DatabaseTransaction {
  private db!: sqlite3.Database;
  private static instance: Database;

  private constructor() {
    this.initializeDatabase();
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  private initializeDatabase(): void {
    try {
      // Ensure data directory exists
      const dbPath = path.resolve(config.database.path);
      const dataDir = path.dirname(dbPath);
      
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        logger.info('Created database directory', { path: dataDir });
      }

      // Create database connection
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          logger.error('Failed to connect to database', { error: err.message, path: dbPath });
          throw err;
        }
        logger.info('Connected to SQLite database', { path: dbPath });
      });

      // Configure database settings
      this.configureDatabase();
      
      // Create tables
      this.createTables();
      
    } catch (error) {
      logger.error('Database initialization failed', { error });
      throw new Error('Database initialization failed');
    }
  }

  private configureDatabase(): void {
    // Enable foreign keys
    this.db.run('PRAGMA foreign_keys = ON');
    
    // Enable WAL mode for better concurrency (except in test environment)
    if (config.database.enableWAL) {
      this.db.run('PRAGMA journal_mode = WAL');
    }
    
    // Set busy timeout
    this.db.run(`PRAGMA busy_timeout = ${config.database.busyTimeout}`);
    
    // Optimize for performance
    this.db.run('PRAGMA synchronous = NORMAL');
    this.db.run('PRAGMA cache_size = 10000');
    this.db.run('PRAGMA temp_store = memory');
    
    logger.debug('Database configuration applied');
  }

  private createTables(): void {
    const tables = [
      // Users table for authentication
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        is_active BOOLEAN DEFAULT 1,
        timezone TEXT DEFAULT 'UTC',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until DATETIME
      )`,

      // Flash sales table
      `CREATE TABLE IF NOT EXISTS flash_sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`,

      // Products table
      `CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL CHECK (price > 0),
        total_quantity INTEGER NOT NULL CHECK (total_quantity > 0),
        available_quantity INTEGER NOT NULL CHECK (available_quantity >= 0),
        flash_sale_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (flash_sale_id) REFERENCES flash_sales(id) ON DELETE CASCADE,
        CHECK (available_quantity <= total_quantity)
      )`,

      // Purchases table
      `CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        product_id INTEGER NOT NULL,
        flash_sale_id INTEGER NOT NULL,
        quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
        purchase_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled', 'pending')),
        transaction_id TEXT UNIQUE,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (flash_sale_id) REFERENCES flash_sales(id),
        UNIQUE(user_id, flash_sale_id)
      )`,

      // Audit log table for security tracking
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        resource_id TEXT,
        details TEXT, -- JSON string
        ip_address TEXT,
        user_agent TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,

      // API keys table for advanced authentication
      `CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_hash TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        permissions TEXT, -- JSON array of permissions
        is_active BOOLEAN DEFAULT 1,
        expires_at DATETIME,
        last_used DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`
    ];

    tables.forEach((sql, index) => {
      this.db.run(sql, (err) => {
        if (err) {
          logger.error(`Failed to create table ${index + 1}`, { error: err.message, sql });
          throw err;
        }
      });
    });

    this.createIndexes();
    logger.info('Database tables created successfully');
  }

  private createIndexes(): void {
    const indexes = [
      // Performance indexes
      'CREATE INDEX IF NOT EXISTS idx_flash_sales_active ON flash_sales(is_active, start_time, end_time)',
      'CREATE INDEX IF NOT EXISTS idx_flash_sales_dates ON flash_sales(start_time, end_time)',
      'CREATE INDEX IF NOT EXISTS idx_products_flash_sale ON products(flash_sale_id)',
      'CREATE INDEX IF NOT EXISTS idx_products_availability ON products(flash_sale_id, available_quantity)',
      'CREATE INDEX IF NOT EXISTS idx_purchases_user_sale ON purchases(user_id, flash_sale_id)',
      'CREATE INDEX IF NOT EXISTS idx_purchases_product ON purchases(product_id)',
      'CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status)',
      
      // Security indexes
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)',
      'CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id, is_active)'
    ];

    indexes.forEach((sql) => {
      this.db.run(sql, (err) => {
        if (err) {
          logger.error('Failed to create index', { error: err.message, sql });
        }
      });
    });

    logger.debug('Database indexes created');
  }

  // Promisified database operations
  public run(sql: string, params: unknown[] = []): Promise<{ id: number; changes: number }> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          logger.error('Database run operation failed', { error: err.message, sql, params });
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  public get(sql: string, params: unknown[] = []): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          logger.error('Database get operation failed', { error: err.message, sql, params });
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  public all(sql: string, params: unknown[] = []): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Database all operation failed', { error: err.message, sql, params });
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  // Transaction support
  public beginTransaction(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          logger.error('Failed to begin transaction', { error: err.message });
          reject(err);
        } else {
          logger.debug('Transaction started');
          resolve();
        }
      });
    });
  }

  public commit(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run('COMMIT', (err) => {
        if (err) {
          logger.error('Failed to commit transaction', { error: err.message });
          reject(err);
        } else {
          logger.debug('Transaction committed');
          resolve();
        }
      });
    });
  }

  public rollback(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run('ROLLBACK', (err) => {
        if (err) {
          logger.error('Failed to rollback transaction', { error: err.message });
          reject(err);
        } else {
          logger.debug('Transaction rolled back');
          resolve();
        }
      });
    });
  }

  // Health check
  public async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: string }> {
    try {
      await this.get('SELECT 1 as test');
      return { status: 'healthy' };
    } catch (error) {
      logger.error('Database health check failed', { error });
      return { 
        status: 'unhealthy', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Close database connection
  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          logger.error('Failed to close database', { error: err.message });
          reject(err);
        } else {
          logger.info('Database connection closed');
          resolve();
        }
      });
    });
  }

  // Get raw database instance (use with caution)
  public getRawDb(): sqlite3.Database {
    return this.db;
  }
}

// Export singleton instance
export const database = Database.getInstance();
export default database;
