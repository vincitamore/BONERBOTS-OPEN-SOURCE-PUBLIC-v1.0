#!/usr/bin/env node
/**
 * Database Testing Suite
 * 
 * Comprehensive testing suite for database functionality, authentication,
 * multi-tenancy, and data integrity.
 * 
 * Usage:
 *   node db-test.js [test-suite]
 * 
 * Test Suites:
 *   all                 Run all tests (default)
 *   auth                Authentication flow tests
 *   multi-tenant        Multi-tenant isolation tests
 *   consistency         Data consistency tests
 *   integrity           Database integrity tests
 *   performance         Performance benchmarks
 */

const Database = require('better-sqlite3');
const path = require('path');
const axios = require('axios');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'data', 'arena.db');
const API_BASE = process.env.API_BASE || 'http://localhost:3001';

class DatabaseTester {
  constructor(dbPath, apiBase) {
    this.dbPath = dbPath;
    this.apiBase = apiBase;
    this.db = null;
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: []
    };
  }

  connect() {
    try {
      this.db = new Database(this.dbPath, { readonly: true });
      return true;
    } catch (error) {
      console.error(`❌ Failed to connect to database: ${error.message}`);
      return false;
    }
  }

  disconnect() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  logTest(name, passed, details = '', skipped = false) {
    const status = skipped ? '⏭️ SKIP' : (passed ? '✅ PASS' : '❌ FAIL');
    console.log(`${status}: ${name}`);
    if (details) console.log(`   ${details}`);
    
    this.results.tests.push({ name, passed, details, skipped });
    if (skipped) {
      this.results.skipped++;
    } else if (passed) {
      this.results.passed++;
    } else {
      this.results.failed++;
    }
  }

  logSection(name) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(name);
    console.log('═'.repeat(70) + '\n');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== Authentication Tests ====================
  
  async testAuthentication() {
    this.logSection('AUTHENTICATION TESTS');

    // Check if server is running
    let serverRunning = false;
    try {
      await axios.get(`${this.apiBase}/health`);
      serverRunning = true;
    } catch (error) {
      serverRunning = false;
    }

    if (!serverRunning) {
      this.logTest('Server availability', false, 'Server not running - start server to run auth tests', true);
      return;
    }

    const timestamp = Date.now().toString().slice(-6);
    const testUsername = `test_${timestamp}`;
    const testPassword = 'TestPass123!';
    const testEmail = `test_${timestamp}@example.com`;

    // Test 1: User Registration
    try {
      const response = await axios.post(`${this.apiBase}/api/auth/register`, {
        username: testUsername,
        password: testPassword,
        email: testEmail
      });
      
      const hasToken = !!response.data.accessToken;
      const hasRefreshToken = !!response.data.refreshToken;
      const hasRecovery = !!response.data.recoveryPhrase;
      
      this.logTest(
        'User registration',
        hasToken && hasRefreshToken && hasRecovery,
        hasToken ? `User created: ${response.data.user.username}` : 'Missing tokens'
      );

      // Test 2: Login
      if (hasToken) {
        await this.sleep(500);
        
        const loginResponse = await axios.post(`${this.apiBase}/api/auth/login`, {
          username: testUsername,
          password: testPassword
        });
        
        this.logTest(
          'User login',
          !!loginResponse.data.accessToken,
          'Login successful'
        );

        // Test 3: Token refresh
        await this.sleep(500);
        
        const refreshResponse = await axios.post(`${this.apiBase}/api/auth/refresh`, {
          refreshToken: response.data.refreshToken
        });
        
        this.logTest(
          'Token refresh',
          !!refreshResponse.data.accessToken && refreshResponse.data.accessToken !== response.data.accessToken,
          'New token generated'
        );

        // Test 4: Protected resource access
        await this.sleep(500);
        
        try {
          await axios.get(`${this.apiBase}/api/v2/bots`, {
            headers: { 'Authorization': `Bearer ${loginResponse.data.accessToken}` }
          });
          this.logTest('Protected resource access', true, 'Successfully accessed protected endpoint');
        } catch (error) {
          this.logTest('Protected resource access', false, error.message);
        }

        // Test 5: Logout
        await this.sleep(500);
        
        const logoutResponse = await axios.post(`${this.apiBase}/api/auth/logout`, {
          refreshToken: loginResponse.data.refreshToken
        });
        
        this.logTest(
          'User logout',
          logoutResponse.status === 200,
          'Logout successful'
        );
      }
    } catch (error) {
      if (error.response?.status === 409) {
        // User already exists - try login
        try {
          const loginResponse = await axios.post(`${this.apiBase}/api/auth/login`, {
            username: testUsername,
            password: testPassword
          });
          this.logTest('User registration/login', true, 'User already existed, logged in successfully');
        } catch (loginError) {
          this.logTest('User registration', false, error.response?.data?.error || error.message);
        }
      } else {
        this.logTest('User registration', false, error.response?.data?.error || error.message);
      }
    }

    // Test 6: Invalid credentials
    try {
      await axios.post(`${this.apiBase}/api/auth/login`, {
        username: 'nonexistent_user',
        password: 'wrongpassword'
      });
      this.logTest('Invalid credentials rejection', false, 'Invalid login was accepted!');
    } catch (error) {
      this.logTest('Invalid credentials rejection', error.response?.status === 401, 'Correctly rejected');
    }
  }

  // ==================== Multi-Tenancy Tests ====================
  
  testMultiTenancy() {
    this.logSection('MULTI-TENANCY TESTS');

    if (!this.connect()) {
      return;
    }

    try {
      // Test 1: User isolation in bots table
      const usersWithBots = this.db.prepare(`
        SELECT u.id, u.username, COUNT(b.id) as bot_count
        FROM users u
        LEFT JOIN bots b ON b.user_id = u.id
        GROUP BY u.id
        HAVING bot_count > 0
      `).all();

      if (usersWithBots.length > 0) {
        let isolationPassed = true;
        
        for (const user of usersWithBots) {
          // Check if user's bots are properly isolated
          const otherUserBots = this.db.prepare(`
            SELECT COUNT(*) as count FROM bots 
            WHERE user_id != ? AND id IN (
              SELECT id FROM bots WHERE user_id = ?
            )
          `).get(user.id, user.id).count;

          if (otherUserBots > 0) {
            isolationPassed = false;
            break;
          }
        }

        this.logTest(
          'Bot ownership isolation',
          isolationPassed,
          `Checked ${usersWithBots.length} users`
        );
      } else {
        this.logTest('Bot ownership isolation', true, 'No user bots to check', true);
      }

      // Test 2: Foreign key constraints
      const fkEnabled = this.db.pragma('foreign_keys')[0].foreign_keys;
      this.logTest(
        'Foreign keys enabled',
        fkEnabled === 1,
        fkEnabled ? 'Enabled' : 'Disabled - data integrity at risk!'
      );

      // Test 3: Check for NULL user_ids in critical tables
      const criticalTables = ['bots', 'trades', 'positions', 'bot_decisions'];
      let nullCheckPassed = true;

      for (const table of criticalTables) {
        try {
          const nullCount = this.db.prepare(
            `SELECT COUNT(*) as count FROM ${table} WHERE user_id IS NULL`
          ).get().count;

          if (nullCount > 0) {
            this.logTest(
              `NULL user_id check: ${table}`,
              false,
              `Found ${nullCount} records without user_id`
            );
            nullCheckPassed = false;
          }
        } catch (error) {
          // Table might not have user_id column
        }
      }

      if (nullCheckPassed) {
        this.logTest('NULL user_id checks', true, 'All critical tables have user_id values');
      }

      // Test 4: Cross-user data access
      const users = this.db.prepare('SELECT id FROM users LIMIT 2').all();
      if (users.length >= 2) {
        const user1Bots = this.db.prepare('SELECT id FROM bots WHERE user_id = ?').all(users[0].id);
        const user2Bots = this.db.prepare('SELECT id FROM bots WHERE user_id = ?').all(users[1].id);

        const overlap = user1Bots.filter(b1 => user2Bots.some(b2 => b2.id === b1.id));

        this.logTest(
          'Cross-user bot isolation',
          overlap.length === 0,
          overlap.length === 0 ? 'No shared bots' : `${overlap.length} bots shared between users!`
        );
      } else {
        this.logTest('Cross-user bot isolation', true, 'Not enough users to test', true);
      }

    } catch (error) {
      this.logTest('Multi-tenancy tests', false, error.message);
    } finally {
      this.disconnect();
    }
  }

  // ==================== Data Consistency Tests ====================
  
  testConsistency() {
    this.logSection('DATA CONSISTENCY TESTS');

    if (!this.connect()) {
      return;
    }

    try {
      // Test 1: Bot-Trade consistency
      const bots = this.db.prepare('SELECT id, name FROM bots WHERE is_active = 1').all();
      
      if (bots.length === 0) {
        this.logTest('Bot-Trade consistency', true, 'No active bots to check', true);
      } else {
        let consistencyPassed = true;

        for (const bot of bots) {
          const dbTrades = this.db.prepare(
            'SELECT COUNT(*) as count FROM trades WHERE bot_id = ?'
          ).get(bot.id).count;

          // Check arena_state consistency (if exists)
          const arenaState = this.db.prepare('SELECT state_json FROM arena_state LIMIT 1').get();
          
          if (arenaState) {
            try {
              const state = JSON.parse(arenaState.state_json);
              const botState = Array.isArray(state.bots) 
                ? state.bots.find(b => b.id === bot.id)
                : state.bots?.[bot.id];

              if (botState) {
                const stateTrades = botState.orders?.length || 0;
                const diff = Math.abs(dbTrades - stateTrades);

                if (diff > 10) { // Allow some tolerance
                  consistencyPassed = false;
                  this.logTest(
                    `Bot consistency: ${bot.name}`,
                    false,
                    `Trade mismatch - DB: ${dbTrades}, State: ${stateTrades}`
                  );
                }
              }
            } catch (e) {
              // Ignore JSON parse errors
            }
          }
        }

        if (consistencyPassed) {
          this.logTest('Bot-Trade consistency', true, `Checked ${bots.length} bots`);
        }
      }

      // Test 2: Position-Trade consistency
      const openPositions = this.db.prepare(
        "SELECT COUNT(*) as count FROM positions WHERE status = 'open'"
      ).get().count;

      const positionsWithoutBot = this.db.prepare(`
        SELECT COUNT(*) as count FROM positions 
        WHERE bot_id NOT IN (SELECT id FROM bots)
      `).get().count;

      this.logTest(
        'Position-Bot consistency',
        positionsWithoutBot === 0,
        positionsWithoutBot === 0 
          ? `${openPositions} open positions, all linked to bots`
          : `${positionsWithoutBot} orphaned positions found!`
      );

      // Test 3: Decision-Bot consistency
      const decisionsWithoutBot = this.db.prepare(`
        SELECT COUNT(*) as count FROM bot_decisions 
        WHERE bot_id NOT IN (SELECT id FROM bots)
      `).get().count;

      this.logTest(
        'Decision-Bot consistency',
        decisionsWithoutBot === 0,
        decisionsWithoutBot === 0 
          ? 'All decisions linked to bots'
          : `${decisionsWithoutBot} orphaned decisions found!`
      );

      // Test 4: Snapshot integrity
      const snapshotsWithInvalidData = this.db.prepare(`
        SELECT COUNT(*) as count FROM bot_state_snapshots 
        WHERE total_value < 0 OR balance < 0 OR win_rate < 0 OR win_rate > 1
      `).get().count;

      this.logTest(
        'Snapshot data validity',
        snapshotsWithInvalidData === 0,
        snapshotsWithInvalidData === 0 
          ? 'All snapshot data valid'
          : `${snapshotsWithInvalidData} snapshots with invalid data!`
      );

    } catch (error) {
      this.logTest('Consistency tests', false, error.message);
    } finally {
      this.disconnect();
    }
  }

  // ==================== Database Integrity Tests ====================
  
  testIntegrity() {
    this.logSection('DATABASE INTEGRITY TESTS');

    if (!this.connect()) {
      return;
    }

    try {
      // Test 1: SQLite integrity check
      const integrityResult = this.db.pragma('integrity_check');
      const integrityPassed = integrityResult.length === 1 && integrityResult[0].integrity_check === 'ok';
      
      this.logTest(
        'SQLite integrity check',
        integrityPassed,
        integrityPassed ? 'Database file is healthy' : 'Database corruption detected!'
      );

      // Test 2: Foreign key check
      const foreignKeyResult = this.db.pragma('foreign_key_check');
      
      this.logTest(
        'Foreign key integrity',
        foreignKeyResult.length === 0,
        foreignKeyResult.length === 0 
          ? 'All foreign keys valid' 
          : `${foreignKeyResult.length} foreign key violations!`
      );

      // Test 3: Required tables exist
      const requiredTables = [
        'users', 'bots', 'llm_providers', 'trades', 'positions',
        'bot_decisions', 'bot_state_snapshots', 'system_settings'
      ];

      const existingTables = this.db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all().map(t => t.name);

      const missingTables = requiredTables.filter(t => !existingTables.includes(t));

      this.logTest(
        'Required tables exist',
        missingTables.length === 0,
        missingTables.length === 0 
          ? `All ${requiredTables.length} required tables present`
          : `Missing tables: ${missingTables.join(', ')}`
      );

      // Test 4: Index existence
      const indexes = this.db.prepare(`
        SELECT COUNT(*) as count FROM sqlite_master 
        WHERE type='index' AND name NOT LIKE 'sqlite_%'
      `).get().count;

      this.logTest(
        'Indexes present',
        indexes > 0,
        `Found ${indexes} custom indexes`
      );

      // Test 5: Check for duplicate records
      const duplicateBots = this.db.prepare(`
        SELECT id, COUNT(*) as count FROM bots GROUP BY id HAVING count > 1
      `).all();

      this.logTest(
        'No duplicate bot IDs',
        duplicateBots.length === 0,
        duplicateBots.length === 0 
          ? 'All bot IDs unique'
          : `${duplicateBots.length} duplicate bot IDs found!`
      );

    } catch (error) {
      this.logTest('Integrity tests', false, error.message);
    } finally {
      this.disconnect();
    }
  }

  // ==================== Performance Tests ====================
  
  testPerformance() {
    this.logSection('PERFORMANCE TESTS');

    if (!this.connect()) {
      return;
    }

    try {
      // Test 1: Query performance - Bot list
      const start1 = Date.now();
      this.db.prepare('SELECT * FROM bots WHERE is_active = 1').all();
      const time1 = Date.now() - start1;

      this.logTest(
        'Bot list query',
        time1 < 100,
        `Executed in ${time1}ms ${time1 >= 100 ? '(slow!)' : ''}`
      );

      // Test 2: Query performance - Trade history
      const start2 = Date.now();
      this.db.prepare('SELECT * FROM trades ORDER BY executed_at DESC LIMIT 100').all();
      const time2 = Date.now() - start2;

      this.logTest(
        'Trade history query',
        time2 < 100,
        `Executed in ${time2}ms ${time2 >= 100 ? '(slow!)' : ''}`
      );

      // Test 3: Query performance - Complex join
      const start3 = Date.now();
      this.db.prepare(`
        SELECT b.*, COUNT(t.id) as trade_count
        FROM bots b
        LEFT JOIN trades t ON t.bot_id = b.id
        GROUP BY b.id
      `).all();
      const time3 = Date.now() - start3;

      this.logTest(
        'Complex join query',
        time3 < 200,
        `Executed in ${time3}ms ${time3 >= 200 ? '(slow!)' : ''}`
      );

      // Test 4: Database size check
      const filePath = this.dbPath;
      const fs = require('fs');
      const stats = fs.statSync(filePath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

      this.logTest(
        'Database size',
        parseFloat(sizeMB) < 1000,
        `${sizeMB} MB ${parseFloat(sizeMB) >= 1000 ? '(consider cleanup!)' : ''}`
      );

      // Test 5: Table row counts
      const trades = this.db.prepare('SELECT COUNT(*) as count FROM trades').get().count;
      const decisions = this.db.prepare('SELECT COUNT(*) as count FROM bot_decisions').get().count;
      const snapshots = this.db.prepare('SELECT COUNT(*) as count FROM bot_state_snapshots').get().count;

      const totalRows = trades + decisions + snapshots;

      this.logTest(
        'Total data records',
        true,
        `Trades: ${trades.toLocaleString()}, Decisions: ${decisions.toLocaleString()}, Snapshots: ${snapshots.toLocaleString()}`
      );

    } catch (error) {
      this.logTest('Performance tests', false, error.message);
    } finally {
      this.disconnect();
    }
  }

  // ==================== Results Summary ====================
  
  printSummary() {
    this.logSection('TEST RESULTS SUMMARY');

    const total = this.results.passed + this.results.failed + this.results.skipped;
    const successRate = total > 0 
      ? ((this.results.passed / (total - this.results.skipped)) * 100).toFixed(1) 
      : 0;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`⏭️  Skipped: ${this.results.skipped}`);
    console.log(`Success Rate: ${successRate}%\n`);

    if (this.results.failed > 0) {
      console.log('❌ Failed Tests:');
      this.results.tests
        .filter(t => !t.passed && !t.skipped)
        .forEach(t => console.log(`   - ${t.name}: ${t.details}`));
      console.log('');
    }

    if (this.results.failed === 0) {
      console.log('🎉 ALL TESTS PASSED!\n');
      return true;
    } else {
      console.log('⚠️  SOME TESTS FAILED - Review results above\n');
      return false;
    }
  }
}

// ==================== CLI ====================

async function main() {
  const args = process.argv.slice(2);
  const suite = args[0] || 'all';

  const tester = new DatabaseTester(DB_PATH, API_BASE);

  console.log('\n' + '═'.repeat(70));
  console.log('BONERBOTS DATABASE TEST SUITE');
  console.log('═'.repeat(70));
  console.log(`\n📂 Database: ${DB_PATH}`);
  console.log(`🌐 API: ${API_BASE}`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}\n`);

  try {
    switch (suite) {
      case 'auth':
        await tester.testAuthentication();
        break;

      case 'multi-tenant':
        tester.testMultiTenancy();
        break;

      case 'consistency':
        tester.testConsistency();
        break;

      case 'integrity':
        tester.testIntegrity();
        break;

      case 'performance':
        tester.testPerformance();
        break;

      case 'all':
      default:
        await tester.testAuthentication();
        tester.testMultiTenancy();
        tester.testConsistency();
        tester.testIntegrity();
        tester.testPerformance();
        break;
    }

    const allPassed = tester.printSummary();
    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error(`\n❌ Test suite failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { DatabaseTester };

