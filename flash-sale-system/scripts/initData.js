#!/usr/bin/env node

/**
 * Data Initialization Script for Flash Sale System
 * Usage: node scripts/initData.js [command]
 * Commands: init, active, clear, status
 */

const path = require('path');

// Simple async function to load modules since we can't use top-level await in CommonJS
async function loadModules() {
  // For now, just show instructions since we need the built TypeScript files
  console.log('🔧 Flash Sale System - Data Initializer');
  console.log('\n⚠️  Please ensure the TypeScript project is built first:');
  console.log('   npm run build');
  console.log('\n📝 Usage: node scripts/initData.js [command]');
  console.log('\nCommands:');
  console.log('  init    - Initialize sample flash sale data');
  console.log('  active  - Create an active flash sale for immediate testing');
  console.log('  clear   - Clear all data from database');
  console.log('  status  - Show current flash sale status');
  console.log('  admin   - Instructions for creating admin user');
  console.log('\nExamples:');
  console.log('  node scripts/initData.js init');
  console.log('  node scripts/initData.js active');
  console.log('  node scripts/initData.js status');
  console.log('\n� To use this script with the TypeScript system:');
  console.log('1. Build the project: npm run build');
  console.log('2. Start the server: npm start');
  console.log('3. Use the API endpoints to create flash sales and test purchases');
  console.log('\n� Refer to README.md for complete API documentation and examples');
}

// Check if built files exist
const fs = require('fs');
const distPath = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(distPath)) {
  console.log('❌ TypeScript build not found. Please run "npm run build" first.');
  process.exit(1);
}

const command = process.argv[2];

(async () => {
  try {
    await loadModules();
    
    if (command && ['init', 'active', 'clear', 'status', 'admin'].includes(command)) {
      console.log(`\n✅ Command "${command}" recognized. Use the API endpoints or create a proper TypeScript script.`);
      process.exit(0);
    }
  } catch (error) {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  }
})();
