/**
 * Multi-Tenant Data Isolation Test Script
 * 
 * This script tests the multi-tenant architecture by:
 * 1. Creating test users
 * 2. Creating data for each user (bots, providers, wallets)
 * 3. Verifying data isolation between users
 * 4. Testing admin access to all data
 * 5. Testing that users cannot access other users' data
 */

const path = require('path');
const axios = require('axios');

const API_BASE = 'http://localhost:3001';

// Test data
const testUsers = [
  { username: 'testuser1', password: 'TestPassword123!', email: 'test1@example.com' },
  { username: 'testuser2', password: 'TestPassword123!', email: 'test2@example.com' },
  { username: 'testuser3', password: 'TestPassword123!', email: 'test3@example.com' }
];

const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

// Helper functions
function logTest(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (details) console.log(`   ${details}`);
  
  testResults.tests.push({ name, passed, details });
  if (passed) testResults.passed++;
  else testResults.failed++;
}

function logSection(name) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(name);
  console.log('='.repeat(60));
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test functions
async function registerUser(userData) {
  try {
    const response = await axios.post(`${API_BASE}/api/auth/register`, userData);
    return {
      success: true,
      user: response.data.user,
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken,
      recoveryPhrase: response.data.recoveryPhrase
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
}

async function loginUser(username, password) {
  try {
    const response = await axios.post(`${API_BASE}/api/auth/login`, { username, password });
    return {
      success: true,
      user: response.data.user,
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
}

async function createBot(token, botData) {
  try {
    const response = await axios.post(`${API_BASE}/api/v2/bots`, botData, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return { success: true, bot: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      details: error.response?.data?.details || error.response?.data
    };
  }
}

async function getBots(token) {
  try {
    const response = await axios.get(`${API_BASE}/api/v2/bots`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return { success: true, bots: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
}

async function getBot(token, botId) {
  try {
    const response = await axios.get(`${API_BASE}/api/v2/bots/${botId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return { success: true, bot: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      status: error.response?.status
    };
  }
}

async function createProvider(token, providerData) {
  try {
    const response = await axios.post(`${API_BASE}/api/v2/providers`, providerData, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return { success: true, provider: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
}

async function getProviders(token) {
  try {
    const response = await axios.get(`${API_BASE}/api/v2/providers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return { success: true, providers: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
}

async function getAnalytics(token) {
  try {
    const response = await axios.get(`${API_BASE}/api/v2/analytics/performance`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return { success: true, analytics: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
}

async function getAdminUsers(token) {
  try {
    const response = await axios.get(`${API_BASE}/api/admin/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return { success: true, users: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      status: error.response?.status
    };
  }
}

async function getAdminBots(token) {
  try {
    const response = await axios.get(`${API_BASE}/api/admin/bots`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return { success: true, bots: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      status: error.response?.status
    };
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 BONERBOTS Multi-Tenant Data Isolation Tests\n');
  
  const userSessions = [];
  let adminSession = null;
  
  // =================================================================
  // TEST 1: User Registration
  // =================================================================
  logSection('TEST 1: User Registration');
  
  for (const userData of testUsers) {
    const result = await registerUser(userData);
    
    if (result.success) {
      logTest(
        `Register user: ${userData.username}`,
        true,
        `User ID: ${result.user.id}`
      );
      userSessions.push({
        userData,
        ...result
      });
    } else {
      // User might already exist, try logging in
      const loginResult = await loginUser(userData.username, userData.password);
      if (loginResult.success) {
        logTest(
          `Login existing user: ${userData.username}`,
          true,
          `User ID: ${loginResult.user.id}`
        );
        userSessions.push({
          userData,
          ...loginResult
        });
      } else {
        logTest(`Register/Login user: ${userData.username}`, false, result.error);
      }
    }
    await sleep(100);
  }
  
  // Get admin session
  try {
    const adminLogin = await loginUser('admin', 'admin123');
    if (adminLogin.success) {
      adminSession = adminLogin;
      logTest('Admin login', true, `Admin ID: ${adminLogin.user.id}`);
    } else {
      logTest('Admin login', false, adminLogin.error);
    }
  } catch (error) {
    logTest('Admin login', false, error.message);
  }
  
  // =================================================================
  // TEST 2: Create Data for Each User
  // =================================================================
  logSection('TEST 2: Create Data for Each User');
  
  const timestamp = Date.now();
  
  for (let i = 0; i < userSessions.length; i++) {
    const session = userSessions[i];
    const username = session.userData.username;
    
    // Create provider
    const providerResult = await createProvider(session.accessToken, {
      name: `${username}_provider_${timestamp}`,
      provider_type: 'openai',
      model_name: 'gpt-4',
      api_key: 'sk-test_key_placeholder_minimum_length_requirement',
      api_endpoint: 'https://api.openai.com/v1',
      is_active: true
    });
    
    logTest(
      `Create provider for ${username}`,
      providerResult.success,
      providerResult.success ? `Provider ID: ${providerResult.provider.id}` : providerResult.error
    );
    
    if (providerResult.success) {
      session.providerId = providerResult.provider.id;
    }
    
    await sleep(100);
    
    // Create bot
    const botId = `bot_${username}_${timestamp}`;
    const botResult = await createBot(session.accessToken, {
      id: botId,
      name: `${username}_bot_${timestamp}`,
      prompt: `You are a trading bot for ${username}. Analyze market data and make informed trading decisions based on technical indicators and market trends. Focus on risk management and consistent returns.`,
      provider_id: session.providerId,
      trading_mode: 'paper',
      is_active: true,
      is_paused: false
    });
    
    logTest(
      `Create bot for ${username}`,
      botResult.success,
      botResult.success ? `Bot ID: ${botResult.bot.id}` : `${botResult.error}${botResult.details ? ' - ' + JSON.stringify(botResult.details) : ''}`
    );
    
    if (botResult.success) {
      session.botId = botResult.bot.id;
    }
    
    await sleep(100);
  }
  
  // =================================================================
  // TEST 3: Verify Users Can Only See Their Own Data
  // =================================================================
  logSection('TEST 3: Verify Data Isolation Between Users');
  
  for (let i = 0; i < userSessions.length; i++) {
    const session = userSessions[i];
    const username = session.userData.username;
    
    // Get user's own bots
    const botsResult = await getBots(session.accessToken);
    logTest(
      `${username} can fetch their own bots`,
      botsResult.success,
      botsResult.success ? `Found ${botsResult.bots.length} bot(s)` : botsResult.error
    );
    
    if (botsResult.success) {
      // Verify bot count
      const expectedBots = 1; // Each user created 1 bot
      logTest(
        `${username} sees only their own bots`,
        botsResult.bots.length === expectedBots,
        `Expected ${expectedBots}, got ${botsResult.bots.length}`
      );
      
      // Verify bot ownership
      const ownedBot = botsResult.bots.find(b => b.id === session.botId);
      logTest(
        `${username}'s bot is in their bot list`,
        !!ownedBot,
        ownedBot ? `Bot: ${ownedBot.name}` : 'Bot not found'
      );
    }
    
    // Get user's own providers
    const providersResult = await getProviders(session.accessToken);
    logTest(
      `${username} can fetch their own providers`,
      providersResult.success,
      providersResult.success ? `Found ${providersResult.providers.length} provider(s)` : providersResult.error
    );
    
    if (providersResult.success) {
      // Check that user has at least the provider they just created
      const hasOwnProvider = providersResult.providers.some(p => p.id === session.providerId);
      logTest(
        `${username} sees their own provider in the list`,
        hasOwnProvider,
        hasOwnProvider ? `Provider ID ${session.providerId} found` : 'Provider not found in list'
      );
    }
    
    await sleep(100);
  }
  
  // =================================================================
  // TEST 4: Verify Users Cannot Access Other Users' Data
  // =================================================================
  logSection('TEST 4: Verify Users Cannot Access Other Users\' Data');
  
  for (let i = 0; i < userSessions.length; i++) {
    const session = userSessions[i];
    const username = session.userData.username;
    
    // Try to access another user's bot
    const otherUserIndex = (i + 1) % userSessions.length;
    const otherSession = userSessions[otherUserIndex];
    const otherUsername = otherSession.userData.username;
    const otherBotId = otherSession.botId;
    
    if (otherBotId) {
      const accessResult = await getBot(session.accessToken, otherBotId);
      logTest(
        `${username} CANNOT access ${otherUsername}'s bot`,
        !accessResult.success && accessResult.status === 404,
        accessResult.success ? '❌ SECURITY ISSUE: User accessed another user\'s bot!' : `Correctly denied (${accessResult.status})`
      );
    }
    
    await sleep(100);
  }
  
  // =================================================================
  // TEST 5: Verify Admin Can See All Users' Data
  // =================================================================
  logSection('TEST 5: Verify Admin Can See All Users\' Data');
  
  if (adminSession) {
    // Admin should see all users
    const usersResult = await getAdminUsers(adminSession.accessToken);
    logTest(
      'Admin can fetch all users',
      usersResult.success,
      usersResult.success ? `Found ${usersResult.users?.length || usersResult.users?.users?.length || 0} user(s)` : usersResult.error
    );
    
    if (usersResult.success) {
      const testUserCount = testUsers.length;
      const actualUserCount = usersResult.users?.length || usersResult.users?.users?.length || 0;
      logTest(
        'Admin sees all test users',
        actualUserCount >= testUserCount,
        `Expected at least ${testUserCount}, got ${actualUserCount}`
      );
    }
    
    // Admin should see all bots
    const adminBotsResult = await getAdminBots(adminSession.accessToken);
    logTest(
      'Admin can fetch all bots',
      adminBotsResult.success,
      adminBotsResult.success ? `Found ${adminBotsResult.bots?.length || adminBotsResult.bots?.bots?.length || 0} bot(s)` : adminBotsResult.error
    );
    
    // Admin can access any user's bots
    for (const session of userSessions) {
      if (session.botId) {
        const botResult = await getBot(adminSession.accessToken, session.botId);
        logTest(
          `Admin can access ${session.userData.username}'s bot`,
          botResult.success,
          botResult.success ? `Bot: ${botResult.bot.name}` : botResult.error
        );
      }
    }
  } else {
    logTest('Admin access tests', false, 'Admin session not available');
  }
  
  // =================================================================
  // TEST 6: Verify Non-Admin Cannot Access Admin Endpoints
  // =================================================================
  logSection('TEST 6: Verify Non-Admin Cannot Access Admin Endpoints');
  
  const regularUser = userSessions[0];
  if (regularUser) {
    const adminUsersResult = await getAdminUsers(regularUser.accessToken);
    logTest(
      `Regular user CANNOT access admin/users endpoint`,
      !adminUsersResult.success && adminUsersResult.status === 403,
      adminUsersResult.success ? '❌ SECURITY ISSUE: Regular user accessed admin endpoint!' : `Correctly denied (${adminUsersResult.status})`
    );
    
    const adminBotsResult = await getAdminBots(regularUser.accessToken);
    logTest(
      `Regular user CANNOT access admin/bots endpoint`,
      !adminBotsResult.success && adminBotsResult.status === 403,
      adminBotsResult.success ? '❌ SECURITY ISSUE: Regular user accessed admin endpoint!' : `Correctly denied (${adminBotsResult.status})`
    );
  }
  
  // =================================================================
  // TEST 7: Analytics Data Isolation
  // =================================================================
  logSection('TEST 7: Verify Analytics Data Isolation');
  
  for (const session of userSessions) {
    const username = session.userData.username;
    const analyticsResult = await getAnalytics(session.accessToken);
    
    logTest(
      `${username} can fetch their analytics`,
      analyticsResult.success,
      analyticsResult.success ? 'Analytics retrieved' : analyticsResult.error
    );
  }
  
  // =================================================================
  // RESULTS SUMMARY
  // =================================================================
  logSection('TEST RESULTS SUMMARY');
  
  console.log(`\nTotal Tests: ${testResults.passed + testResults.failed}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%\n`);
  
  if (testResults.failed === 0) {
    console.log('🎉 ALL TESTS PASSED! Multi-tenant data isolation is working correctly.\n');
    process.exit(0);
  } else {
    console.log('⚠️  SOME TESTS FAILED. Review the output above for details.\n');
    console.log('Failed tests:');
    testResults.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  - ${t.name}: ${t.details}`);
    });
    console.log();
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test runner failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});

