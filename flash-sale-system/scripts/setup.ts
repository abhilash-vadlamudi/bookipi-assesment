#!/usr/bin/env ts-node

import { spawn } from 'child_process';
import path from 'path';
import axios from 'axios';

/**
 * Database Setup Script
 * 
 * This script:
 * 1. Compiles TypeScript to JavaScript
 * 2. Starts the server briefly to initialize the database
 * 3. Runs the seed script to populate sample data
 * 4. Shuts down the server
 */

class SetupManager {
  private serverProcess: any = null;
  private readonly baseUrl = 'http://localhost:3000';

  async setup(): Promise<void> {
    console.log('🚀 Starting Flash Sale System Setup...\n');

    try {
      // Step 1: Build the project
      console.log('📦 Building TypeScript project...');
      await this.runCommand('npm', ['run', 'build']);
      console.log('✅ Build completed\n');

      // Step 2: Start server to initialize database
      console.log('🗄️  Initializing database...');
      await this.startServer();
      await this.waitForServer();
      console.log('✅ Database initialized\n');

      // Step 3: Run seed script
      console.log('🌱 Seeding database with sample data...');
      await this.runSeedScript();
      console.log('✅ Database seeded successfully\n');

      // Step 4: Clean up
      await this.stopServer();

      console.log('🎉 Setup completed successfully!');
      console.log('\n📋 Next steps:');
      console.log('   1. Start backend: npm start (or npm run dev)');
      console.log('   2. Start frontend: cd ../flash-sale-frontend && npm start');
      console.log('   3. Open browser: http://localhost:3001');
      console.log('\n🔐 Test accounts created:');
      console.log('   Admin: admin@flashsale.com / AdminSecure2025!');
      console.log('   User:  user1@example.com / UserPass2025!');

    } catch (error) {
      console.error('❌ Setup failed:', error);
      await this.stopServer();
      process.exit(1);
    }
  }

  private async runCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        stdio: 'inherit',
        shell: true,
        cwd: path.join(__dirname, '..')
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async startServer(): Promise<void> {
    return new Promise((resolve) => {
      this.serverProcess = spawn('npm', ['start'], {
        stdio: 'pipe', // Capture output
        shell: true,
        cwd: path.join(__dirname, '..')
      });

      // Wait a bit for server to start
      setTimeout(resolve, 3000);
    });
  }

  private async waitForServer(): Promise<void> {
    const maxAttempts = 30;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        await axios.get(`${this.baseUrl}/health`, { timeout: 1000 });
        console.log('   ✓ Server is running and database is ready');
        return;
      } catch (error) {
        attempts++;
        if (attempts % 5 === 0) {
          process.stdout.write(`   ⏳ Waiting for server... (${attempts}/${maxAttempts})\n`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error('Server did not respond within expected time');
  }

  private async runSeedScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      const seedProcess = spawn('ts-node', ['scripts/seed.ts'], {
        stdio: 'inherit',
        shell: true,
        cwd: path.join(__dirname, '..')
      });

      seedProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Seed script failed with exit code ${code}`));
        }
      });

      seedProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async stopServer(): Promise<void> {
    if (this.serverProcess) {
      console.log('🛑 Stopping server...');
      this.serverProcess.kill('SIGTERM');
      
      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Force kill if still running
      if (!this.serverProcess.killed) {
        this.serverProcess.kill('SIGKILL');
      }
      
      this.serverProcess = null;
    }
  }
}

// Main execution
async function main() {
  const setupManager = new SetupManager();
  await setupManager.setup();
}

// Handle process interruption
process.on('SIGINT', async () => {
  console.log('\n⚠️  Setup interrupted. Cleaning up...');
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Setup terminated. Cleaning up...');
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}

export default SetupManager;
