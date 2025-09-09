import database from './database';
import { Database } from './database';
import logger from '../utils/logger';
import { Product, InventoryStatus } from '../types';

export class ProductModel {
  async create(data: {
    name: string;
    description?: string;
    price: number;
    totalQuantity: number;
    flashSaleId: number;
  }): Promise<Product> {
    try {
      // Validate input
      if (data.price <= 0) {
        throw new Error('Product price must be greater than 0');
      }

      if (data.totalQuantity <= 0) {
        throw new Error('Product quantity must be greater than 0');
      }

      if (data.totalQuantity > 10000) {
        throw new Error('Product quantity cannot exceed 10,000 for a single flash sale');
      }

      const sql = `
        INSERT INTO products (name, description, price, total_quantity, available_quantity, flash_sale_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      const result = await database.run(sql, [
        data.name.trim(),
        data.description?.trim() || '',
        data.price,
        data.totalQuantity,
        data.totalQuantity, // Initially all quantity is available
        data.flashSaleId
      ]);

      logger.audit('Product created', 'product', result.id.toString(), {
        name: data.name,
        price: data.price,
        totalQuantity: data.totalQuantity,
        flashSaleId: data.flashSaleId
      });

      return this.findById(result.id) as Promise<Product>;
    } catch (error) {
      logger.error('Failed to create product', { error, data });
      throw error;
    }
  }

  async findById(id: number): Promise<Product | null> {
    try {
      const sql = 'SELECT * FROM products WHERE id = ?';
      const product = await database.get(sql, [id]) as Product | undefined;
      return product || null;
    } catch (error) {
      logger.error('Failed to find product by ID', { error, id });
      throw error;
    }
  }

  async findByFlashSaleId(flashSaleId: number): Promise<Product[]> {
    try {
      const sql = 'SELECT * FROM products WHERE flash_sale_id = ? ORDER BY created_at ASC';
      const products = await database.all(sql, [flashSaleId]) as Product[];
      return products;
    } catch (error) {
      logger.error('Failed to find products by flash sale ID', { error, flashSaleId });
      throw error;
    }
  }

  async findAvailableByFlashSale(flashSaleId: number): Promise<Product[]> {
    try {
      const sql = `
        SELECT * FROM products 
        WHERE flash_sale_id = ? AND available_quantity > 0
        ORDER BY created_at ASC
      `;
      const products = await database.all(sql, [flashSaleId]) as Product[];
      return products;
    } catch (error) {
      logger.error('Failed to find available products by flash sale', { error, flashSaleId });
      throw error;
    }
  }

  async updateQuantity(id: number, newAvailableQuantity: number): Promise<Product> {
    try {
      if (newAvailableQuantity < 0) {
        throw new Error('Available quantity cannot be negative');
      }

      // Use optimistic locking to prevent race conditions
      const sql = `
        UPDATE products 
        SET available_quantity = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND available_quantity >= ?
      `;

      const result = await database.run(sql, [newAvailableQuantity, id, newAvailableQuantity]);

      if (result.changes === 0) {
        // Get current product to provide better error message
        const currentProduct = await this.findById(id);
        if (!currentProduct) {
          throw new Error('Product not found');
        }
        throw new Error(`Insufficient stock. Available: ${currentProduct.available_quantity}, Requested: ${newAvailableQuantity}`);
      }

      logger.debug('Product quantity updated', { 
        productId: id, 
        newQuantity: newAvailableQuantity 
      });

      return this.findById(id) as Promise<Product>;
    } catch (error) {
      logger.error('Failed to update product quantity', { error, id, newAvailableQuantity });
      throw error;
    }
  }

  async decrementQuantity(id: number, quantity: number = 1): Promise<Product> {
    try {
      if (quantity <= 0) {
        throw new Error('Quantity to decrement must be positive');
      }

      // Atomic decrement operation with validation
      const sql = `
        UPDATE products 
        SET available_quantity = available_quantity - ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND available_quantity >= ?
      `;

      const result = await database.run(sql, [quantity, id, quantity]);

      if (result.changes === 0) {
        const currentProduct = await this.findById(id);
        if (!currentProduct) {
          throw new Error('Product not found');
        }
        throw new Error(`Insufficient stock. Available: ${currentProduct.available_quantity}, Requested: ${quantity}`);
      }

      logger.audit('Product quantity decremented', 'product', id.toString(), {
        decrementBy: quantity
      });

      return this.findById(id) as Promise<Product>;
    } catch (error) {
      logger.error('Failed to decrement product quantity', { error, id, quantity });
      throw error;
    }
  }

  async incrementQuantity(id: number, quantity: number = 1): Promise<Product> {
    try {
      if (quantity <= 0) {
        throw new Error('Quantity to increment must be positive');
      }

      // Get current product to validate against total quantity
      const currentProduct = await this.findById(id);
      if (!currentProduct) {
        throw new Error('Product not found');
      }

      const newQuantity = currentProduct.available_quantity + quantity;
      if (newQuantity > currentProduct.total_quantity) {
        throw new Error(`Cannot increment quantity beyond total quantity (${currentProduct.total_quantity})`);
      }

      // Atomic increment operation
      const sql = `
        UPDATE products 
        SET available_quantity = available_quantity + ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND available_quantity + ? <= total_quantity
      `;

      const result = await database.run(sql, [quantity, id, quantity]);

      if (result.changes === 0) {
        throw new Error('Failed to increment quantity - would exceed total quantity');
      }

      logger.audit('Product quantity incremented', 'product', id.toString(), {
        incrementBy: quantity,
        reason: 'refund_or_restock'
      });

      return this.findById(id) as Promise<Product>;
    } catch (error) {
      logger.error('Failed to increment product quantity', { error, id, quantity });
      throw error;
    }
  }

  async getInventoryStatus(id: number): Promise<InventoryStatus> {
    try {
      const product = await this.findById(id);
      if (!product) {
        throw new Error('Product not found');
      }

      const soldQuantity = product.total_quantity - product.available_quantity;
      const stockPercentage = Math.round((product.available_quantity / product.total_quantity) * 100);

      return {
        productId: product.id,
        name: product.name,
        totalQuantity: product.total_quantity,
        availableQuantity: product.available_quantity,
        soldQuantity,
        isAvailable: product.available_quantity > 0,
        stockPercentage
      };
    } catch (error) {
      logger.error('Failed to get inventory status', { error, id });
      throw error;
    }
  }

  async getFlashSaleInventory(flashSaleId: number): Promise<InventoryStatus[]> {
    try {
      const products = await this.findByFlashSaleId(flashSaleId);
      
      return products.map(product => {
        const soldQuantity = product.total_quantity - product.available_quantity;
        const stockPercentage = Math.round((product.available_quantity / product.total_quantity) * 100);

        return {
          productId: product.id,
          name: product.name,
          totalQuantity: product.total_quantity,
          availableQuantity: product.available_quantity,
          soldQuantity,
          isAvailable: product.available_quantity > 0,
          stockPercentage
        };
      });
    } catch (error) {
      logger.error('Failed to get flash sale inventory', { error, flashSaleId });
      throw error;
    }
  }

  async update(id: number, updates: Partial<{
    name: string;
    description: string;
    price: number;
    totalQuantity: number;
  }>): Promise<Product> {
    try {
      const fields: string[] = [];
      const values: unknown[] = [];

      if (updates.name !== undefined) {
        if (updates.name.trim().length === 0) {
          throw new Error('Product name cannot be empty');
        }
        fields.push('name = ?');
        values.push(updates.name.trim());
      }

      if (updates.description !== undefined) {
        fields.push('description = ?');
        values.push(updates.description.trim());
      }

      if (updates.price !== undefined) {
        if (updates.price <= 0) {
          throw new Error('Product price must be greater than 0');
        }
        fields.push('price = ?');
        values.push(updates.price);
      }

      if (updates.totalQuantity !== undefined) {
        const currentProduct = await this.findById(id);
        if (!currentProduct) {
          throw new Error('Product not found');
        }

        if (updates.totalQuantity <= 0) {
          throw new Error('Total quantity must be greater than 0');
        }

        const soldQuantity = currentProduct.total_quantity - currentProduct.available_quantity;
        if (updates.totalQuantity < soldQuantity) {
          throw new Error(`Cannot reduce total quantity below sold quantity (${soldQuantity})`);
        }

        fields.push('total_quantity = ?');
        values.push(updates.totalQuantity);

        // Adjust available quantity if needed
        const newAvailableQuantity = updates.totalQuantity - soldQuantity;
        if (newAvailableQuantity !== currentProduct.available_quantity) {
          fields.push('available_quantity = ?');
          values.push(newAvailableQuantity);
        }
      }

      if (fields.length === 0) {
        throw new Error('No valid fields to update');
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      const sql = `UPDATE products SET ${fields.join(', ')} WHERE id = ?`;
      const result = await database.run(sql, values);

      if (result.changes === 0) {
        throw new Error('Product not found');
      }

      logger.audit('Product updated', 'product', id.toString(), updates);

      return this.findById(id) as Promise<Product>;
    } catch (error) {
      logger.error('Failed to update product', { error, id, updates });
      throw error;
    }
  }

  async delete(id: number): Promise<void> {
    try {
      await database.beginTransaction();

      // Check if there are any purchases for this product
      const purchaseCheckSql = 'SELECT COUNT(*) as count FROM purchases WHERE product_id = ?';
      const purchaseCount = await database.get(purchaseCheckSql, [id]) as { count: number };

      if (purchaseCount.count > 0) {
        await database.rollback();
        throw new Error('Cannot delete product with existing purchases');
      }

      const sql = 'DELETE FROM products WHERE id = ?';
      const result = await database.run(sql, [id]);

      if (result.changes === 0) {
        await database.rollback();
        throw new Error('Product not found');
      }

      await database.commit();

      logger.audit('Product deleted', 'product', id.toString());
    } catch (error) {
      await database.rollback();
      logger.error('Failed to delete product', { error, id });
      throw error;
    }
  }

  async checkLowStock(flashSaleId: number, threshold: number = 10): Promise<Product[]> {
    try {
      const sql = `
        SELECT * FROM products 
        WHERE flash_sale_id = ? 
        AND available_quantity <= ? 
        AND available_quantity > 0
        ORDER BY available_quantity ASC
      `;

      const lowStockProducts = await database.all(sql, [flashSaleId, threshold]) as Product[];

      if (lowStockProducts.length > 0) {
        logger.info('Low stock products detected', {
          flashSaleId,
          count: lowStockProducts.length,
          products: lowStockProducts.map(p => ({ id: p.id, name: p.name, stock: p.available_quantity }))
        });
      }

      return lowStockProducts;
    } catch (error) {
      logger.error('Failed to check low stock', { error, flashSaleId, threshold });
      throw error;
    }
  }
}

export default ProductModel;
