import { FlashSaleModel } from '../../models/FlashSale';
import database from '../../models/database';
import logger from '../../utils/logger';

// Mock dependencies
jest.mock('../../models/database');
jest.mock('../../utils/logger');

describe('FlashSaleModel', () => {
  let flashSaleModel: FlashSaleModel;
  let mockDatabase: jest.Mocked<typeof database>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mocked database instance
    mockDatabase = database as jest.Mocked<typeof database>;
    
    flashSaleModel = new FlashSaleModel();
  });

  describe('create', () => {
    const validFlashSaleData = {
      name: 'Test Flash Sale',
      startTime: new Date(Date.now() + 60000).toISOString(), // 1 minute from now
      endTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      createdBy: 'admin_user'
    };

    it('should create a flash sale successfully', async () => {
      const mockFlashSale = {
        id: 1,
        name: validFlashSaleData.name,
        start_time: validFlashSaleData.startTime,
        end_time: validFlashSaleData.endTime,
        is_active: 1,
        created_by: validFlashSaleData.createdBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockDatabase.run.mockResolvedValue({ id: 1, changes: 1 } as any);
      mockDatabase.get.mockResolvedValue(mockFlashSale);

      const result = await flashSaleModel.create(validFlashSaleData);

      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO flash_sales'),
        expect.arrayContaining([
          validFlashSaleData.name,
          expect.any(String), // normalized start time
          expect.any(String), // normalized end time
          validFlashSaleData.createdBy
        ])
      );
      expect(result).toEqual(mockFlashSale);
      expect(logger.audit).toHaveBeenCalledWith(
        'Flash sale created',
        'flash_sale',
        '1',
        expect.any(Object)
      );
    });

    it('should throw error for invalid date format', async () => {
      const invalidData = {
        ...validFlashSaleData,
        startTime: 'invalid-date'
      };

      await expect(flashSaleModel.create(invalidData)).rejects.toThrow('Invalid date format');
      expect(mockDatabase.run).not.toHaveBeenCalled();
    });

    it('should throw error when end time is before start time', async () => {
      const invalidData = {
        ...validFlashSaleData,
        startTime: new Date(Date.now() + 3600000).toISOString(),
        endTime: new Date(Date.now() + 60000).toISOString()
      };

      await expect(flashSaleModel.create(invalidData)).rejects.toThrow('End time must be after start time');
      expect(mockDatabase.run).not.toHaveBeenCalled();
    });

    it('should throw error when start time is in the past', async () => {
      const invalidData = {
        ...validFlashSaleData,
        startTime: new Date(Date.now() - 600000).toISOString() // 10 minutes ago
      };

      await expect(flashSaleModel.create(invalidData)).rejects.toThrow('Start time must be in the future');
      expect(mockDatabase.run).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      mockDatabase.run.mockRejectedValue(dbError);

      await expect(flashSaleModel.create(validFlashSaleData)).rejects.toThrow('Database connection failed');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create flash sale',
        { error: dbError, data: validFlashSaleData }
      );
    });
  });

  describe('findById', () => {
    it('should return flash sale when found', async () => {
      const mockFlashSale = {
        id: 1,
        name: 'Test Flash Sale',
        start_time: '2023-01-01 10:00:00',
        end_time: '2023-01-01 11:00:00',
        is_active: 1
      };

      mockDatabase.get.mockResolvedValue(mockFlashSale);

      const result = await flashSaleModel.findById(1);

      expect(mockDatabase.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, name, start_time, end_time, is_active, created_by, created_at, updated_at'),
        [1]
      );
      expect(result).toEqual(mockFlashSale);
    });

    it('should return null when flash sale not found', async () => {
      mockDatabase.get.mockResolvedValue(undefined);

      const result = await flashSaleModel.findById(999);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database error');
      mockDatabase.get.mockRejectedValue(dbError);

      await expect(flashSaleModel.findById(1)).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to find flash sale by ID',
        { error: dbError, id: 1 }
      );
    });
  });

  describe('getCurrent', () => {
    it('should return current active flash sale', async () => {
      const mockFlashSale = {
        id: 1,
        name: 'Current Flash Sale',
        start_time: '2023-01-01 10:00:00',
        end_time: '2023-01-01 11:00:00',
        is_active: 1
      };

      mockDatabase.get.mockResolvedValue(mockFlashSale);

      const result = await flashSaleModel.getCurrent();

      expect(mockDatabase.get).toHaveBeenCalledWith(
        expect.stringContaining("datetime('now') BETWEEN start_time AND end_time"),
        []
      );
      expect(result).toEqual(mockFlashSale);
    });

    it('should return null when no current flash sale', async () => {
      mockDatabase.get.mockResolvedValue(undefined);

      const result = await flashSaleModel.getCurrent();

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    const updateData = {
      name: 'Updated Flash Sale',
      isActive: false
    };

    it('should update flash sale successfully', async () => {
      const mockUpdatedFlashSale = {
        id: 1,
        name: 'Updated Flash Sale',
        is_active: 0
      };

      mockDatabase.run.mockResolvedValue({ changes: 1 } as any);
      mockDatabase.get.mockResolvedValue(mockUpdatedFlashSale);

      const result = await flashSaleModel.update(1, updateData);

      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE flash_sales'),
        expect.arrayContaining(['Updated Flash Sale', 0, 1])
      );
      expect(result).toEqual(mockUpdatedFlashSale);
      expect(logger.audit).toHaveBeenCalledWith(
        'Flash sale updated',
        'flash_sale',
        '1',
        updateData
      );
    });

    it('should return null when flash sale not found', async () => {
      mockDatabase.run.mockResolvedValue({ changes: 0 } as any);

      const result = await flashSaleModel.update(999, updateData);

      expect(result).toBeNull();
    });

    it('should return unchanged flash sale when no fields to update', async () => {
      const mockFlashSale = { id: 1, name: 'Test' };
      mockDatabase.get.mockResolvedValue(mockFlashSale);

      const result = await flashSaleModel.update(1, {});

      expect(mockDatabase.run).not.toHaveBeenCalled();
      expect(result).toEqual(mockFlashSale);
    });
  });

  describe('delete', () => {
    it('should delete flash sale successfully', async () => {
      mockDatabase.run.mockResolvedValue({ changes: 1 } as any);

      const result = await flashSaleModel.delete(1);

      expect(mockDatabase.run).toHaveBeenCalledWith(
        'DELETE FROM flash_sales WHERE id = ?',
        [1]
      );
      expect(result).toBe(true);
      expect(logger.audit).toHaveBeenCalledWith(
        'Flash sale deleted',
        'flash_sale',
        '1',
        {}
      );
    });

    it('should return false when flash sale not found', async () => {
      mockDatabase.run.mockResolvedValue({ changes: 0 } as any);

      const result = await flashSaleModel.delete(999);

      expect(result).toBe(false);
    });
  });

  describe('safeDelete', () => {
    it('should safely delete flash sale when no purchases exist', async () => {
      mockDatabase.get.mockResolvedValue({ count: 0 });
      mockDatabase.run
        .mockResolvedValueOnce({ changes: 1 } as any) // Delete products
        .mockResolvedValueOnce({ changes: 1 } as any); // Delete flash sale

      const result = await flashSaleModel.safeDelete(1);

      expect(mockDatabase.beginTransaction).toHaveBeenCalled();
      expect(mockDatabase.get).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM purchases WHERE flash_sale_id = ?',
        [1]
      );
      expect(mockDatabase.run).toHaveBeenCalledWith(
        'DELETE FROM products WHERE flash_sale_id = ?',
        [1]
      );
      expect(mockDatabase.commit).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should refuse to delete flash sale with existing purchases', async () => {
      mockDatabase.get.mockResolvedValue({ count: 5 });

      await expect(flashSaleModel.safeDelete(1)).rejects.toThrow(
        'Cannot delete flash sale with existing purchases'
      );
      expect(mockDatabase.rollback).toHaveBeenCalled();
    });

    it('should rollback on database error', async () => {
      mockDatabase.get.mockRejectedValue(new Error('Database error'));

      await expect(flashSaleModel.safeDelete(1)).rejects.toThrow('Database error');
      expect(mockDatabase.rollback).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    const mockFlashSales = [
      { id: 1, name: 'Flash Sale 1' },
      { id: 2, name: 'Flash Sale 2' }
    ];

    it('should search flash sales with filters', async () => {
      mockDatabase.get.mockResolvedValue({ total: 2 });
      mockDatabase.all.mockResolvedValue(mockFlashSales);

      const query = {
        name: 'Test',
        isActive: true,
        limit: 10,
        offset: 0
      };

      const result = await flashSaleModel.search(query);

      expect(mockDatabase.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as total'),
        expect.arrayContaining(['%Test%', 1])
      );
      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        expect.arrayContaining(['%Test%', 1, 10, 0])
      );
      expect(result).toEqual({
        flashSales: mockFlashSales,
        total: 2
      });
    });

    it('should search without filters', async () => {
      mockDatabase.get.mockResolvedValue({ total: 2 });
      mockDatabase.all.mockResolvedValue(mockFlashSales);

      const result = await flashSaleModel.search({});

      expect(mockDatabase.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as total'),
        [] // no parameters when no filters
      );
      expect(result).toEqual({
        flashSales: mockFlashSales,
        total: 2
      });
    });
  });

  describe('activate/deactivate', () => {
    it('should activate flash sale', async () => {
      mockDatabase.run.mockResolvedValue({ changes: 1 } as any);

      const result = await flashSaleModel.activate(1);

      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE flash_sales SET is_active = 1'),
        [1]
      );
      expect(result).toBe(true);
      expect(logger.audit).toHaveBeenCalledWith(
        'Flash sale activated',
        'flash_sale',
        '1',
        {}
      );
    });

    it('should deactivate flash sale', async () => {
      mockDatabase.run.mockResolvedValue({ changes: 1 } as any);

      const result = await flashSaleModel.deactivate(1);

      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE flash_sales SET is_active = 0'),
        [1]
      );
      expect(result).toBe(true);
      expect(logger.audit).toHaveBeenCalledWith(
        'Flash sale deactivated',
        'flash_sale',
        '1',
        {}
      );
    });
  });
});
