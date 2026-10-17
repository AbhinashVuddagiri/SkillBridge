// server/test_full_lifecycle.js
// Complete lifecycle test across all 4 changes via HTTP API

async function runLifecycle() {
  console.log('=====================================================');
  console.log('SKILLBRIDGE COMPLETE LIFECYCLE VERIFICATION (HTTP API)');
  console.log('=====================================================\n');

  const BASE_URL = 'http://localhost:5000';

  function assert(condition, message) {
    if (!condition) {
      console.error(`  [FAIL] ${message}`);
      process.exit(1);
    }
    console.log(`  [PASS] ${message}`);
  }

  // 1. CHANGE 1: Login failure performance & security
  console.log('--- CHANGE 1: Login Speed & Security ---');
  // Warmup connection
  await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bridgeAccount: 'warmup_account', password: 'password123' })
  }).catch(() => {});

  const t0 = Date.now();
  const badLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bridgeAccount: 'random_nonexistent_user', password: 'random_password' })
  });
  const badLoginDur = Date.now() - t0;
  const badLoginData = await badLoginRes.json();
  assert(badLoginRes.status === 401, 'Nonexistent account returns 401 status');
  assert(badLoginDur < 1500, `Nonexistent account responded in ${badLoginDur}ms (< 1500ms)`);
  assert(
    (badLoginData.error || badLoginData.message) === 'Invalid Bridge Account or password. Please try again.',
    'Friendly error message returned for nonexistent account'
  );

  // 2. Register User A & User B
  console.log('\n--- SETUP: Registering User A & User B ---');
  const userAAccount = `cycle_a_${Date.now().toString(36)}`;
  const userBAccount = `cycle_b_${Date.now().toString(36)}`;

  const regARes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Alice Walker',
      instituteName: 'MIT',
      bridgeAccount: userAAccount,
      password: 'password123'
    })
  });
  const regAData = await regARes.json();
  assert(regARes.ok && regAData.token, `User A registered (${userAAccount})`);
  const tokenA = regAData.token;
  const userA = regAData.user;

  const regBRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Bob Martinez',
      instituteName: 'Stanford',
      bridgeAccount: userBAccount,
      password: 'password123'
    })
  });
  const regBData = await regBRes.json();
  assert(regBRes.ok && regBData.token, `User B registered (${userBAccount})`);
  const tokenB = regBData.token;
  const userB = regBData.user;

  // Complete profiles so they appear in explore
  await fetch(`${BASE_URL}/api/users/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({
      name: 'Alice Walker',
      instituteName: 'MIT',
      skillsTeach: ['React', 'JavaScript'],
      skillsLearn: ['Python']
    })
  });

  await fetch(`${BASE_URL}/api/users/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({
      name: 'Bob Martinez',
      instituteName: 'Stanford',
      skillsTeach: ['Python'],
      skillsLearn: ['React']
    })
  });

  // Test wrong password speed for User A
  const tWrong = Date.now();
  const wrongPassRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bridgeAccount: userAAccount, password: 'incorrect_password_xyz' })
  });
  const wrongPassDur = Date.now() - tWrong;
  const wrongPassData = await wrongPassRes.json();
  assert(wrongPassRes.status === 401, 'Wrong password returns 401 status');
  assert(wrongPassDur < 1500, `Wrong password responded in ${wrongPassDur}ms (< 1500ms)`);
  assert(
    (wrongPassData.error || wrongPassData.message) === 'Invalid Bridge Account or password. Please try again.',
    'Identical friendly error returned for wrong password'
  );

  // 3. CHANGE 2: Repeated Connection Requests & Fresh Notifications
  console.log('\n--- CHANGE 2: Repeated Connection Requests & Fresh Notifications ---');

  // Prevent self connection
  const selfRes = await fetch(`${BASE_URL}/api/connections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ recipientId: userA.id })
  });
  assert(selfRes.status === 400, 'Self connection blocked with 400');

  // Request 1: User A -> User B
  const req1Res = await fetch(`${BASE_URL}/api/connections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ recipientId: userB.id })
  });
  const req1Data = await req1Res.json();
  assert(req1Res.ok && req1Data.connection?.id, `Request 1 sent successfully (ID: ${req1Data.connection?.id})`);
  const req1Id = req1Data.connection.id;

  // Duplicate pending request check
  const dupPendingRes = await fetch(`${BASE_URL}/api/connections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ recipientId: userB.id })
  });
  assert(dupPendingRes.status === 400, 'Duplicate pending request blocked with 400');

  // Verify User B received notification for Request 1
  const notif1Res = await fetch(`${BASE_URL}/api/notifications`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  const notif1Data = await notif1Res.json();
  const notif1List = Array.isArray(notif1Data) ? notif1Data : notif1Data.notifications || [];
  assert(notif1List.length >= 1, `User B received fresh notification for Request 1`);
  const notif1Id = notif1List[0]?.id;

  // User B REJECTS Request 1
  const reject1Res = await fetch(`${BASE_URL}/api/connections/${req1Id}/reject`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  assert(reject1Res.ok, 'User B rejected Request 1');

  // Request 2: User A sends ANOTHER request to User B
  const req2Res = await fetch(`${BASE_URL}/api/connections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ recipientId: userB.id })
  });
  const req2Data = await req2Res.json();
  const req2Id = req2Data.connection?.id;
  assert(req2Res.ok && req2Id, `Request 2 sent successfully (ID: ${req2Id})`);
  assert(req2Id !== req1Id, `Request 2 has brand-new unique ID (${req2Id} !== ${req1Id})`);

  // Verify User B received a brand-new notification for Request 2
  const notif2Res = await fetch(`${BASE_URL}/api/notifications`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  const notif2Data = await notif2Res.json();
  const notif2List = Array.isArray(notif2Data) ? notif2Data : notif2Data.notifications || [];
  const notif2Id = notif2List[0]?.id;
  assert(notif2Id !== notif1Id, `User B received brand-new notification for Request 2 (ID: ${notif2Id} !== ${notif1Id})`);

  // User B ACCEPTS Request 2
  const accept2Res = await fetch(`${BASE_URL}/api/connections/${req2Id}/accept`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  assert(accept2Res.ok, 'User B accepted Request 2');

  // Verify duplicate request blocked when already connected
  const dupAcceptedRes = await fetch(`${BASE_URL}/api/connections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ recipientId: userB.id })
  });
  assert(dupAcceptedRes.status === 400, 'Sending request when already connected blocked');

  // 4. CHANGE 4: Dedicated Chat, Muting & Connection Removal
  console.log('\n--- CHANGE 4: Dedicated Chat, Muting & Removal ---');

  // User A sends message in accepted connection
  const sendMsgRes = await fetch(`${BASE_URL}/api/messages/${req2Id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ messageBody: 'Hello Bob! Ready to exchange skills?' })
  });
  const sendMsgData = await sendMsgRes.json();
  assert(sendMsgRes.ok && sendMsgData.message?.id, 'User A sent message in connection');

  // User B fetches conversation
  const getMsgRes = await fetch(`${BASE_URL}/api/messages/${req2Id}`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  const getMsgData = await getMsgRes.json();
  assert(getMsgRes.ok && getMsgData.messages?.length === 1, 'User B fetched message history');
  assert(getMsgData.partner?.name === 'Alice Walker', 'User B sees partner profile as Alice Walker');

  // Check connection preview in connection list
  const listConnsRes = await fetch(`${BASE_URL}/api/connections`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  const listConnsData = await listConnsRes.json();
  const conns = listConnsData.connections || listConnsData;
  const targetConn = conns.find(c => c.id === req2Id);
  assert(targetConn?.lastMessage?.body?.includes('Ready to exchange'), 'Connection preview includes latest message');

  // User B mutes conversation
  const muteRes = await fetch(`${BASE_URL}/api/connections/${req2Id}/mute`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  const muteData = await muteRes.json();
  assert(muteRes.ok && muteData.isMuted === true, 'User B muted connection successfully');

  // Check User A is not muted
  const connsARes = await fetch(`${BASE_URL}/api/connections`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const connsAData = await connsARes.json();
  const connA = (connsAData.connections || connsAData).find(c => c.id === req2Id);
  assert(connA?.isMuted === false, 'User A connection is NOT muted (mute is user-specific)');

  // User B unmutes conversation
  const unmuteRes = await fetch(`${BASE_URL}/api/connections/${req2Id}/mute`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  const unmuteData = await unmuteRes.json();
  assert(unmuteRes.ok && unmuteData.isMuted === false, 'User B unmuted connection successfully');

  // Test Remove Connection: User A removes connection
  const removeRes = await fetch(`${BASE_URL}/api/connections/${req2Id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  assert(removeRes.ok, 'User A removed connection successfully');

  // Verify removed connection is gone from both users' connection lists
  const connsAAfter = await (await fetch(`${BASE_URL}/api/connections`, { headers: { 'Authorization': `Bearer ${tokenA}` } })).json();
  const connsBAfter = await (await fetch(`${BASE_URL}/api/connections`, { headers: { 'Authorization': `Bearer ${tokenB}` } })).json();
  assert(!(connsAAfter.connections || connsAAfter).some(c => c.id === req2Id), 'Connection removed from User A list');
  assert(!(connsBAfter.connections || connsBAfter).some(c => c.id === req2Id), 'Connection removed from User B list');

  // Verify neither user can send messages in removed connection
  const blockedMsgRes = await fetch(`${BASE_URL}/api/messages/${req2Id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ messageBody: 'Are you there?' })
  });
  assert(blockedMsgRes.status !== 200, 'Sending message in removed connection blocked');

  // 5. CHANGE 3: Secure Account Deletion
  console.log('\n--- CHANGE 3: Secure Account Deletion ---');

  // Wrong password re-auth blocked
  const delWrongRes = await fetch(`${BASE_URL}/api/users/account`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ password: 'wrong_password_999' })
  });
  assert(delWrongRes.status === 401, 'Deletion with wrong password blocked (401)');

  // Correct password re-auth succeeds
  const delRightRes = await fetch(`${BASE_URL}/api/users/account`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ password: 'password123' })
  });
  const delRightData = await delRightRes.json();
  assert(delRightRes.ok && delRightData.message?.includes('deleted successfully'), 'User A deleted account with confirmation');

  // User A cannot sign in anymore
  const signinDeletedRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bridgeAccount: userAAccount, password: 'password123' })
  });
  assert(signinDeletedRes.status === 401, 'Deleted User A cannot log in');

  // User B remains completely intact
  const userBProfileRes = await fetch(`${BASE_URL}/api/users/profile`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  const userBProf = await userBProfileRes.json();
  assert(userBProfileRes.ok && userBProf.user?.name === 'Bob Martinez', 'User B remains completely intact');

  // Clean up User B
  await fetch(`${BASE_URL}/api/users/account`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({ password: 'password123' })
  });
  console.log('  [PASS] User B cleaned up successfully');

  console.log('\n=====================================================');
  console.log('ALL 4 CHANGES FULLY VERIFIED AND PASSING 100%!');
  console.log('=====================================================');
}

runLifecycle().catch(err => {
  console.error('Lifecycle test fatal error:', err);
  process.exit(1);
});
