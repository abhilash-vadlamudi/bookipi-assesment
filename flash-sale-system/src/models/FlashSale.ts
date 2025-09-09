import database from './database';
import { Database } from './database';
import logger from '../utils/logger';
import TimezoneUtils from '../utils/timezone';
import { FlashSale, FlashSaleStatus } from '../types';

export class FlashSaleModel {
  async create(data: {
    name: string;
    startTime: string;
    endTime: string;
    createdBy?: string;
  }): Promise<FlashSale> {
    try {
      // Parse and validate times
      const startDate = new Date(data.startTime);
      const endDate = new Date(data.endTime);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Invalid date format');
      }
      
      if (endDate <= startDate) {
        throw new Error('End time must be after start time');
      }
      
      // For validation, use a more lenient approach - allow times within 5 minutes of now
      // This accounts for timezone differences and minor delays
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      
      if (startDate < fiveMinutesAgo) {
        throw new Error('Start time must be in the future');
      }

      // Normalize dates to SQLite datetime format (YYYY-MM-DD HH:MM:SS)
      const normalizeDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        return date.toISOString().slice(0, 19).replace('T', ' ');
      };

      const normalizedStartTime = normalizeDate(data.startTime);
      const normalizedEndTime = normalizeDate(data.endTime);

      const sql = `
        INSERT INTO flash_sales (name, start_time, end_time, created_by)
        VALUES (?, ?, ?, ?)
      `;

      const result = await database.run(sql, [
        data.name,
        normalizedStartTime,
        normalizedEndTime,
        data.createdBy || null
      ]);

      logger.audit('Flash sale created', 'flash_sale', result.id.toString(), {
        name: data.name,
        startTime: normalizedStartTime,
        endTime: normalizedEndTime,
        createdBy: data.createdBy
      });

      return this.findById(result.id) as Promise<FlashSale>;
    } catch (error) {
      logger.error('Failed to create flash sale', { error, data });
      throw error;
    }
  }

  async findById(id: number): Promise<FlashSale | null> {
    try {
      const sql = `
        SELECT id, name, start_time, end_time, is_active, created_by, created_at, updated_at
        FROM flash_sales
        WHERE id = ?
      `;

      const flashSale = await database.get(sql, [id]) as FlashSale | undefined;
      return flashSale || null;
    } catch (error) {
      logger.error('Failed to find flash sale by ID', { error, id });
      throw error;
    }
  }

  async getCurrent(): Promise<FlashSale | null> {
    try {
      const sql = `
        SELECT id, name, start_time, end_time, is_active, created_by, created_at, updated_at
        FROM flash_sales
        WHERE is_active = 1 AND datetime('now') BETWEEN start_time AND end_time
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const flashSale = await database.get(sql, []) as FlashSale | undefined;
      return flashSale || null;
    } catch (error) {
      logger.error('Failed to get current flash sale', { error });
      throw error;
    }
  }

  async getAll(): Promise<FlashSale[]> {
    try {
      const sql = `
        SELECT id, name, start_time, end_time, is_active, created_by, created_at, updated_at
        FROM flash_sales
        ORDER BY created_at DESC
      `;

      const flashSales = await database.all(sql, []) as FlashSale[];
      return flashSales;
    } catch (error) {
      logger.error('Failed to get all flash sales', { error });
      throw error;
    }
  }

  async getActive(): Promise<FlashSale[]> {
    try {
      const sql = `
        SELECT id, name, start_time, end_time, is_active, created_by, created_at, updated_at
        FROM flash_sales
        WHERE is_active = 1 AND datetime('now') BETWEEN start_time AND end_time
        ORDER BY start_time ASC
      `;

      const flashSale = await database.get(sql, []) as FlashSale | undefined;
      return flashSale ? [flashSale] : [];
    } catch (error) {
      logger.error('Failed to get active flash sales', { error });
      throw error;
    }
  }

  async getAllActive(): Promise<FlashSale[]> {
    try {
      const sql = `
        SELECT id, name, start_time, end_time, is_active, created_by, created_at, updated_at
        FROM flash_sales
        WHERE is_active = 1 AND datetime('now') BETWEEN start_time AND end_time
        ORDER BY start_time ASC
      `;

      const flashSales = await database.all(sql, []) as FlashSale[];
      return flashSales;
    } catch (error) {
      logger.error('Failed to get all active flash sales', { error });
      throw error;
    }
  }

  // Alias methods for compatibility with controller
  async findAll(query: any = {}): Promise<{
    flashSales: FlashSale[];
    total: number;
  }> {
    return this.search(query);
  }

  async findAllActive(): Promise<FlashSale[]> {
    return this.getAllActive();
  }

  async search(query: {
    name?: string;
    isActive?: boolean;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    flashSales: FlashSale[];
    total: number;
  }> {
    try {
      let whereConditions: string[] = [];
      let params: any[] = [];

      if (query.name) {
        whereConditions.push('name LIKE ?');
        params.push(`%${query.name}%`);
      }

      if (query.isActive !== undefined) {
        whereConditions.push('is_active = ?');
        params.push(query.isActive ? 1 : 0);
      }

      if (query.startDate) {
        whereConditions.push('start_time >= ?');
        params.push(query.startDate);
      }

      if (query.endDate) {
        whereConditions.push('end_time <= ?');
        params.push(query.endDate);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get total count
      const countSql = `
        SELECT COUNT(*) as total
        FROM flash_sales
        ${whereClause}
      `;

      const countResult = await database.get(countSql, params) as { total: number };

      // Get flash sales with limit and offset
      const limit = query.limit || 20;
      const offset = query.offset || 0;

      const sql = `
        SELECT id, name, start_time, end_time, is_active, created_by, created_at, updated_at
        FROM flash_sales
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;

      const flashSales = await database.all(sql, [...params, limit, offset]) as FlashSale[];

      return {
        flashSales,
        total: countResult.total
      };
    } catch (error) {
      logger.error('Failed to search flash sales', { error, query });
      throw error;
    }
  }

  async getCurrentStatus(): Promise<{
    status: 'active' | 'inactive' | 'upcoming';
    flashSale?: FlashSale;
    activeCount: number;
    totalCount: number;
    nextFlashSale?: FlashSale;
  }> {
    try {
      // Get current flash sale
      const currentFlashSale = await this.getCurrent();

      // Get upcoming flash sale
      const upcomingSql = `
        SELECT id, name, start_time, end_time, is_active, created_by, created_at, updated_at
        FROM flash_sales
        WHERE is_active = 1 AND start_time > datetime('now')
        ORDER BY start_time ASC
        LIMIT 1
      `;
      const nextFlashSale = await database.get(upcomingSql, []) as FlashSale | undefined;

      // Get active count
      const activeCountSql = `
        SELECT COUNT(*) as count
        FROM flash_sales
        WHERE is_active = 1 AND datetime('now') BETWEEN start_time AND end_time
      `;
      const activeCount = (await database.get(activeCountSql, []) as { count: number }).count;

      // Get total count
      const totalCountSql = `SELECT COUNT(*) as count FROM flash_sales`;
      const totalCount = (await database.get(totalCountSql, []) as { count: number }).count;

      let status: 'active' | 'inactive' | 'upcoming' = 'inactive';

      if (currentFlashSale) {
        status = 'active';
      } else if (nextFlashSale) {
        status = 'upcoming';
      }

      return {
        status,
        ...(currentFlashSale && { flashSale: currentFlashSale }),
        activeCount,
        totalCount,
        ...(nextFlashSale && { nextFlashSale: nextFlashSale })
      };
    } catch (error) {
      logger.error('Failed to get current status', { error });
      throw error;
    }
  }

  async update(id: number, data: {
    name?: string;
    startTime?: string;
    endTime?: string;
    isActive?: boolean;
  }): Promise<FlashSale | null> {
    try {
      const updateFields: string[] = [];
      const values: any[] = [];

      if (data.name !== undefined) {
        updateFields.push('name = ?');
        values.push(data.name);
      }

      if (data.startTime !== undefined) {
        const normalizedStartTime = new Date(data.startTime).toISOString().slice(0, 19).replace('T', ' ');
        updateFields.push('start_time = ?');
        values.push(normalizedStartTime);
      }

      if (data.endTime !== undefined) {
        const normalizedEndTime = new Date(data.endTime).toISOString().slice(0, 19).replace('T', ' ');
        updateFields.push('end_time = ?');
        values.push(normalizedEndTime);
      }

      if (data.isActive !== undefined) {
        updateFields.push('is_active = ?');
        values.push(data.isActive ? 1 : 0);
      }

      if (updateFields.length === 0) {
        return this.findById(id);
      }

      updateFields.push('updated_at = datetime("now")');
      values.push(id);

      const sql = `
        UPDATE flash_sales
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `;

      const result = await database.run(sql, values);

      if (result.changes === 0) {
        return null;
      }

      logger.audit('Flash sale updated', 'flash_sale', id.toString(), data);

      return this.findById(id);
    } catch (error) {
      logger.error('Failed to update flash sale', { error, id, data });
      throw error;
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      const sql = `DELETE FROM flash_sales WHERE id = ?`;
      const result = await database.run(sql, [id]);

      logger.audit('Flash sale deleted', 'flash_sale', id.toString(), {});

      return result.changes > 0;
    } catch (error) {
      logger.error('Failed to delete flash sale', { error, id });
      throw error;
    }
  }

  async safeDelete(id: number): Promise<boolean> {
    try {
      await database.beginTransaction();

      // Check if there are any purchases for this flash sale
      const purchaseCheckSql = `SELECT COUNT(*) as count FROM purchases WHERE flash_sale_id = ?`;
      const purchaseCount = await database.get(purchaseCheckSql, [id]) as { count: number };

      if (purchaseCount.count > 0) {
        await database.rollback();
        throw new Error('Cannot delete flash sale with existing purchases');
      }

      // Delete associated products first
      await database.run('DELETE FROM products WHERE flash_sale_id = ?', [id]);

      // Delete the flash sale
      const sql = `DELETE FROM flash_sales WHERE id = ?`;
      const result = await database.run(sql, [id]);

      await database.commit();

      logger.audit('Flash sale safely deleted', 'flash_sale', id.toString(), {
        deletedProducts: true
      });

      return result.changes > 0;
    } catch (error) {
      await database.rollback();
      logger.error('Failed to safely delete flash sale', { error, id });
      throw error;
    }
  }

  async activate(id: number): Promise<boolean> {
    try {
      const sql = `UPDATE flash_sales SET is_active = 1, updated_at = datetime("now") WHERE id = ?`;
      const result = await database.run(sql, [id]);

      logger.audit('Flash sale activated', 'flash_sale', id.toString(), {});

      return result.changes > 0;
    } catch (error) {
      logger.error('Failed to activate flash sale', { error, id });
      throw error;
    }
  }

  async deactivate(id: number): Promise<boolean> {
    try {
      const sql = `UPDATE flash_sales SET is_active = 0, updated_at = datetime("now") WHERE id = ?`;
      const result = await database.run(sql, [id]);

      logger.audit('Flash sale deactivated', 'flash_sale', id.toString(), {});

      return result.changes > 0;
    } catch (error) {
      logger.error('Failed to deactivate flash sale', { error, id });
      throw error;
    }
  }
}
