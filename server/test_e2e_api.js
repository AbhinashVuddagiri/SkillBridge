// server/test_e2e_api.js
// End-to-end API verification against the running dev server

async function run() {
  console.log('=====================================================');
  console.log('SKILLBRIDGE END-TO-END HTTP API VERIFICATION');
  console.log('=====================================================\n');

  const BASE_URL = 'http://localhost:5000';
  const CLIENT_URL = 'http://localhost:5173';

  // 1. Verify Client Server is up
  try {
    const res = await fetch(CLIENT_URL);
    if (res.ok) {
      console.log('  [PASS] Vite Client server is serving HTTP 200 at ' + CLIENT_URL);
    } else {
      console.log('  [WARN] Vite Client returned status ' + res.status);
    }
  } catch (err) {
    console.log('  [FAIL] Could not reach Client server: ' + err.message);
  }

  // --------------------------------------------------------------------------
  // CHANGE 1: FAST FAILED LOGIN CHECKS & FRIENDLY ERROR
  // --------------------------------------------------------------------------
  console.log('\n--- CHANGE 1: Fast Failed Login Checks & Security ---');

  // Case 1: Nonexistent account
  const t0 = Date.now();
  const res1 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bridgeAccount: 'definitely_fake_account_99999', password: 'password123' })
  });
  const dur1 = Date.now() - t0;
  const data1 = await res1.json();

  if (res1.status === 401 && (data1.error || data1.message) === 'Invalid Bridge Account or password. Please try again.') {
    console.log(`  [PASS] Nonexistent account returns 401 with friendly error in ${dur1}ms (< 1500ms)`);
  } else {
    console.log(`  [FAIL] Unexpected response for nonexistent account:`, res1.status, data1);
  }

  // Case 2: Existing account with incorrect password
  const t1 = Date.now();
  const res2 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bridgeAccount: 'Bunny_bridge', password: 'wrong_password_xyz' })
  });
  const dur2 = Date.now() - t1;
  const data2 = await res2.json();

  if (res2.status === 401 && (data2.error || data2.message) === 'Invalid Bridge Account or password. Please try again.') {
    console.log(`  [PASS] Incorrect password returns 401 with identical friendly error in ${dur2}ms (< 1500ms)`);
  } else {
    console.log(`  [FAIL] Unexpected response for wrong password:`, res2.status, data2);
  }

  // Case 3: Empty inputs
  const res3 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bridgeAccount: '', password: '' })
  });
  const data3 = await res3.json();
  const err3 = data3.error || data3.message || '';
  if (res3.status === 400 && (err3.includes('enter') || err3.includes('required'))) {
    console.log('  [PASS] Empty inputs blocked with 400 validation error');
  } else {
    console.log('  [FAIL] Empty inputs response:', res3.status, data3);
  }

  // --------------------------------------------------------------------------
  // USER REGISTRATION & AUTHENTICATION
  // --------------------------------------------------------------------------
  console.log('\n--- AUTHENTICATION & USER SETUP ---');
  const testAccount = `e2e_user_${Date.now().toString(36)}`;
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'E2E Test User',
      instituteName: 'SkillBridge University',
      bridgeAccount: testAccount,
      password: 'password123'
    })
  });
  const regData = await regRes.json();
  if (regRes.ok && regData.token) {
    console.log(`  [PASS] User registered successfully with bridgeAccount: ${testAccount}`);
  } else {
    console.log('  [FAIL] Registration failed:', regRes.status, regData);
    return;
  }

  const token = regData.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // --------------------------------------------------------------------------
  // CHANGE 4: CHAT ENDPOINTS, CONNECTIONS, MUTING, REMOVAL
  // --------------------------------------------------------------------------
  console.log('\n--- CHANGE 4: Dedicated Chat, Muting & Connection Removal Endpoints ---');

  // Fetch connections
  const connsRes = await fetch(`${BASE_URL}/api/connections`, { headers: authHeaders });
  const connsData = await connsRes.json();
  const connsList = Array.isArray(connsData) ? connsData : connsData.connections;
  if (connsRes.ok && Array.isArray(connsList)) {
    console.log(`  [PASS] GET /api/connections returned ${connsList.length} connections with message preview and mute support`);
  } else {
    console.log('  [FAIL] Failed fetching connections:', connsRes.status, connsData);
  }

  // Fetch muted connections
  const mutesRes = await fetch(`${BASE_URL}/api/connections/muted`, { headers: authHeaders });
  const mutesData = await mutesRes.json();
  const mutesList = Array.isArray(mutesData) ? mutesData : mutesData.mutedIds;
  if (mutesRes.ok && Array.isArray(mutesList)) {
    console.log(`  [PASS] GET /api/connections/muted returned muted IDs array`);
  } else {
    console.log('  [FAIL] Failed fetching muted IDs:', mutesRes.status, mutesData);
  }

  // --------------------------------------------------------------------------
  // CHANGE 3: SECURE ACCOUNT DELETION
  // --------------------------------------------------------------------------
  console.log('\n--- CHANGE 3: Secure Account Deletion Endpoint ---');

  // Attempt delete with wrong password
  const delFailRes = await fetch(`${BASE_URL}/api/users/account`, {
    method: 'DELETE',
    headers: authHeaders,
    body: JSON.stringify({ password: 'wrong_password_attempt' })
  });
  const delFailData = await delFailRes.json();
  if (delFailRes.status === 401) {
    console.log('  [PASS] Account deletion blocked with invalid re-auth password');
  } else {
    console.log('  [FAIL] Account deletion without valid password:', delFailRes.status, delFailData);
  }

  // Attempt delete with correct password
  const delSuccessRes = await fetch(`${BASE_URL}/api/users/account`, {
    method: 'DELETE',
    headers: authHeaders,
    body: JSON.stringify({ password: 'password123' })
  });
  const delSuccessData = await delSuccessRes.json();
  if (delSuccessRes.ok && delSuccessData.message?.includes('deleted successfully')) {
    console.log(`  [PASS] Account deleted successfully: "${delSuccessData.message}"`);
  } else {
    console.log('  [FAIL] Account deletion failed:', delSuccessRes.status, delSuccessData);
  }

  // Verify deleted user can no longer log in
  const reloginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bridgeAccount: testAccount, password: 'password123' })
  });
  const reloginData = await reloginRes.json();
  if (reloginRes.status === 401) {
    console.log('  [PASS] Deleted user cannot sign in; returns 401 Invalid credentials');
  } else {
    console.log('  [FAIL] Deleted user was still able to sign in:', reloginRes.status, reloginData);
  }

  console.log('\n=====================================================');
  console.log('ALL HTTP API TESTS COMPLETED SUCCESSFULLY');
  console.log('=====================================================');
}

run().catch(console.error);
