#!/usr/bin/env node

/**
 * Load Testing Script for TypeScript Flash Sale System
 * Tests authentication, purchase concurrency, and data integrity
 * Usage: node scripts/loadTest.js [concurrent|staggered] [userCount] [staggerMs]
 */

const axios = require('axios');
const crypto = require('crypto');

class LoadTester {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.results = {
      successful: 0,
      failed: 0,
      outOfStock: 0,
      duplicatePurchase: 0,
      authErrors: 0,
      validationErrors: 0,
      errors: []
    };
    this.adminToken = null;
    this.userTokens = new Map(); // Map userId -> token
  }

  /**
   * Register and login an admin user for creating flash sales
   */
  async setupAdminUser() {
    try {
      console.log('🔐 Setting up admin user...');
      
      const adminEmail = `admin_${crypto.randomBytes(8).toString('hex')}@loadtest.com`;
      const adminPassword = 'LoadTestAdmin123!';

      // Register admin user
      await axios.post(`${this.baseUrl}/api/auth/register`, {
        email: adminEmail,
        password: adminPassword,
        confirmPassword: adminPassword
      });

      // Login to get token
      const loginResponse = await axios.post(`${this.baseUrl}/api/auth/login`, {
        email: adminEmail,
        password: adminPassword
      });

      this.adminToken = loginResponse.data.data.token;
      console.log('✅ Admin user authenticated');
      
    } catch (error) {
      console.error('❌ Failed to setup admin user:', error.response?.data?.error?.message || error.message);
      throw error;
    }
  }

  /**
   * Register and authenticate a user for load testing
   */
  async createTestUser(userId) {
    try {
      const email = `${userId}@loadtest.com`;
      const password = 'LoadTestUser123!';

      // Register user
      await axios.post(`${this.baseUrl}/api/auth/register`, {
        email,
        password,
        confirmPassword: password
      });

      // Login to get token
      const loginResponse = await axios.post(`${this.baseUrl}/api/auth/login`, {
        email,
        password
      });

      const token = loginResponse.data.data.token;
      this.userTokens.set(userId, token);
      
      return { success: true, token };
      
    } catch (error) {
      this.results.authErrors++;
      this.results.errors.push(`Auth ${userId}: ${error.response?.data?.error?.message || error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create an active flash sale for load testing
   */
  async createActiveFlashSale() {
    try {
      console.log('🔥 Creating active flash sale for load testing...');
      
      const now = new Date();
      const startTime = new Date(now.getTime() - 60000).toISOString(); // Started 1 minute ago
      const endTime = new Date(now.getTime() + 3600000).toISOString(); // Ends in 1 hour

      const flashSaleData = {
        name: 'Load Test Flash Sale',
        startTime,
        endTime,
        products: [
          {
            name: 'High-Demand Test Item',
            description: 'Limited quantity item for load testing race conditions',
            price: 99.99,
            quantity: 50 // Limited quantity to test race conditions
          }
        ]
      };

      const response = await axios.post(
        `${this.baseUrl}/api/flash-sale/admin/create`, 
        flashSaleData,
        {
          headers: {
            'Authorization': `Bearer ${this.adminToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ Flash sale created with ${flashSaleData.products[0].quantity} items`);
      return response.data.data;

    } catch (error) {
      console.error('❌ Failed to create flash sale:', error.response?.data?.error?.message || error.message);
      throw error;
    }
  }

  /**
   * Attempt a purchase for a given user
   */
  async attemptPurchase(userId, productId = 1) {
    try {
      const token = this.userTokens.get(userId);
      if (!token) {
        throw new Error('User not authenticated');
      }

      const response = await axios.post(
        `${this.baseUrl}/api/flash-sale/purchase`,
        {
          userId: userId,
          productId: productId
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.status === 200 || response.status === 201) {
        this.results.successful++;
        return { success: true, userId };
      }

    } catch (error) {
      if (error.response) {
        const errorData = error.response.data;
        const message = errorData.error?.message || errorData.message || 'Unknown error';
        
        if (message.includes('out of stock') || message.includes('insufficient inventory')) {
          this.results.outOfStock++;
        } else if (message.includes('already purchased') || message.includes('duplicate')) {
          this.results.duplicatePurchase++;
        } else if (error.response.status === 401 || error.response.status === 403) {
          this.results.authErrors++;
        } else if (error.response.status === 400) {
          this.results.validationErrors++;
        } else {
          this.results.failed++;
          this.results.errors.push(`${userId}: ${message}`);
        }
      } else {
        this.results.failed++;
        this.results.errors.push(`${userId}: ${error.message}`);
      }
      
      return { success: false, userId, error: error.message };
    }
  }

  /**
   * Run concurrent purchase test
   */
  async runConcurrentPurchases(userCount = 100) {
    console.log(`\n🚀 Starting concurrent load test with ${userCount} users...`);
    const startTime = Date.now();

    // Create array of user IDs
    const userIds = Array.from({ length: userCount }, (_, i) => `concurrent_user_${i + 1}`);

    // Authenticate all users first
    console.log('🔐 Authenticating users...');
    const authPromises = userIds.map(userId => this.createTestUser(userId));
    await Promise.all(authPromises);

    const authenticatedUsers = userIds.filter(userId => this.userTokens.has(userId));
    console.log(`✅ ${authenticatedUsers.length}/${userCount} users authenticated`);

    if (authenticatedUsers.length === 0) {
      throw new Error('No users were successfully authenticated');
    }

    // Wait a moment for rate limiters to reset
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('💰 Starting purchase attempts...');
    
    // Create promises for all purchase attempts
    const purchasePromises = authenticatedUsers.map(userId => this.attemptPurchase(userId));

    // Execute all purchases concurrently
    await Promise.all(purchasePromises);

    const endTime = Date.now();
    const duration = endTime - startTime;

    this.printResults(duration, userCount);
  }

  /**
   * Run staggered purchase test
   */
  async runStaggeredPurchases(userCount = 100, staggerMs = 50) {
    console.log(`\n🚀 Starting staggered load test with ${userCount} users (${staggerMs}ms intervals)...`);
    const startTime = Date.now();

    // Create and authenticate users first
    const userIds = Array.from({ length: userCount }, (_, i) => `staggered_user_${i + 1}`);
    
    console.log('🔐 Authenticating users...');
    const authPromises = userIds.map(userId => this.createTestUser(userId));
    await Promise.all(authPromises);

    const authenticatedUsers = userIds.filter(userId => this.userTokens.has(userId));
    console.log(`✅ ${authenticatedUsers.length}/${userCount} users authenticated`);

    if (authenticatedUsers.length === 0) {
      throw new Error('No users were successfully authenticated');
    }

    console.log('💰 Starting staggered purchase attempts...');

    const promises = [];
    
    for (let i = 0; i < authenticatedUsers.length; i++) {
      const userId = authenticatedUsers[i];
      
      // Stagger the requests
      promises.push(
        new Promise(resolve => {
          setTimeout(async () => {
            const result = await this.attemptPurchase(userId);
            resolve(result);
          }, i * staggerMs);
        })
      );
    }

    await Promise.all(promises);

    const endTime = Date.now();
    const duration = endTime - startTime;

    this.printResults(duration, userCount);
  }

  /**
   * Print detailed test results
   */
  printResults(duration, userCount) {
    const totalRequests = this.results.successful + this.results.failed + 
                         this.results.outOfStock + this.results.duplicatePurchase +
                         this.results.authErrors + this.results.validationErrors;
    const throughput = Math.round((totalRequests / duration) * 1000); // requests per second

    console.log('\n=== 📊 LOAD TEST RESULTS ===');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`👥 Total Users: ${userCount}`);
    console.log(`📊 Total Requests: ${totalRequests}`);
    console.log(`🚀 Throughput: ${throughput} requests/second`);
    
    console.log('\n--- 💰 Purchase Results ---');
    console.log(`✅ Successful: ${this.results.successful}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📦 Out of Stock: ${this.results.outOfStock}`);
    console.log(`🔄 Duplicate Purchase: ${this.results.duplicatePurchase}`);
    console.log(`🔐 Auth Errors: ${this.results.authErrors}`);
    console.log(`⚠️  Validation Errors: ${this.results.validationErrors}`);
    
    console.log('\n--- 🎯 System Performance ---');
    console.log(`📊 Average Response Time: ${Math.round(duration / totalRequests)}ms`);
    console.log(`✅ Success Rate: ${Math.round((this.results.successful / totalRequests) * 100)}%`);
    console.log(`🛡️  Security Rate: ${Math.round(((this.results.outOfStock + this.results.duplicatePurchase) / totalRequests) * 100)}%`);
    
    if (this.results.errors.length > 0) {
      console.log('\n--- ❌ Errors (first 10) ---');
      this.results.errors.slice(0, 10).forEach(error => console.log(`  ${error}`));
      if (this.results.errors.length > 10) {
        console.log(`  ... and ${this.results.errors.length - 10} more errors`);
      }
    }

    // Data integrity assessment
    console.log('\n--- 🔍 Data Integrity Assessment ---');
    console.log(`Expected behavior: Only ${this.results.successful} purchases should be recorded in database`);
    console.log(`Race condition handling: ${this.results.outOfStock > 0 ? '✅ Working (prevented overselling)' : '⚠️ Needs verification'}`);
    console.log(`Duplicate prevention: ${this.results.duplicatePurchase === 0 ? '✅ Working (no duplicates)' : '❌ Failed (duplicates found)'}`);
    console.log(`Authentication security: ${this.results.authErrors === 0 ? '✅ Secure' : '⚠️ Some auth issues'}`);
  }

  /**
   * Check if server is running
   */
  async checkServer() {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Reset results for new test
   */
  resetResults() {
    this.results = {
      successful: 0,
      failed: 0,
      outOfStock: 0,
      duplicatePurchase: 0,
      authErrors: 0,
      validationErrors: 0,
      errors: []
    };
    this.userTokens.clear();
  }
}

// CLI functionality
const tester = new LoadTester();
const testType = process.argv[2] || 'concurrent';
const userCount = parseInt(process.argv[3]) || 100;

(async () => {
  try {
    console.log('🚀 TypeScript Flash Sale System - Load Tester');
    console.log('================================================');
    
    // Check if server is running
    console.log('🔍 Checking server status...');
    const serverRunning = await tester.checkServer();
    
    if (!serverRunning) {
      console.log('❌ Server is not running or not responding at http://localhost:3000');
      console.log('💡 Please start the server first:');
      console.log('   npm run build');
      console.log('   npm start');
      process.exit(1);
    }
    
    console.log('✅ Server is running and responsive');

    if (testType === 'concurrent') {
      await tester.setupAdminUser();
      await tester.createActiveFlashSale();
      await new Promise(resolve => setTimeout(resolve, 1500));
      await tester.runConcurrentPurchases(userCount);
    } else if (testType === 'staggered') {
      const staggerMs = parseInt(process.argv[4]) || 50;
      await tester.setupAdminUser();
      await tester.createActiveFlashSale();
      await new Promise(resolve => setTimeout(resolve, 1500));
      await tester.runStaggeredPurchases(userCount, staggerMs);
    } else {
      console.log('\n🔧 Usage:');
      console.log('  node scripts/loadTest.js concurrent [userCount]');
      console.log('  node scripts/loadTest.js staggered [userCount] [staggerMs]');
      console.log('\nExamples:');
      console.log('  node scripts/loadTest.js concurrent 100    # 100 users buying simultaneously');
      console.log('  node scripts/loadTest.js staggered 200 25  # 200 users with 25ms between requests');
      console.log('\nPrerequisites:');
      console.log('  1. Build the project: npm run build');
      console.log('  2. Start the server: npm start');
      console.log('  3. Run load test: node scripts/loadTest.js concurrent 50');
      process.exit(1);
    }
    
    console.log('\n🏁 Load test completed successfully!');
    
  } catch (error) {
    console.error('\n💥 Load test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
})();
