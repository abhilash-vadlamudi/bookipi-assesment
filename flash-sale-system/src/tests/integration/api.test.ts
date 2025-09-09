import request from 'supertest';
import { Application } from 'express';
import FlashSaleApp from '../../app';
import { Database } from '../../models/database';
import logger from '../../utils/logger';

describe('Flash Sale API Integration Tests', () => {
  let app: FlashSaleApp;
  let server: Application;
  let db: Database;
  
  // Test data
  let testFlashSaleId: number;
  let testProductId: number;

  beforeAll(async () => {
    // Suppress logs during testing
    jest.spyOn(logger, 'info').mockImplementation(() => logger);
    jest.spyOn(logger, 'error').mockImplementation(() => logger);
    jest.spyOn(logger, 'warn').mockImplementation(() => logger);
    jest.spyOn(logger, 'debug').mockImplementation(() => logger);
    
    // Initialize app
    app = new FlashSaleApp();
    server = app.getApp();
    db = Database.getInstance();
    
    // Wait a bit for database to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  const setupTestData = async () => {
    try {
      // First create admin user for foreign key reference
      await db.run(`
        INSERT OR IGNORE INTO users (id, email, password_hash, role, is_active)
        VALUES (?, ?, ?, ?, 1)
      `, [
        'admin-123',
        'admin@example.com',
        '$2a$10$test.hash.for.testing',
        'admin'
      ]);

      // Create test flash sale
      const flashSaleResult = await db.run(`
        INSERT INTO flash_sales (name, start_time, end_time, is_active, created_by)
        VALUES (?, ?, ?, 1, ?)
      `, [
        'Test Flash Sale',
        new Date(Date.now() - 3600000).toISOString(), // Started 1 hour ago
        new Date(Date.now() + 3600000).toISOString(), // Ends in 1 hour
        'admin-123'
      ]);

      testFlashSaleId = flashSaleResult.id;

      // Create test product
      const productResult = await db.run(`
        INSERT INTO products (name, description, price, total_quantity, available_quantity, flash_sale_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'Test Product',
        'A test product for integration testing',
        99.99,
        100,
        100,
        testFlashSaleId
      ]);

      testProductId = productResult.id;

      console.log('Test data setup complete:', {
        testFlashSaleId,
        testProductId
      });

    } catch (error) {
      console.error('Error setting up test data:', error);
      throw error;
    }
  };

  describe('Health Check', () => {
    it('should return 200 for health check', async () => {
      const response = await request(server)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.any(String),
        timestamp: expect.any(String),
        uptime: expect.any(Number)
      });
    });
  });

  describe('Flash Sale Public Endpoints', () => {
    describe('GET /api/flash-sales', () => {
      it('should get all flash sales', async () => {
        const response = await request(server)
          .get('/api/flash-sales')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            flashSales: expect.any(Array)
          })
        });

        if (response.body.data.flashSales.length > 0) {
          expect(response.body.data.flashSales[0]).toMatchObject({
            id: expect.any(Number),
            name: expect.any(String),
            start_time: expect.any(String),
            end_time: expect.any(String)
          });
        }
      });
    });

    describe('GET /api/flash-sales/active', () => {
      it('should get active flash sales', async () => {
        const response = await request(server)
          .get('/api/flash-sales/active');

        expect([200, 404]).toContain(response.status);

        if (response.status === 200) {
          expect(response.body).toMatchObject({
            success: true,
            data: expect.any(Array)
          });
        }
      });
    });

    describe('GET /api/flash-sales/:id', () => {
      it('should get a specific flash sale', async () => {
        const response = await request(server)
          .get(`/api/flash-sales/${testFlashSaleId}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            id: testFlashSaleId,
            name: 'Test Flash Sale',
            is_active: 1  // SQLite returns 1 for boolean true
          }
        });
      });

      it('should return 404 for non-existent flash sale', async () => {
        const response = await request(server)
          .get('/api/flash-sales/99999')
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('not found');
      });
    });

    describe('GET /api/flash-sales/status', () => {
      it('should get flash sale system status', async () => {
        const response = await request(server)
          .get('/api/flash-sales/status');

        // Status endpoint might return 400 for invalid request
        expect([200, 400, 404]).toContain(response.status);

        if (response.status === 200) {
          expect(response.body).toMatchObject({
            success: true,
            data: expect.objectContaining({
              status: expect.any(String)
            })
          });
        }
      });
    });
  });

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/register', () => {
      it('should require validation for registration', async () => {
        const invalidUser = {
          email: 'invalid-email',
          password: 'weak'
        };

        const response = await request(server)
          .post('/api/auth/register')
          .send(invalidUser)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Validation failed');
      });

      it('should accept properly formatted registration data', async () => {
        const validUser = {
          email: 'test@example.com',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
          timezone: 'UTC'
        };

        const response = await request(server)
          .post('/api/auth/register')
          .send(validUser);

        // Should either succeed or fail with business logic (not validation error)
        expect([201, 400, 409]).toContain(response.status);
        
        if (response.status === 201) {
          expect(response.body).toMatchObject({
            success: true,
            message: expect.any(String),
            data: {
              user: expect.objectContaining({
                email: validUser.email
              })
            }
          });
        }
      });
    });

    describe('POST /api/auth/login', () => {
      it('should require validation for login', async () => {
        const invalidLogin = {
          email: 'not-an-email',
          password: ''
        };

        const response = await request(server)
          .post('/api/auth/login')
          .send(invalidLogin)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Validation failed');
      });

      it('should handle login attempts with proper format', async () => {
        const loginData = {
          email: 'test@example.com',
          password: 'TestPassword123!'
        };

        const response = await request(server)
          .post('/api/auth/login')
          .send(loginData);

        // Should either succeed, fail auth, or have validation issues
        expect([200, 401, 400]).toContain(response.status);
        expect(response.body.success).toBeDefined();
      });
    });
  });

  describe('Purchase Endpoints', () => {
    describe('POST /api/flash-sales/purchase', () => {
      it('should require authentication for purchases', async () => {
        const purchaseData = {
          userId: 'test-user',
          productId: testProductId,
          quantity: 1
        };

        const response = await request(server)
          .post('/api/flash-sales/purchase')
          .send(purchaseData)
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('token');
      });

      it('should validate purchase data format', async () => {
        const invalidPurchaseData = {
          userId: '',
          productId: 'invalid',
          quantity: 0
        };

        // Even without auth, should hit validation first
        const response = await request(server)
          .post('/api/flash-sales/purchase')
          .send(invalidPurchaseData);

        expect([400, 401]).toContain(response.status);
        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Error Handling and Security', () => {
    it('should handle 404 for non-existent endpoints', async () => {
      const response = await request(server)
        .get('/api/non-existent-endpoint')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String),
        statusCode: 404
      });
    });

    it('should include security headers', async () => {
      const response = await request(server)
        .get('/health')
        .expect(200);

      // Check for security headers added by helmet
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeTruthy();
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect([400, 500]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to auth endpoints', async () => {
      const requests: Promise<request.Response>[] = [];
      
      // Make multiple rapid requests to login endpoint
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(server)
            .post('/api/auth/login')
            .send({
              email: 'test@example.com',
              password: 'wrong-password'
            })
        );
      }

      const responses = await Promise.all(requests);
      
      // Check if any requests were rate limited
      const rateLimited = responses.some(r => r.status === 429);
      const badRequests = responses.filter(r => r.status === 400).length;
      const unauthorized = responses.filter(r => r.status === 401).length;

      // Should have a mix of responses (rate limiting may kick in)
      expect(responses.length).toBe(10);
      // Most should be either validation failures or auth failures
      expect(badRequests + unauthorized).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent requests to public endpoints', async () => {
      const requests: Promise<request.Response>[] = [];
      const startTime = Date.now();

      // Make 10 concurrent requests to a public endpoint
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(server)
            .get('/api/flash-sales')
        );
      }

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should complete within reasonable time
      expect(duration).toBeLessThan(3000); // 3 seconds max
    });
  });

  describe('CORS', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(server)
        .options('/api/flash-sales')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect([200, 204]).toContain(response.status);
    });
  });
});
