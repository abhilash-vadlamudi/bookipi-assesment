import axios, { AxiosResponse } from 'axios';
import { FlashSaleModel } from '../src/models/FlashSale';
import database from '../src/models/database';
import logger from '../src/utils/logger';

interface SeedData {
  users: Array<{
    email: string;
    password: string;
    confirmPassword: string;
    role: 'admin' | 'user';
    name: string;
    timezone?: string;
  }>;
  products: Array<{
    name: string;
    description: string;
    price: number;
    category: string;
    imageUrl?: string;
  }>;
  flashSales: Array<{
    name: string;
    startTime: string;
    endTime: string;
    products: Array<{
      name: string;
      description: string;
      price: number;
      totalQuantity: number;
    }>;
  }>;
}

const seedData: SeedData = {
  users: [
    {
      email: 'admin@flashsale.com',
      password: 'AdminSecure2025!',
      confirmPassword: 'AdminSecure2025!',
      role: 'admin',
      name: 'Flash Sale Admin',
      timezone: 'Australia/Sydney'
    },
    {
      email: 'user1@example.com',
      password: 'UserPass2025!',
      confirmPassword: 'UserPass2025!',
      role: 'user',
      name: 'John Doe',
      timezone: 'Australia/Sydney'
    },
    {
      email: 'user2@example.com',
      password: 'UserPass2026!',
      confirmPassword: 'UserPass2026!',
      role: 'user',
      name: 'Jane Smith',
      timezone: 'Australia/Sydney'
    },
    {
      email: 'user3@example.com',
      password: 'UserPass2027!',
      confirmPassword: 'UserPass2027!',
      role: 'user',
      name: 'Bob Wilson',
      timezone: 'Australia/Sydney'
    },
    {
      email: 'admin2@flashsale.com',
      password: 'AdminSecure2026!',
      confirmPassword: 'AdminSecure2026!',
      role: 'admin',
      name: 'Marketing Manager',
      timezone: 'Australia/Sydney'
    }
  ],
  products: [
    {
      name: 'Premium Wireless Headphones',
      description: 'High-quality noise-cancelling wireless headphones with 30-hour battery life',
      price: 299.99,
      category: 'Electronics',
      imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'
    },
    {
      name: 'Smartphone X Pro',
      description: 'Latest flagship smartphone with advanced camera and AI features',
      price: 899.99,
      category: 'Electronics',
      imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500'
    },
    {
      name: 'Gaming Laptop Elite',
      description: 'High-performance gaming laptop with RTX graphics and 144Hz display',
      price: 1499.99,
      category: 'Computers',
      imageUrl: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=500'
    },
    {
      name: 'Smart Fitness Watch',
      description: 'Advanced fitness tracker with heart rate monitoring and GPS',
      price: 199.99,
      category: 'Wearables',
      imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500'
    },
    {
      name: 'Wireless Charging Pad',
      description: 'Fast wireless charging pad compatible with all Qi-enabled devices',
      price: 49.99,
      category: 'Accessories',
      imageUrl: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=500'
    },
    {
      name: 'Bluetooth Speaker Pro',
      description: 'Portable Bluetooth speaker with 360-degree sound and waterproof design',
      price: 129.99,
      category: 'Audio',
      imageUrl: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500'
    },
    {
      name: 'Smart Home Hub',
      description: 'Central hub for controlling all your smart home devices',
      price: 149.99,
      category: 'Smart Home',
      imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500'
    },
    {
      name: 'Drone Camera Pro',
      description: '4K camera drone with intelligent flight modes and obstacle avoidance',
      price: 799.99,
      category: 'Photography',
      imageUrl: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=500'
    }
  ],
  flashSales: [
    {
      name: 'Premium Headphones Flash Sale',
      startTime: new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '), // Starts in 10 minutes
      endTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '), // Ends in 6 hours
      products: [
        {
          name: 'Premium Wireless Headphones',
          description: 'High-quality noise-cancelling wireless headphones with 30-hour battery life',
          price: 199.99, // Discounted from 299.99
          totalQuantity: 50
        }
      ]
    },
    {
      name: 'Smartphone Flash Sale',
      startTime: new Date(Date.now() + 15 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '), // Starts in 15 minutes
      endTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '), // Ends in 8 hours
      products: [
        {
          name: 'Smartphone X Pro',
          description: 'Latest flagship smartphone with advanced camera and AI features',
          price: 699.99, // Discounted from 899.99
          totalQuantity: 25
        }
      ]
    },
    {
      name: 'Wireless Charging Flash Sale',
      startTime: new Date(Date.now() + 20 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '), // Starts in 20 minutes
      endTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '), // Ends in 4 hours
      products: [
        {
          name: 'Wireless Charging Pad',
          description: 'Fast wireless charging pad compatible with all Qi-enabled devices',
          price: 29.99, // Discounted from 49.99
          totalQuantity: 100
        }
      ]
    },
    {
      name: 'Gaming Laptop Weekend Special',
      startTime: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '), // Starts in 1 hour
      endTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '), // Ends in 25 hours
      products: [
        {
          name: 'Gaming Laptop Elite',
          description: 'High-performance gaming laptop with RTX graphics and 144Hz display',
          price: 1199.99, // Discounted from 1499.99
          totalQuantity: 10
        }
      ]
    },
    {
      name: 'Bluetooth Speaker Flash Sale',
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '), // Starts in 2 hours
      endTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '), // Ends in 12 hours
      products: [
        {
          name: 'Bluetooth Speaker Pro',
          description: 'Portable Bluetooth speaker with 360-degree sound and waterproof design',
          price: 89.99, // Discounted from 129.99
          totalQuantity: 30
        }
      ]
    },
    {
      name: 'Fitness Watch Flash Sale',
      startTime: new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '), // Starts in 5 minutes
      endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '), // Ends in 2 hours
      products: [
        {
          name: 'Smart Fitness Watch',
          description: 'Advanced fitness tracker with heart rate monitoring and GPS',
          price: 149.99, // Discounted from 199.99
          totalQuantity: 15
        }
      ]
    },
    {
      name: 'Smart Home Hub Flash Sale',
      startTime: new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '), // Starts in 30 minutes
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '), // Ends in 3 hours
      products: [
        {
          name: 'Smart Home Hub',
          description: 'Central hub for controlling all your smart home devices',
          price: 99.99, // Discounted from 149.99
          totalQuantity: 20
        }
      ]
    },
    {
      name: 'Drone Camera Mega Sale',
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '), // Starts tomorrow
      endTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '), // Ends in 2 days
      products: [
        {
          name: 'Drone Camera Pro',
          description: '4K camera drone with intelligent flight modes and obstacle avoidance',
          price: 599.99, // Discounted from 799.99
          totalQuantity: 5
        }
      ]
    }
  ]
};

class DatabaseSeeder {
  private baseUrl: string;
  private adminToken: string | null = null;
  private flashSaleModel: FlashSaleModel;

  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.flashSaleModel = new FlashSaleModel();
  }

  async seed(): Promise<void> {
    try {
      console.log('🌱 Starting database seeding...');

      // Wait for server to be ready
      await this.waitForServer();

      // Clear existing data
      await this.clearDatabase();

      // Seed users through API
      console.log('👥 Creating users...');
      const users = await this.seedUsers();

      // Setup admin token
      if (users.length > 0) {
        await this.setupAdminToken();
      }

      // Seed flash sales with products using admin API
      console.log('⚡ Creating flash sales with products...');
      const flashSales = await this.seedFlashSales();

      console.log('✅ Database seeding completed successfully!');
      console.log('\n📊 Seeded Data Summary:');
      console.log(`   Users: ${users.length} (${users.filter(u => u.role === 'admin').length} admins, ${users.filter(u => u.role === 'user').length} regular users)`);
      console.log(`   Flash Sales: ${flashSales.length}`);
      
      console.log('\n🔐 Test Accounts:');
      console.log('   Admin: admin@flashsale.com / AdminSecure2025!');
      console.log('   User: user1@example.com / UserPass2025!');
      console.log('   User: user2@example.com / UserPass2026!');
      console.log('   User: user3@example.com / UserPass2027!');

    } catch (error) {
      console.error('❌ Database seeding failed:', error);
      throw error;
    }
  }

  private async waitForServer(): Promise<void> {
    const maxAttempts = 30;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        await axios.get(`${this.baseUrl}/health`);
        console.log('✅ Server is ready');
        return;
      } catch (error) {
        attempts++;
        console.log(`⏳ Waiting for server... (${attempts}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error('Server did not start within expected time');
  }

  private async clearDatabase(): Promise<void> {
    console.log('🧹 Clearing existing data...');
    
    const tables = [
      'purchases', 
      'products',
      'flash_sales',
      'users',
      'audit_logs',
      'api_keys'
    ];

    for (const table of tables) {
      try {
        await database.run(`DELETE FROM ${table}`);
        await database.run(`UPDATE sqlite_sequence SET seq = 0 WHERE name = ?`, [table]);
      } catch (error) {
        // Table might not exist, continue
        console.log(`   Skipped ${table} (table might not exist)`);
      }
    }
  }

  private async seedUsers(): Promise<any[]> {
    const users: any[] = [];
    
    for (const userData of seedData.users) {
      try {
        const response = await axios.post(`${this.baseUrl}/api/auth/register`, {
          email: userData.email,
          password: userData.password,
          confirmPassword: userData.confirmPassword,
          timezone: userData.timezone || 'UTC'
        });

        const user = response.data.data;
        
        // Update user role if it's admin (direct database update)
        if (userData.role === 'admin') {
          await database.run(
            'UPDATE users SET role = ? WHERE email = ?',
            [userData.role, userData.email]
          );
          user.role = userData.role;
        }

        users.push({ ...user, role: userData.role });
        console.log(`   ✓ Created ${userData.role}: ${userData.email}`);
      } catch (error: any) {
        console.error(`   ❌ Failed to create user ${userData.email}:`, error.response?.data?.error || error.message);
      }
    }

    return users;
  }

  private async setupAdminToken(): Promise<void> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/auth/login`, {
        email: 'admin@flashsale.com',
        password: 'AdminSecure2025!'
      });

      this.adminToken = response.data.data.token;
      console.log('🔐 Admin token obtained');
    } catch (error: any) {
      console.error('❌ Failed to get admin token:', error.response?.data?.error || error.message);
      throw error;
    }
  }

  private async seedFlashSales(): Promise<any[]> {
    const flashSales: any[] = [];
    
    if (!this.adminToken) {
      console.error('❌ No admin token available for creating flash sales');
      return flashSales;
    }

    for (const flashSaleData of seedData.flashSales) {
      try {
        const response = await axios.post(
          `${this.baseUrl}/api/flash-sales/admin/create`,
          {
            name: flashSaleData.name,
            startTime: flashSaleData.startTime,
            endTime: flashSaleData.endTime,
            products: flashSaleData.products
          },
          {
            headers: {
              'Authorization': `Bearer ${this.adminToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const flashSale = response.data.data;
        flashSales.push(flashSale);
        console.log(`   ✓ Created flash sale: ${flashSaleData.name} (${flashSaleData.products.length} products)`);
      } catch (error: any) {
        console.error(`   ❌ Failed to create flash sale ${flashSaleData.name}:`, error.response?.data?.error || error.message);
      }
    }

    return flashSales;
  }
}

// Main execution
async function main() {
  try {
    const seeder = new DatabaseSeeder();
    await seeder.seed();
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export default DatabaseSeeder;
