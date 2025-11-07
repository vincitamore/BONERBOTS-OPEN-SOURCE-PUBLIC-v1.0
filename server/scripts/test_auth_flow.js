/**
 * Authentication Flow Test Script
 * 
 * This script tests the complete authentication system:
 * 1. User registration with recovery phrase
 * 2. Login/logout flow
 * 3. Token refresh
 * 4. Account recovery with recovery phrase
 * 5. Password reset
 * 6. Session management
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001';

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
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      status: error.response?.status,
      details: error.response?.data?.details || error.response?.data
    };
  }
}

async function loginUser(username, password) {
  try {
    const response = await axios.post(`${API_BASE}/api/auth/login`, { username, password });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      status: error.response?.status
    };
  }
}

async function logoutUser(refreshToken) {
  try {
    const response = await axios.post(`${API_BASE}/api/auth/logout`, { refreshToken });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
}

async function refreshToken(refreshToken) {
  try {
    const response = await axios.post(`${API_BASE}/api/auth/refresh`, { refreshToken });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      status: error.response?.status
    };
  }
}

async function recoverAccount(username, recoveryPhrase, newPassword) {
  try {
    const response = await axios.post(`${API_BASE}/api/auth/recover`, {
      username,
      recoveryPhrase,
      newPassword
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      status: error.response?.status
    };
  }
}

async function fetchProtectedResource(token) {
  try {
    const response = await axios.get(`${API_BASE}/api/v2/bots`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return {
      success: true,
      data: response.data
    };
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
  console.log('🔐 BONERBOTS Authentication Flow Tests\n');
  
  // Use shorter timestamp (last 6 digits) to keep username under 20 chars
  const timestamp = Date.now().toString().slice(-6);
  const testUsername = `auth_${timestamp}`;
  const testPassword = 'TestPassword123!';
  const testEmail = `auth_${timestamp}@example.com`;
  const newPassword = 'NewPassword456!';
  
  let userSession = null;
  let recoveryPhrase = null;
  
  // =================================================================
  // TEST 1: User Registration
  // =================================================================
  logSection('TEST 1: User Registration');
  
  const registerResult = await registerUser({
    username: testUsername,
    password: testPassword,
    email: testEmail
  });
  
  logTest(
    'Register new user',
    registerResult.success,
    registerResult.success ? `User ID: ${registerResult.data.user.id}` : `${registerResult.error}${registerResult.details ? ' - ' + JSON.stringify(registerResult.details) : ''}`
  );
  
  if (registerResult.success) {
    userSession = registerResult.data;
    recoveryPhrase = registerResult.data.recoveryPhrase;
    
    // Validate response structure
    logTest(
      'Response includes accessToken',
      !!userSession.accessToken,
      userSession.accessToken ? 'Token present' : 'Token missing'
    );
    
    logTest(
      'Response includes refreshToken',
      !!userSession.refreshToken,
      userSession.refreshToken ? 'Token present' : 'Token missing'
    );
    
    logTest(
      'Response includes user object',
      !!userSession.user && !!userSession.user.id,
      userSession.user ? `User: ${userSession.user.username}` : 'User object missing'
    );
    
    logTest(
      'Response includes recovery phrase',
      !!recoveryPhrase && recoveryPhrase.split(' ').length === 12,
      recoveryPhrase ? `12-word phrase: ${recoveryPhrase.split(' ').slice(0, 3).join(' ')}...` : 'Recovery phrase missing or invalid'
    );
  } else {
    console.log('\n⚠️ Cannot continue tests without successful registration');
    process.exit(1);
  }
  
  await sleep(500);
  
  // =================================================================
  // TEST 2: Access Protected Resources with Token
  // =================================================================
  logSection('TEST 2: Access Protected Resources');
  
  const protectedResult = await fetchProtectedResource(userSession.accessToken);
  logTest(
    'Access protected endpoint with valid token',
    protectedResult.success,
    protectedResult.success ? 'Resource accessed successfully' : protectedResult.error
  );
  
  // Test with invalid token
  const invalidTokenResult = await fetchProtectedResource('invalid_token_12345');
  logTest(
    'Access protected endpoint with invalid token',
    !invalidTokenResult.success && invalidTokenResult.status === 403,
    invalidTokenResult.success ? '❌ SECURITY ISSUE: Invalid token accepted!' : `Correctly denied (${invalidTokenResult.status})`
  );
  
  // Test without token
  const noTokenResult = await fetchProtectedResource('');
  logTest(
    'Access protected endpoint without token',
    !noTokenResult.success && (noTokenResult.status === 401 || noTokenResult.status === 403),
    noTokenResult.success ? '❌ SECURITY ISSUE: Request without token accepted!' : `Correctly denied (${noTokenResult.status})`
  );
  
  await sleep(1000);
  
  // =================================================================
  // TEST 3: Token Refresh
  // =================================================================
  logSection('TEST 3: Token Refresh');
  
  // Wait a moment to ensure session is fully persisted
  await sleep(500);
  
  const refreshResult = await refreshToken(userSession.refreshToken);
  logTest(
    'Refresh access token with valid refresh token',
    refreshResult.success,
    refreshResult.success ? 'New access token received' : refreshResult.error
  );
  
  if (refreshResult.success) {
    const oldAccessToken = userSession.accessToken;
    userSession.accessToken = refreshResult.data.accessToken;
    
    logTest(
      'New access token is different from old token',
      oldAccessToken !== userSession.accessToken,
      oldAccessToken === userSession.accessToken ? 'Tokens are the same!' : 'Tokens are different'
    );
    
    // Verify new token works
    const newTokenResult = await fetchProtectedResource(userSession.accessToken);
    logTest(
      'New access token works for protected resources',
      newTokenResult.success,
      newTokenResult.success ? 'Resource accessed with new token' : newTokenResult.error
    );
  }
  
  // Test refresh with invalid token
  const invalidRefreshResult = await refreshToken('invalid_refresh_token');
  logTest(
    'Refresh with invalid refresh token',
    !invalidRefreshResult.success,
    invalidRefreshResult.success ? '❌ SECURITY ISSUE: Invalid refresh token accepted!' : `Correctly denied (${invalidRefreshResult.status})`
  );
  
  await sleep(500);
  
  // =================================================================
  // TEST 4: Logout
  // =================================================================
  logSection('TEST 4: Logout');
  
  const logoutResult = await logoutUser(userSession.refreshToken);
  logTest(
    'Logout successfully',
    logoutResult.success,
    logoutResult.success ? 'Session terminated' : logoutResult.error
  );
  
  // Try to refresh after logout - should fail
  const refreshAfterLogoutResult = await refreshToken(userSession.refreshToken);
  logTest(
    'Refresh token invalid after logout',
    !refreshAfterLogoutResult.success,
    refreshAfterLogoutResult.success ? '❌ SECURITY ISSUE: Refresh token still valid after logout!' : `Correctly invalidated (${refreshAfterLogoutResult.status})`
  );
  
  await sleep(500);
  
  // =================================================================
  // TEST 5: Login
  // =================================================================
  logSection('TEST 5: Login');
  
  const loginResult = await loginUser(testUsername, testPassword);
  logTest(
    'Login with correct credentials',
    loginResult.success,
    loginResult.success ? `Logged in as ${loginResult.data.user.username}` : loginResult.error
  );
  
  if (loginResult.success) {
    userSession = loginResult.data;
    
    // Validate login response structure
    logTest(
      'Login response includes new tokens',
      !!userSession.accessToken && !!userSession.refreshToken,
      'Tokens present'
    );
  }
  
  // Test login with wrong password
  const wrongPasswordResult = await loginUser(testUsername, 'WrongPassword123!');
  logTest(
    'Login with incorrect password',
    !wrongPasswordResult.success,
    wrongPasswordResult.success ? '❌ SECURITY ISSUE: Wrong password accepted!' : `Correctly denied (${wrongPasswordResult.status})`
  );
  
  // Test login with non-existent user
  const nonExistentUserResult = await loginUser('nonexistentuser12345', testPassword);
  logTest(
    'Login with non-existent username',
    !nonExistentUserResult.success,
    nonExistentUserResult.success ? '❌ SECURITY ISSUE: Non-existent user login succeeded!' : `Correctly denied (${nonExistentUserResult.status})`
  );
  
  await sleep(500);
  
  // =================================================================
  // TEST 6: Account Recovery
  // =================================================================
  logSection('TEST 6: Account Recovery');
  
  // Logout first
  await logoutUser(userSession.refreshToken);
  await sleep(300);
  
  const recoverResult = await recoverAccount(testUsername, recoveryPhrase, newPassword);
  logTest(
    'Recover account with valid recovery phrase',
    recoverResult.success,
    recoverResult.success ? 'Account recovered and password changed' : recoverResult.error
  );
  
  if (recoverResult.success) {
    // Try to login with new password
    const loginWithNewPasswordResult = await loginUser(testUsername, newPassword);
    logTest(
      'Login with new password after recovery',
      loginWithNewPasswordResult.success,
      loginWithNewPasswordResult.success ? 'Login successful with new password' : loginWithNewPasswordResult.error
    );
    
    if (loginWithNewPasswordResult.success) {
      userSession = loginWithNewPasswordResult.data;
    }
    
    // Try to login with old password - should fail
    const loginWithOldPasswordResult = await loginUser(testUsername, testPassword);
    logTest(
      'Login with old password fails after recovery',
      !loginWithOldPasswordResult.success,
      loginWithOldPasswordResult.success ? '❌ SECURITY ISSUE: Old password still works!' : `Correctly denied (${loginWithOldPasswordResult.status})`
    );
  }
  
  // Test recovery with wrong phrase
  const wrongPhraseResult = await recoverAccount(testUsername, 'wrong phrase words here and more words to fill twelve', newPassword);
  logTest(
    'Recovery with incorrect recovery phrase',
    !wrongPhraseResult.success,
    wrongPhraseResult.success ? '❌ SECURITY ISSUE: Wrong recovery phrase accepted!' : `Correctly denied (${wrongPhraseResult.status})`
  );
  
  await sleep(500);
  
  // =================================================================
  // TEST 7: Duplicate Registration Prevention
  // =================================================================
  logSection('TEST 7: Duplicate Registration Prevention');
  
  const duplicateResult = await registerUser({
    username: testUsername,
    password: testPassword,
    email: `different_${testEmail}`
  });
  
  logTest(
    'Prevent duplicate username registration',
    !duplicateResult.success && duplicateResult.status === 409,
    duplicateResult.success ? '❌ SECURITY ISSUE: Duplicate username registered!' : `Correctly prevented (${duplicateResult.status})`
  );
  
  // =================================================================
  // TEST 8: Password Validation
  // =================================================================
  logSection('TEST 8: Password Validation');
  
  const weakPasswordTests = [
    { password: 'weak', description: 'too short' },
    { password: 'nouppercaseornumbers', description: 'no uppercase or numbers' },
    { password: 'NoNumbers', description: 'no numbers' },
    { password: '12345678', description: 'no letters' }
  ];
  
  for (const test of weakPasswordTests) {
    const ts = Date.now().toString().slice(-6);
    const weakResult = await registerUser({
      username: `wpw_${ts}`,
      password: test.password,
      email: `wpw_${ts}@example.com`
    });
    
    logTest(
      `Reject weak password (${test.description})`,
      !weakResult.success,
      weakResult.success ? `❌ Weak password accepted: ${test.password}` : `Correctly rejected`
    );
    
    await sleep(100);
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
    console.log('🎉 ALL TESTS PASSED! Authentication flow is working correctly.\n');
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

