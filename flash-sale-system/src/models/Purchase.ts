import { Database } from './database';
import logger from '../utils/logger';
import { Purchase, PurchaseWithDetails, ApiResponse, ApiErrorResponse } from '../types';

export class PurchaseModel {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  /**
   * Attempts to purchase a product atomically
   * Ensures one item per user per flash sale
   */
  async attemptPurchase(
    userId: string,
    flashSaleId: number,
    productId: number,
    quantity: number = 1
  ): Promise<ApiResponse<Purchase> | ApiErrorResponse> {
    const startTime = Date.now();
    
    try {
      // Begin transaction for atomic purchase
      await this.db.run('BEGIN TRANSACTION');

      // Check if user has already purchased in this flash sale
      const existingPurchase = await this.db.get(
        `SELECT id FROM purchases 
         WHERE user_id = ? AND flash_sale_id = ? AND status = 'completed'`,
        [userId, flashSaleId]
      );

      if (existingPurchase) {
        await this.db.run('ROLLBACK');
        return {
          success: false,
          message: 'User has already purchased in this flash sale',
          statusCode: 409,
          timestamp: new Date().toISOString()
        };
      }

      // Check if flash sale is active
      const flashSale = await this.db.get(
        `SELECT id, start_time, end_time
         FROM flash_sales 
         WHERE id = ? AND datetime('now') BETWEEN start_time AND end_time`,
        [flashSaleId]
      );

      if (!flashSale) {
        await this.db.run('ROLLBACK');
        return {
          success: false,
          message: 'Flash sale is not active',
          statusCode: 404,
          timestamp: new Date().toISOString()
        };
      }

      // Check product availability in flash sale
      const product = await this.db.get(
        `SELECT p.id, p.name, p.price, p.available_quantity, p.total_quantity
         FROM products p
         WHERE p.flash_sale_id = ? AND p.id = ? AND p.available_quantity >= ?`,
        [flashSaleId, productId, quantity]
      );

      if (!product) {
        await this.db.run('ROLLBACK');
        return {
          success: false,
          message: 'Product not available or insufficient stock',
          statusCode: 404,
          timestamp: new Date().toISOString()
        };
      }

      // Reserve stock by decrementing available quantity
      const stockUpdate = await this.db.run(
        `UPDATE products 
         SET available_quantity = available_quantity - ?,
             updated_at = datetime('now')
         WHERE id = ? AND flash_sale_id = ? AND available_quantity >= ?`,
        [quantity, productId, flashSaleId, quantity]
      );

      if (stockUpdate.changes === 0) {
        await this.db.run('ROLLBACK');
        return {
          success: false,
          message: 'Product sold out during purchase attempt',
          statusCode: 409,
          timestamp: new Date().toISOString()
        };
      }

      // Create purchase record
      const purchaseResult = await this.db.run(
        `INSERT INTO purchases (
          user_id, flash_sale_id, product_id, quantity, purchase_time, status
        ) VALUES (?, ?, ?, ?, datetime('now'), 'completed')`,
        [userId, flashSaleId, productId, quantity]
      );

      // Commit transaction
      await this.db.run('COMMIT');

      // Get the created purchase
      const createdPurchase = await this.db.get(
        `SELECT * FROM purchases WHERE id = ?`,
        [purchaseResult.id]
      );

      // Log successful purchase
      logger.info('Purchase completed successfully', {
        purchaseId: purchaseResult.id,
        userId,
        flashSaleId,
        productId,
        quantity,
        duration: Date.now() - startTime
      });

      // Audit log for purchase
      await this.db.run(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details)
         VALUES (?, 'purchase_completed', 'purchase', ?, ?)`,
        [userId, purchaseResult.id, JSON.stringify({
          flashSaleId,
          productId,
          quantity
        })]
      );

      return {
        success: true,
        data: createdPurchase as Purchase,
        message: 'Purchase completed successfully',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      // Rollback on any error
      try {
        await this.db.run('ROLLBACK');
      } catch (rollbackError) {
        logger.error('Transaction rollback failed', { error: rollbackError });
      }

      logger.error('Purchase attempt failed', {
        error,
        userId,
        flashSaleId,
        productId,
        quantity,
        duration: Date.now() - startTime
      });

      return {
        success: false,
        message: 'Purchase failed due to server error',
        statusCode: 500,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get purchase by ID
   */
  async getById(id: number): Promise<ApiResponse<PurchaseWithDetails> | ApiErrorResponse> {
    try {
      const purchase = await this.db.get(
        `SELECT p.*, pr.name as product_name, pr.price as product_price, 
                fs.name as flash_sale_name
         FROM purchases p
         JOIN products pr ON p.product_id = pr.id
         JOIN flash_sales fs ON p.flash_sale_id = fs.id
         WHERE p.id = ?`,
        [id]
      );

      if (!purchase) {
        return {
          success: false,
          message: 'Purchase not found',
          statusCode: 404,
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        data: purchase as PurchaseWithDetails,
        message: 'Purchase retrieved successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error fetching purchase', { error, id });
      return {
        success: false,
        message: 'Failed to fetch purchase',
        statusCode: 500,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get purchases by user ID
   */
  async getByUserId(userId: string, limit: number = 50, offset: number = 0): Promise<ApiResponse<PurchaseWithDetails[]> | ApiErrorResponse> {
    try {
      const purchases = await this.db.all(
        `SELECT p.*, pr.name as product_name, pr.price as product_price,
                fs.name as flash_sale_name, (p.quantity * pr.price) as total_amount
         FROM purchases p
         JOIN products pr ON p.product_id = pr.id
         JOIN flash_sales fs ON p.flash_sale_id = fs.id
         WHERE p.user_id = ?
         ORDER BY p.purchase_time DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      );

      return {
        success: true,
        data: purchases as PurchaseWithDetails[],
        message: 'Purchases retrieved successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error fetching user purchases', { error, userId });
      return {
        success: false,
        message: 'Failed to fetch purchases',
        statusCode: 500,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get purchases by flash sale ID (admin only)
   */
  async getByFlashSaleId(flashSaleId: number, limit: number = 100, offset: number = 0): Promise<ApiResponse<PurchaseWithDetails[]> | ApiErrorResponse> {
    try {
      const purchases = await this.db.all(
        `SELECT p.*, u.email as user_email, pr.name as product_name, 
                pr.price as product_price, fs.name as flash_sale_name
         FROM purchases p
         JOIN users u ON p.user_id = u.id
         JOIN products pr ON p.product_id = pr.id
         JOIN flash_sales fs ON p.flash_sale_id = fs.id
         WHERE p.flash_sale_id = ?
         ORDER BY p.purchase_time DESC
         LIMIT ? OFFSET ?`,
        [flashSaleId, limit, offset]
      );

      return {
        success: true,
        data: purchases as PurchaseWithDetails[],
        message: 'Flash sale purchases retrieved successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error fetching flash sale purchases', { error, flashSaleId });
      return {
        success: false,
        message: 'Failed to fetch purchases',
        statusCode: 500,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get purchase statistics for a flash sale
   */
  async getFlashSaleStatistics(flashSaleId: number): Promise<ApiResponse<{
    totalPurchases: number;
    totalRevenue: number;
    uniqueCustomers: number;
  }> | ApiErrorResponse> {
    try {
      const stats = await this.db.get(
        `SELECT 
           COUNT(*) as total_purchases,
           COUNT(DISTINCT user_id) as unique_customers
         FROM purchases 
         WHERE flash_sale_id = ? AND status = 'completed'`,
        [flashSaleId]
      );

      const result = {
        totalPurchases: (stats as any)?.total_purchases || 0,
        totalRevenue: 0, // Would need to calculate from product prices
        uniqueCustomers: (stats as any)?.unique_customers || 0
      };

      return {
        success: true,
        data: result,
        message: 'Statistics retrieved successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error fetching purchase statistics', { error, flashSaleId });
      return {
        success: false,
        message: 'Failed to fetch statistics',
        statusCode: 500,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check if user has already purchased in a flash sale
   */
  async hasUserPurchased(userId: string, flashSaleId: number): Promise<boolean> {
    try {
      const purchase = await this.db.get(
        `SELECT id FROM purchases 
         WHERE user_id = ? AND flash_sale_id = ? AND status = 'completed'`,
        [userId, flashSaleId]
      );

      return !!purchase;
    } catch (error) {
      logger.error('Error checking user purchase status', { error, userId, flashSaleId });
      return false;
    }
  }
}

export default PurchaseModel;
