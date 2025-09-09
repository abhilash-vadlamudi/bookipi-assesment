import { PurchaseModel } from '../../models/Purchase';
import { Database } from '../../models/database';
import logger from '../../utils/logger';

// Mock dependencies
jest.mock('../../models/database');
jest.mock('../../utils/logger');

describe('PurchaseModel', () => {
  let purchaseModel: PurchaseModel;
  let mockDatabase: jest.Mocked<Database>;

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
    
    purchaseModel = new PurchaseModel();
  });

  describe('attemptPurchase', () => {
    const purchaseData = {
      userId: 'user123',
      flashSaleId: 1,
      productId: 1,
      quantity: 1
    };

    beforeEach(() => {
      // Setup default successful scenario
      mockDatabase.get
        .mockResolvedValueOnce(null) // No existing purchase
        .mockResolvedValueOnce({ // Active flash sale
          id: 1,
          start_time: '2023-01-01 10:00:00',
          end_time: '2023-01-01 11:00:00'
        })
        .mockResolvedValueOnce({ // Available product
          id: 1,
          name: 'Test Product',
          price: 99.99,
          available_quantity: 10,
          total_quantity: 50
        })
        .mockResolvedValueOnce({ // Created purchase
          id: 1,
          user_id: 'user123',
          flash_sale_id: 1,
          product_id: 1,
          quantity: 1,
          purchase_time: '2023-01-01 10:30:00',
          status: 'completed'
        });

      mockDatabase.run
        .mockResolvedValueOnce({} as any) // BEGIN TRANSACTION
        .mockResolvedValueOnce({ changes: 1 } as any) // Stock update
        .mockResolvedValueOnce({ id: 1, changes: 1 } as any) // Purchase creation
        .mockResolvedValueOnce({} as any) // COMMIT
        .mockResolvedValueOnce({ changes: 1 } as any); // Audit log
    });

    it('should complete purchase successfully', async () => {
      const result = await purchaseModel.attemptPurchase(
        purchaseData.userId,
        purchaseData.flashSaleId,
        purchaseData.productId,
        purchaseData.quantity
      );

      expect(mockDatabase.run).toHaveBeenCalledWith('BEGIN TRANSACTION');
      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE products'),
        [1, 1, 1, 1]
      );
      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO purchases'),
        ['user123', 1, 1, 1]
      );
      expect(mockDatabase.run).toHaveBeenCalledWith('COMMIT');

      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          id: 1,
          user_id: 'user123',
          flash_sale_id: 1,
          product_id: 1,
          quantity: 1,
          status: 'completed'
        }),
        message: 'Purchase completed successfully',
        timestamp: expect.any(String)
      });

      expect(logger.info).toHaveBeenCalledWith(
        'Purchase completed successfully',
        expect.objectContaining({
          purchaseId: 1,
          userId: 'user123',
          flashSaleId: 1,
          productId: 1,
          quantity: 1
        })
      );
    });

    it('should prevent duplicate purchases', async () => {
      // Clear previous mocks and setup specific scenario
      mockDatabase.get.mockReset();
      mockDatabase.run.mockReset();
      
      // Mock existing purchase (first call)
      mockDatabase.get.mockResolvedValueOnce({
        id: 1,
        user_id: 'user123',
        flash_sale_id: 1
      });
      
      // Mock transaction calls
      mockDatabase.run
        .mockResolvedValueOnce({} as any) // BEGIN TRANSACTION
        .mockResolvedValueOnce({} as any); // ROLLBACK

      const result = await purchaseModel.attemptPurchase(
        purchaseData.userId,
        purchaseData.flashSaleId,
        purchaseData.productId,
        purchaseData.quantity
      );

      expect(mockDatabase.run).toHaveBeenCalledWith('ROLLBACK');
      expect(result).toEqual({
        success: false,
        message: 'User has already purchased in this flash sale',
        statusCode: 409,
        timestamp: expect.any(String)
      });
    });

    it('should reject purchase for inactive flash sale', async () => {
      // Clear previous mocks and setup specific scenario
      mockDatabase.get.mockReset();
      mockDatabase.run.mockReset();
      
      mockDatabase.get
        .mockResolvedValueOnce(null) // No existing purchase
        .mockResolvedValueOnce(null); // No active flash sale
      
      // Mock transaction calls
      mockDatabase.run
        .mockResolvedValueOnce({} as any) // BEGIN TRANSACTION
        .mockResolvedValueOnce({} as any); // ROLLBACK

      const result = await purchaseModel.attemptPurchase(
        purchaseData.userId,
        purchaseData.flashSaleId,
        purchaseData.productId,
        purchaseData.quantity
      );

      expect(mockDatabase.run).toHaveBeenCalledWith('ROLLBACK');
      expect(result).toEqual({
        success: false,
        message: 'Flash sale is not active',
        statusCode: 404,
        timestamp: expect.any(String)
      });
    });

    it('should reject purchase for unavailable product', async () => {
      // Clear previous mocks and setup specific scenario
      mockDatabase.get.mockReset();
      mockDatabase.run.mockReset();
      
      mockDatabase.get
        .mockResolvedValueOnce(null) // No existing purchase
        .mockResolvedValueOnce({ // Active flash sale
          id: 1,
          start_time: '2023-01-01 10:00:00',
          end_time: '2023-01-01 11:00:00'
        })
        .mockResolvedValueOnce(null); // No available product
      
      // Mock transaction calls
      mockDatabase.run
        .mockResolvedValueOnce({} as any) // BEGIN TRANSACTION
        .mockResolvedValueOnce({} as any); // ROLLBACK

      const result = await purchaseModel.attemptPurchase(
        purchaseData.userId,
        purchaseData.flashSaleId,
        purchaseData.productId,
        purchaseData.quantity
      );

      expect(mockDatabase.run).toHaveBeenCalledWith('ROLLBACK');
      expect(result).toEqual({
        success: false,
        message: 'Product not available or insufficient stock',
        statusCode: 404,
        timestamp: expect.any(String)
      });
    });

    it('should handle race condition with stock depletion', async () => {
      // Clear previous mocks and setup specific scenario
      mockDatabase.get.mockReset();
      mockDatabase.run.mockReset();
      
      mockDatabase.get
        .mockResolvedValueOnce(null) // No existing purchase
        .mockResolvedValueOnce({ // Active flash sale
          id: 1,
          start_time: '2023-01-01 10:00:00',
          end_time: '2023-01-01 11:00:00'
        })
        .mockResolvedValueOnce({ // Available product
          id: 1,
          name: 'Test Product',
          price: 99.99,
          available_quantity: 1,
          total_quantity: 50
        });

      mockDatabase.run
        .mockResolvedValueOnce({} as any) // BEGIN TRANSACTION
        .mockResolvedValueOnce({ changes: 0 } as any) // Stock update fails (no changes)
        .mockResolvedValueOnce({} as any); // ROLLBACK

      const result = await purchaseModel.attemptPurchase(
        purchaseData.userId,
        purchaseData.flashSaleId,
        purchaseData.productId,
        purchaseData.quantity
      );

      expect(mockDatabase.run).toHaveBeenCalledWith('ROLLBACK');
      expect(result).toEqual({
        success: false,
        message: 'Product sold out during purchase attempt',
        statusCode: 409,
        timestamp: expect.any(String)
      });
    });

    it('should handle database errors with proper rollback', async () => {
      // Clear previous mocks and setup specific scenario
      mockDatabase.get.mockReset();
      mockDatabase.run.mockReset();
      
      const dbError = new Error('Database connection failed');
      
      mockDatabase.run
        .mockResolvedValueOnce({} as any) // BEGIN TRANSACTION
        .mockResolvedValueOnce({} as any); // ROLLBACK
      
      mockDatabase.get.mockRejectedValue(dbError);

      const result = await purchaseModel.attemptPurchase(
        purchaseData.userId,
        purchaseData.flashSaleId,
        purchaseData.productId,
        purchaseData.quantity
      );

      expect(mockDatabase.run).toHaveBeenCalledWith('ROLLBACK');
      expect(result).toEqual({
        success: false,
        message: 'Purchase failed due to server error',
        statusCode: 500,
        timestamp: expect.any(String)
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Purchase attempt failed',
        expect.objectContaining({
          error: dbError,
          userId: 'user123',
          flashSaleId: 1,
          productId: 1,
          quantity: 1
        })
      );
    });

    it('should handle rollback errors gracefully', async () => {
      // Clear previous mocks and setup specific scenario
      mockDatabase.get.mockReset();
      mockDatabase.run.mockReset();
      
      const dbError = new Error('Database connection failed');
      const rollbackError = new Error('Rollback failed');
      
      // First call to run is BEGIN TRANSACTION (succeeds)
      // Second call to run is ROLLBACK (fails)
      mockDatabase.run
        .mockResolvedValueOnce({} as any) // BEGIN TRANSACTION
        .mockRejectedValueOnce(rollbackError); // ROLLBACK fails
      
      mockDatabase.get.mockRejectedValue(dbError);

      const result = await purchaseModel.attemptPurchase(
        purchaseData.userId,
        purchaseData.flashSaleId,
        purchaseData.productId,
        purchaseData.quantity
      );

      expect(result.success).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Transaction rollback failed',
        { error: rollbackError }
      );
    });
  });

  describe('getById', () => {
    it('should return purchase with details when found', async () => {
      const mockPurchase = {
        id: 1,
        user_id: 'user123',
        flash_sale_id: 1,
        product_id: 1,
        quantity: 1,
        product_name: 'Test Product',
        product_price: 99.99,
        flash_sale_name: 'Test Flash Sale'
      };

      mockDatabase.get.mockResolvedValue(mockPurchase);

      const result = await purchaseModel.getById(1);

      expect(mockDatabase.get).toHaveBeenCalledWith(
        expect.stringContaining('JOIN products pr ON'),
        [1]
      );
      expect(result).toEqual({
        success: true,
        data: mockPurchase,
        message: 'Purchase retrieved successfully',
        timestamp: expect.any(String)
      });
    });

    it('should return error when purchase not found', async () => {
      mockDatabase.get.mockResolvedValue(null);

      const result = await purchaseModel.getById(999);

      expect(result).toEqual({
        success: false,
        message: 'Purchase not found',
        statusCode: 404,
        timestamp: expect.any(String)
      });
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database error');
      mockDatabase.get.mockRejectedValue(dbError);

      const result = await purchaseModel.getById(1);

      expect(result).toEqual({
        success: false,
        message: 'Failed to fetch purchase',
        statusCode: 500,
        timestamp: expect.any(String)
      });
      expect(logger.error).toHaveBeenCalledWith(
        'Error fetching purchase',
        { error: dbError, id: 1 }
      );
    });
  });

  describe('getByUserId', () => {
    it('should return user purchases successfully', async () => {
      const mockPurchases = [
        {
          id: 1,
          user_id: 'user123',
          product_name: 'Product 1',
          product_price: 99.99,
          quantity: 1,
          total_amount: 99.99
        },
        {
          id: 2,
          user_id: 'user123',
          product_name: 'Product 2',
          product_price: 149.99,
          quantity: 1,
          total_amount: 149.99
        }
      ];

      mockDatabase.all.mockResolvedValue(mockPurchases);

      const result = await purchaseModel.getByUserId('user123', 10, 0);

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE p.user_id = ?'),
        ['user123', 10, 0]
      );
      expect(result).toEqual({
        success: true,
        data: mockPurchases,
        message: 'Purchases retrieved successfully',
        timestamp: expect.any(String)
      });
    });

    it('should use default pagination parameters', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await purchaseModel.getByUserId('user123');

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.any(String),
        ['user123', 50, 0] // default limit and offset
      );
    });
  });

  describe('getByFlashSaleId', () => {
    it('should return flash sale purchases successfully', async () => {
      const mockPurchases = [
        {
          id: 1,
          user_email: 'user1@test.com',
          product_name: 'Product 1',
          product_price: 99.99,
          flash_sale_name: 'Test Flash Sale'
        }
      ];

      mockDatabase.all.mockResolvedValue(mockPurchases);

      const result = await purchaseModel.getByFlashSaleId(1, 50, 0);

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE p.flash_sale_id = ?'),
        [1, 50, 0]
      );
      expect(result).toEqual({
        success: true,
        data: mockPurchases,
        message: 'Flash sale purchases retrieved successfully',
        timestamp: expect.any(String)
      });
    });
  });

  describe('getFlashSaleStatistics', () => {
    it('should return purchase statistics', async () => {
      const mockStats = {
        total_purchases: 10,
        unique_customers: 8
      };

      mockDatabase.get.mockResolvedValue(mockStats);

      const result = await purchaseModel.getFlashSaleStatistics(1);

      expect(mockDatabase.get).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*) as total_purchases'),
        [1]
      );
      expect(result).toEqual({
        success: true,
        data: {
          totalPurchases: 10,
          totalRevenue: 0,
          uniqueCustomers: 8
        },
        message: 'Statistics retrieved successfully',
        timestamp: expect.any(String)
      });
    });

    it('should handle null statistics', async () => {
      mockDatabase.get.mockResolvedValue(null);

      const result = await purchaseModel.getFlashSaleStatistics(1);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          totalPurchases: 0,
          totalRevenue: 0,
          uniqueCustomers: 0
        });
      }
    });
  });

  describe('hasUserPurchased', () => {
    it('should return true when user has purchased', async () => {
      mockDatabase.get.mockResolvedValue({ id: 1 });

      const result = await purchaseModel.hasUserPurchased('user123', 1);

      expect(mockDatabase.get).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = ? AND flash_sale_id = ?'),
        ['user123', 1]
      );
      expect(result).toBe(true);
    });

    it('should return false when user has not purchased', async () => {
      mockDatabase.get.mockResolvedValue(null);

      const result = await purchaseModel.hasUserPurchased('user123', 1);

      expect(result).toBe(false);
    });

    it('should return false on database error', async () => {
      const dbError = new Error('Database error');
      mockDatabase.get.mockRejectedValue(dbError);

      const result = await purchaseModel.hasUserPurchased('user123', 1);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Error checking user purchase status',
        { error: dbError, userId: 'user123', flashSaleId: 1 }
      );
    });
  });
});
