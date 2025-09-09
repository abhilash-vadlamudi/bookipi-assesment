import { Request, Response } from 'express';
import { FlashSaleController } from '../../controllers/FlashSaleController';
import { FlashSaleModel } from '../../models/FlashSale';
import { ProductModel } from '../../models/Product';
import { PurchaseModel } from '../../models/Purchase';
import { UserModel } from '../../models/User';
import TimezoneUtils from '../../utils/timezone';
import logger from '../../utils/logger';
import { FlashSale, User, Purchase, Product, PurchaseWithDetails } from '../../types';

// Mock dependencies
jest.mock('../../models/FlashSale');
jest.mock('../../models/Product');
jest.mock('../../models/Purchase');
jest.mock('../../models/User');
jest.mock('../../utils/timezone');
jest.mock('../../utils/logger');
jest.mock('express-validator');

describe('FlashSaleController', () => {
  let controller: FlashSaleController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockFlashSaleModel: jest.Mocked<FlashSaleModel>;
  let mockProductModel: jest.Mocked<ProductModel>;
  let mockPurchaseModel: jest.Mocked<PurchaseModel>;
  let mockUserModel: jest.Mocked<UserModel>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock models
    mockFlashSaleModel = {
      findAll: jest.fn(),
      findAllActive: jest.fn(),
      findById: jest.fn(),
      getCurrentStatus: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    } as any;

    mockProductModel = {
      findByFlashSaleId: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    } as any;

    mockPurchaseModel = {
      attemptPurchase: jest.fn(),
      hasUserPurchased: jest.fn(),
      getByUserId: jest.fn(),
      getByFlashSaleId: jest.fn()
    } as any;

    mockUserModel = {
      findById: jest.fn()
    } as any;

    // Mock constructors
    (FlashSaleModel as jest.Mock).mockImplementation(() => mockFlashSaleModel);
    (ProductModel as jest.Mock).mockImplementation(() => mockProductModel);
    (PurchaseModel as jest.Mock).mockImplementation(() => mockPurchaseModel);
    (UserModel as jest.Mock).mockImplementation(() => mockUserModel);

    // Mock TimezoneUtils
    (TimezoneUtils.formatTimeForUser as jest.Mock).mockImplementation((time, timezone) => `${time}_${timezone}`);
    (TimezoneUtils.convertUTCToUserTimezone as jest.Mock).mockImplementation((time, timezone) => `${time}_${timezone}`);

    // Mock express-validator
    const { validationResult } = require('express-validator');
    (validationResult as jest.Mock).mockReturnValue({ isEmpty: () => true, array: () => [] });

    controller = new FlashSaleController();

    // Mock request and response
    mockRequest = {
      body: {},
      params: {},
      query: {},
      path: '/api/flash-sale'
    } as any;

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('getAllFlashSales', () => {
    const mockFlashSales: FlashSale[] = [
      {
        id: 1,
        name: 'Test Flash Sale',
        start_time: '2023-01-01 10:00:00',
        end_time: '2023-01-01 11:00:00',
        is_active: true,
        created_by: 'admin',
        created_at: '2023-01-01 09:00:00',
        updated_at: '2023-01-01 09:00:00'
      } as FlashSale
    ];

    it('should return all flash sales successfully', async () => {
      mockFlashSaleModel.findAll.mockResolvedValue({
        flashSales: mockFlashSales,
        total: 1
      });

      await controller.getAllFlashSales(mockRequest as Request, mockResponse as Response);

      expect(mockFlashSaleModel.findAll).toHaveBeenCalledWith({});
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          flashSales: expect.arrayContaining([
            expect.objectContaining({
              id: 1,
              name: 'Test Flash Sale',
              start_time_local: expect.any(String),
              end_time_local: expect.any(String),
              user_timezone: 'UTC'
            })
          ]),
          total: 1
        },
        message: 'Flash sales retrieved successfully',
        timestamp: expect.any(String)
      });
    });

    it('should convert timezone for authenticated user', async () => {
      mockRequest.user = { 
        userId: 'user123',
        email: 'test@example.com',
        role: 'user',
        iat: 123456789,
        exp: 123456999
      };
      
      const mockUser: User = {
        id: 'user123',
        email: 'test@example.com',
        password_hash: 'hash',
        role: 'user',
        timezone: 'America/New_York',
        is_active: true,
        created_at: '2023-01-01 09:00:00',
        last_login: '2023-01-01 09:00:00',
        failed_login_attempts: 0
      } as User;
      
      mockUserModel.findById.mockResolvedValue(mockUser);
      mockFlashSaleModel.findAll.mockResolvedValue({
        flashSales: mockFlashSales,
        total: 1
      });

      await controller.getAllFlashSales(mockRequest as Request, mockResponse as Response);

      expect(mockUserModel.findById).toHaveBeenCalledWith('user123');
      expect(TimezoneUtils.formatTimeForUser).toHaveBeenCalledWith(
        '2023-01-01 10:00:00',
        'America/New_York'
      );
    });

    it('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      mockFlashSaleModel.findAll.mockRejectedValue(error);

      await controller.getAllFlashSales(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to get flash sales',
        error: 'Database connection failed',
        statusCode: 500,
        timestamp: expect.any(String),
        path: '/api/flash-sale'
      });
      expect(logger.error).toHaveBeenCalledWith(
        'Error getting all flash sales:',
        { error }
      );
    });
  });

  describe('attemptPurchase', () => {
    const validPurchaseData = {
      userId: 'user123',
      productId: 1,
      flashSaleId: 1
    };

    const mockFlashSale: FlashSale = {
      id: 1,
      name: 'Test Flash Sale',
      start_time: '2023-01-01 10:00:00',
      end_time: '2023-01-01 11:00:00',
      is_active: true,
      created_by: 'admin',
      created_at: '2023-01-01 09:00:00',
      updated_at: '2023-01-01 09:00:00'
    } as FlashSale;

    beforeEach(() => {
      mockRequest.body = validPurchaseData;
      mockRequest.user = { 
        userId: 'user123',
        email: 'test@example.com',
        role: 'user',
        iat: 123456789,
        exp: 123456999
      };
      
      // Mock current time to be within flash sale window
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2023-01-01T10:30:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('should complete purchase successfully', async () => {
      const mockPurchase: Purchase = {
        id: 1,
        user_id: 'user123',
        flash_sale_id: 1,
        product_id: 1,
        quantity: 1,
        status: 'completed',
        purchase_time: '2023-01-01 10:30:00',
        created_at: '2023-01-01 10:30:00',
        updated_at: '2023-01-01 10:30:00'
      };

      mockFlashSaleModel.findById.mockResolvedValue(mockFlashSale);
      mockPurchaseModel.attemptPurchase.mockResolvedValue({
        success: true,
        data: mockPurchase,
        message: 'Purchase completed successfully',
        timestamp: new Date().toISOString()
      });

      await controller.attemptPurchase(mockRequest as Request, mockResponse as Response);

      expect(mockFlashSaleModel.findById).toHaveBeenCalledWith(1);
      expect(mockPurchaseModel.attemptPurchase).toHaveBeenCalledWith('user123', 1, 1, 1);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(logger.info).toHaveBeenCalledWith(
        'Purchase attempt completed',
        expect.objectContaining({
          userId: 'user123',
          flashSaleId: 1,
          productId: 1
        })
      );
    });

    it('should handle validation errors', async () => {
      const { validationResult } = require('express-validator');
      (validationResult as jest.Mock).mockReturnValue({
        isEmpty: () => false,
        array: () => [
          { msg: 'User ID is required' },
          { msg: 'Product ID must be positive' }
        ]
      });

      await controller.attemptPurchase(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        error: 'User ID is required, Product ID must be positive',
        statusCode: 400,
        timestamp: expect.any(String),
        path: '/api/flash-sale'
      });
    });

    it('should reject purchase for non-existent flash sale', async () => {
      mockFlashSaleModel.findById.mockResolvedValue(null);

      await controller.attemptPurchase(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Flash sale not found',
        statusCode: 404,
        timestamp: expect.any(String),
        path: '/api/flash-sale'
      });
    });

    it('should handle purchase model errors', async () => {
      mockFlashSaleModel.findById.mockResolvedValue(mockFlashSale);
      mockPurchaseModel.attemptPurchase.mockResolvedValue({
        success: false,
        message: 'User has already purchased in this flash sale',
        statusCode: 409,
        timestamp: new Date().toISOString()
      });

      await controller.attemptPurchase(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User has already purchased in this flash sale',
        statusCode: 409,
        timestamp: expect.any(String)
      });
    });

    it('should handle unexpected errors', async () => {
      const error = new Error('Unexpected database error');
      mockFlashSaleModel.findById.mockRejectedValue(error);

      await controller.attemptPurchase(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Purchase failed',
        error: 'Unexpected database error',
        statusCode: 500,
        timestamp: expect.any(String),
        path: '/api/flash-sale'
      });
      expect(logger.error).toHaveBeenCalledWith(
        'Error attempting purchase:',
        expect.objectContaining({
          error,
          userId: 'user123'
        })
      );
    });
  });

  describe('getUserPurchaseHistory', () => {
    beforeEach(() => {
      mockRequest.params = { userId: 'user123' };
      mockRequest.query = { limit: '10', offset: '0' };
    });

    it('should return user purchase history successfully', async () => {
      const mockUser: User = {
        id: 'user123',
        email: 'test@example.com',
        password_hash: 'hash',
        role: 'user',
        timezone: 'America/New_York',
        is_active: true,
        created_at: '2023-01-01 09:00:00',
        last_login: '2023-01-01 09:00:00',
        failed_login_attempts: 0
      } as User;

      const mockPurchases: PurchaseWithDetails[] = [
        {
          id: 1,
          user_id: 'user123',
          product_id: 1,
          flash_sale_id: 1,
          quantity: 1,
          status: 'completed',
          purchase_time: '2023-01-01 10:00:00',
          created_at: '2023-01-01T10:00:00Z',
          updated_at: '2023-01-01T10:00:00Z',
          product_name: 'Test Product',
          product_price: 99.99,
          flash_sale_name: 'Test Flash Sale',
          user_email: 'test@example.com'
        }
      ];

      mockUserModel.findById.mockResolvedValue(mockUser);
      mockPurchaseModel.getByUserId.mockResolvedValue({
        success: true,
        data: mockPurchases,
        message: 'Purchases retrieved successfully',
        timestamp: new Date().toISOString()
      });

      await controller.getUserPurchaseHistory(mockRequest as Request, mockResponse as Response);

      expect(mockUserModel.findById).toHaveBeenCalledWith('user123');
      expect(mockPurchaseModel.getByUserId).toHaveBeenCalledWith('user123', 10, 0);
      expect(TimezoneUtils.convertUTCToUserTimezone).toHaveBeenCalledWith(
        '2023-01-01T10:00:00Z',
        'America/New_York'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should handle missing user ID', async () => {
      mockRequest.params = {}; // No userId

      await controller.getUserPurchaseHistory(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User ID is required',
        statusCode: 400,
        timestamp: expect.any(String),
        path: '/api/flash-sale'
      });
    });
  });
});
