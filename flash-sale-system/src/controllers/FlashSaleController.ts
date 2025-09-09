import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { FlashSaleModel } from '../models/FlashSale';
import { ProductModel } from '../models/Product';
import { PurchaseModel } from '../models/Purchase';
import { UserModel } from '../models/User';
import logger from '../utils/logger';
import TimezoneUtils from '../utils/timezone';
import { ApiResponse, ApiErrorResponse, CreateFlashSaleRequest, PurchaseRequest } from '../types';

export class FlashSaleController {
  private flashSaleModel: FlashSaleModel;
  private productModel: ProductModel;
  private purchaseModel: PurchaseModel;
  private userModel: UserModel;

  constructor() {
    this.flashSaleModel = new FlashSaleModel();
    this.productModel = new ProductModel();
    this.purchaseModel = new PurchaseModel();
    this.userModel = new UserModel();
  }

  /**
   * Convert flash sale times to user's timezone
   */
  private async convertFlashSaleTimesToUserTimezone(flashSales: any[], userId?: string): Promise<any[]> {
    let userTimezone = 'UTC';
    
    // Get user's timezone if authenticated
    if (userId) {
      try {
        const user = await this.userModel.findById(userId);
        userTimezone = user?.timezone || 'UTC';
      } catch (error) {
        logger.warn('Could not get user timezone, using UTC', { userId, error });
      }
    }
    
    // Convert times for each flash sale
    return flashSales.map(flashSale => ({
      ...flashSale,
      start_time_local: TimezoneUtils.formatTimeForUser(flashSale.start_time, userTimezone),
      end_time_local: TimezoneUtils.formatTimeForUser(flashSale.end_time, userTimezone),
      user_timezone: userTimezone,
      // Keep original UTC times for calculations
      start_time: flashSale.start_time,
      end_time: flashSale.end_time
    }));
  }

  /**
   * Get all flash sales
   */
  async getAllFlashSales(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.flashSaleModel.findAll({});
      
      // Convert times to user's timezone if authenticated
      const userId = req.user?.userId;
      const flashSalesWithTimezone = await this.convertFlashSaleTimesToUserTimezone(result.flashSales, userId);
      
      const successResponse: ApiResponse<typeof result> = {
        success: true,
        data: {
          flashSales: flashSalesWithTimezone,
          total: result.total
        },
        message: 'Flash sales retrieved successfully',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(successResponse);
    } catch (error) {
      logger.error('Error getting all flash sales:', { error });

      const errorResponse: ApiErrorResponse = {
        success: false,
        message: 'Failed to get flash sales',
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Get active flash sales
   */
  async getActiveFlashSales(req: Request, res: Response): Promise<void> {
    try {
      const activeFlashSales = await this.flashSaleModel.findAllActive();
      
      // Convert times to user's timezone if authenticated
      const userId = req.user?.userId;
      const flashSalesWithTimezone = await this.convertFlashSaleTimesToUserTimezone(activeFlashSales, userId);
      
      const successResponse: ApiResponse<typeof flashSalesWithTimezone> = {
        success: true,
        data: flashSalesWithTimezone,
        message: 'Active flash sales retrieved successfully',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(successResponse);
    } catch (error) {
      logger.error('Error getting active flash sales:', { error });

      const errorResponse: ApiErrorResponse = {
        success: false,
        message: 'Failed to get active flash sales',
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Get flash sale by ID
   */
  async getFlashSaleById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'Flash sale ID is required',
          error: 'Missing flash sale ID parameter',
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      const flashSaleId = parseInt(id);
      if (isNaN(flashSaleId)) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'Invalid flash sale ID',
          error: 'Flash sale ID must be a valid number',
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      const flashSale = await this.flashSaleModel.findById(flashSaleId);
      
      if (!flashSale) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'Flash sale not found',
          error: 'Flash sale with the specified ID does not exist',
          statusCode: 404,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(404).json(errorResponse);
        return;
      }

      const successResponse: ApiResponse<typeof flashSale> = {
        success: true,
        data: flashSale,
        message: 'Flash sale retrieved successfully',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(successResponse);
    } catch (error) {
      logger.error('Error getting flash sale by ID:', { error, id: req.params.id });

      const errorResponse: ApiErrorResponse = {
        success: false,
        message: 'Failed to get flash sale',
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Get current flash sale status
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = await this.flashSaleModel.getCurrentStatus();
      
      const successResponse: ApiResponse<typeof status> = {
        success: true,
        data: status,
        message: 'Flash sale status retrieved successfully',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(successResponse);
    } catch (error) {
      logger.error('Error getting flash sale status:', { error });

      const errorResponse: ApiErrorResponse = {
        success: false,
        message: 'Failed to get flash sale status',
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Attempt to purchase an item
   */
  async attemptPurchase(req: Request, res: Response): Promise<void> {
    const requestStartTime = Date.now();
    
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

      const { productId, flashSaleId }: PurchaseRequest = req.body;
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

      let targetFlashSaleId = flashSaleId;
      
      // If no flashSaleId provided, use the current active flash sale
      if (!targetFlashSaleId) {
        const flashSaleStatus = await this.flashSaleModel.getCurrentStatus();
        if (flashSaleStatus.status !== 'active' || !flashSaleStatus.flashSale) {
          const errorResponse: ApiErrorResponse = {
            success: false,
            message: 'No active flash sale and no flashSaleId provided',
            statusCode: 400,
            timestamp: new Date().toISOString(),
            path: req.path
          };
          res.status(400).json(errorResponse);
          return;
        }
        targetFlashSaleId = flashSaleStatus.flashSale.id;
      }

      // Verify the specified flash sale exists and is active
      const flashSale = await this.flashSaleModel.findById(targetFlashSaleId);
      if (!flashSale) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'Flash sale not found',
          statusCode: 404,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(404).json(errorResponse);
        return;
      }

      // Check if the flash sale is currently active
      // Convert stored UTC times to Date objects for comparison
      const now = new Date();
      const startTime = new Date(flashSale.start_time + 'Z'); // Add 'Z' to indicate UTC
      const endTime = new Date(flashSale.end_time + 'Z');     // Add 'Z' to indicate UTC
      
      if (now < startTime || now > endTime || !flashSale.is_active) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'Flash sale is not currently active',
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }
      let targetProductId = productId;

      // If no productId provided, get the product for this flash sale
      if (!targetProductId) {
        const productModel = new ProductModel();
        const products = await productModel.findByFlashSaleId(targetFlashSaleId);
        
        if (!products || products.length === 0) {
          const errorResponse: ApiErrorResponse = {
            success: false,
            message: 'No products available for this flash sale',
            statusCode: 400,
            timestamp: new Date().toISOString(),
            path: req.path
          };
          res.status(400).json(errorResponse);
          return;
        }
        
        // Use the first (and should be only) product
        const firstProduct = products[0];
        if (firstProduct) {
          targetProductId = firstProduct.id;
        } else {
          const errorResponse: ApiErrorResponse = {
            success: false,
            message: 'No valid products found for this flash sale',
            statusCode: 400,
            timestamp: new Date().toISOString(),
            path: req.path
          };
          res.status(400).json(errorResponse);
          return;
        }
      }

      // Attempt purchase
      const result = await this.purchaseModel.attemptPurchase(
        userId,
        targetFlashSaleId,
        targetProductId,
        1
      );

      if (!result.success) {
        res.status((result as ApiErrorResponse).statusCode || 400).json(result);
        return;
      }

      logger.info('Purchase attempt completed', {
        userId,
        flashSaleId: targetFlashSaleId,
        productId: targetProductId,
        duration: Date.now() - requestStartTime
      });

      res.status(200).json(result);

    } catch (error) {
      logger.error('Error attempting purchase:', {
        error,
        userId: req.body?.userId,
        duration: Date.now() - requestStartTime
      });

      const errorResponse: ApiErrorResponse = {
        success: false,
        message: 'Purchase failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Check user's purchase status
   */
  async getUserPurchaseStatus(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'User ID is required',
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      // Get current flash sale
      const flashSaleStatus = await this.flashSaleModel.getCurrentStatus();
      
      let hasPurchased = false;
      if (flashSaleStatus.status === 'active' && flashSaleStatus.flashSale) {
        hasPurchased = await this.purchaseModel.hasUserPurchased(
          userId,
          flashSaleStatus.flashSale.id
        );
      }

      const successResponse: ApiResponse<{
        userId: string;
        flashSaleStatus: string;
        hasPurchased: boolean;
        flashSale: typeof flashSaleStatus.flashSale;
      }> = {
        success: true,
        data: {
          userId,
          flashSaleStatus: flashSaleStatus.status,
          hasPurchased,
          flashSale: flashSaleStatus.flashSale
        },
        message: 'User purchase status retrieved successfully',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(successResponse);

    } catch (error) {
      logger.error('Error getting user purchase status:', { error, userId: req.params.userId });

      const errorResponse: ApiErrorResponse = {
        success: false,
        message: 'Failed to get user purchase status',
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Get user's purchase history
   */
  async getUserPurchaseHistory(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      if (!userId) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'User ID is required',
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      // Get user's timezone for timestamp conversion
      const user = await this.userModel.findById(userId);
      const userTimezone = user?.timezone || 'UTC';

      const result = await this.purchaseModel.getByUserId(userId, limit, offset);

      if (!result.success) {
        res.status((result as ApiErrorResponse).statusCode || 500).json(result);
        return;
      }

      const purchases = result.data || [];

      // Convert timestamps to user timezone
      const purchasesWithUserTime = purchases.map(purchase => ({
        ...purchase,
        created_at: purchase.created_at ? TimezoneUtils.convertUTCToUserTimezone(purchase.created_at, userTimezone) : undefined,
        updated_at: purchase.updated_at ? TimezoneUtils.convertUTCToUserTimezone(purchase.updated_at, userTimezone) : undefined
      }));

      const successResponse: ApiResponse<{
        userId: string;
        purchases: typeof purchasesWithUserTime;
        totalPurchases: number;
        limit: number;
        offset: number;
      }> = {
        success: true,
        data: {
          userId,
          purchases: purchasesWithUserTime,
          totalPurchases: purchases.length,
          limit,
          offset
        },
        message: 'User purchase history retrieved successfully',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(successResponse);

    } catch (error) {
      logger.error('Error getting user purchase history:', { error, userId: req.params.userId });

      const errorResponse: ApiErrorResponse = {
        success: false,
        message: 'Failed to get user purchase history',
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Check if user has purchased in a specific flash sale
   */
  async getUserFlashSalePurchaseStatus(req: Request, res: Response): Promise<void> {
    try {
      const { userId, flashSaleId } = req.params;

      if (!userId || !flashSaleId) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'User ID and Flash Sale ID are required',
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      const hasPurchased = await this.purchaseModel.hasUserPurchased(
        userId,
        parseInt(flashSaleId)
      );

      const successResponse: ApiResponse<{
        userId: string;
        flashSaleId: number;
        hasPurchased: boolean;
      }> = {
        success: true,
        data: {
          userId,
          flashSaleId: parseInt(flashSaleId),
          hasPurchased
        },
        message: 'User flash sale purchase status retrieved successfully',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(successResponse);

    } catch (error) {
      logger.error('Error getting user flash sale purchase status:', { error, userId: req.params.userId, flashSaleId: req.params.flashSaleId });

      const errorResponse: ApiErrorResponse = {
        success: false,
        message: 'Failed to get user flash sale purchase status',
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Get flash sale statistics (admin endpoint)
   */
  async getFlashSaleStats(req: Request, res: Response): Promise<void> {
    try {
      const { flashSaleId } = req.params;

      if (!flashSaleId) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'Flash Sale ID is required',
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      const flashSaleIdNum = parseInt(flashSaleId);
      if (isNaN(flashSaleIdNum)) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'Invalid Flash Sale ID',
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      // For now, get flash sale by ID using a simple approach
      // This would be properly implemented when getById is available
      const flashSale = { id: flashSaleIdNum, name: 'Flash Sale', status: 'active' };

      const statsResult = await this.purchaseModel.getFlashSaleStatistics(flashSaleIdNum);
      if (!statsResult.success) {
        res.status((statsResult as ApiErrorResponse).statusCode || 500).json(statsResult);
        return;
      }

      const successResponse: ApiResponse<{
        flashSale: typeof flashSale;
        stats: typeof statsResult.data;
      }> = {
        success: true,
        data: {
          flashSale: flashSale,
          stats: statsResult.data
        },
        message: 'Flash sale statistics retrieved successfully',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(successResponse);

    } catch (error) {
      logger.error('Error getting flash sale stats:', { error, flashSaleId: req.params.flashSaleId });

      const errorResponse: ApiErrorResponse = {
        success: false,
        message: 'Failed to get flash sale statistics',
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Create a new flash sale (admin endpoint)
   */
  async createFlashSale(req: Request, res: Response): Promise<void> {
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

      const { name, startTime: flashSaleStartTime, endTime, products }: CreateFlashSaleRequest = req.body;

      // Validate that end time is after start time
      if (new Date(endTime) <= new Date(flashSaleStartTime)) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'End time must be after start time',
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      // Create flash sale
      const flashSale = await this.flashSaleModel.create({
        name,
        startTime: flashSaleStartTime,
        endTime
      });

      // Create the single product for the flash sale
      if (products && products.length > 0) {
        const productModel = new ProductModel();
        // Only use the first product, ignore others
        const productData = products[0];
        if (productData) {
          const productCreateData: any = {
            name: productData.name,
            price: productData.price,
            totalQuantity: productData.totalQuantity || productData.quantity, // Support both field names
            flashSaleId: flashSale.id
          };
          
          if (productData.description) {
            productCreateData.description = productData.description;
          }
          
          await productModel.create(productCreateData);
        }
      }

      logger.info('Flash sale created successfully', {
        flashSaleId: flashSale.id,
        name,
        duration: Date.now() - startTime
      });

      const successResponse: ApiResponse<typeof flashSale> = {
        success: true,
        data: flashSale,
        message: 'Flash sale created successfully',
        timestamp: new Date().toISOString()
      };

      res.status(201).json(successResponse);

    } catch (error) {
      logger.error('Error creating flash sale:', {
        error,
        duration: Date.now() - startTime
      });

      const errorResponse: ApiErrorResponse = {
        success: false,
        message: 'Failed to create flash sale',
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Update a flash sale (admin endpoint)
   */
  async updateFlashSale(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { id } = req.params;
      
      if (!id) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'Flash sale ID is required',
          error: 'Missing flash sale ID parameter',
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      const flashSaleId = parseInt(id);
      if (isNaN(flashSaleId)) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'Invalid flash sale ID',
          error: 'Flash sale ID must be a valid number',
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      // Check if flash sale exists
      const existingFlashSale = await this.flashSaleModel.findById(flashSaleId);
      if (!existingFlashSale) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'Flash sale not found',
          error: 'Flash sale with the specified ID does not exist',
          statusCode: 404,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(404).json(errorResponse);
        return;
      }

      const { name, startTime: flashSaleStartTime, endTime } = req.body;

      // Validate that end time is after start time if both are provided
      if (flashSaleStartTime && endTime && new Date(endTime) <= new Date(flashSaleStartTime)) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'End time must be after start time',
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      // Update flash sale
      const updatedFlashSale = await this.flashSaleModel.update(flashSaleId, {
        name: name || existingFlashSale.name,
        startTime: flashSaleStartTime || existingFlashSale.start_time,
        endTime: endTime || existingFlashSale.end_time
      });

      logger.info('Flash sale updated successfully', {
        flashSaleId,
        name,
        duration: Date.now() - startTime
      });

      const successResponse: ApiResponse<typeof updatedFlashSale> = {
        success: true,
        data: updatedFlashSale,
        message: 'Flash sale updated successfully',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(successResponse);

    } catch (error) {
      logger.error('Error updating flash sale:', {
        error,
        id: req.params.id,
        duration: Date.now() - startTime
      });

      const errorResponse: ApiErrorResponse = {
        success: false,
        message: 'Failed to update flash sale',
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Delete a flash sale (admin endpoint)
   */
  async deleteFlashSale(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { id } = req.params;
      
      if (!id) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'Flash sale ID is required',
          error: 'Missing flash sale ID parameter',
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      const flashSaleId = parseInt(id);
      if (isNaN(flashSaleId)) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'Invalid flash sale ID',
          error: 'Flash sale ID must be a valid number',
          statusCode: 400,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      // Check if flash sale exists
      const existingFlashSale = await this.flashSaleModel.findById(flashSaleId);
      if (!existingFlashSale) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'Flash sale not found',
          error: 'Flash sale with the specified ID does not exist',
          statusCode: 404,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(404).json(errorResponse);
        return;
      }

      // Delete flash sale
      await this.flashSaleModel.delete(flashSaleId);

      logger.info('Flash sale deleted successfully', {
        flashSaleId,
        duration: Date.now() - startTime
      });

      const successResponse: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: 'Flash sale deleted successfully' },
        message: 'Flash sale deleted successfully',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(successResponse);

    } catch (error) {
      logger.error('Error deleting flash sale:', {
        error,
        id: req.params.id,
        duration: Date.now() - startTime
      });

      const errorResponse: ApiErrorResponse = {
        success: false,
        message: 'Failed to delete flash sale',
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }
}

export default FlashSaleController;
