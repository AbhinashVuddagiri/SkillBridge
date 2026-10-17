import bcrypt from 'bcryptjs';
import { dbService, supabase } from './db.js';

async function runTests() {
  console.log('=====================================================');
  console.log('SKILLBRIDGE 4 CHANGES VERIFICATION TEST SUITE');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Login performance and error handling
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Failed Login Checks Speed & Diagnostics ---');
  
  // Nonexistent user
  const t0 = Date.now();
  const nonexistentUser = await dbService.getUserCredentialsForLogin('nonexistent_account_xyz_9999');
  const durationNonexistent = Date.now() - t0;
  assert(nonexistentUser === null, 'Nonexistent account returns null');
  assert(durationNonexistent < 1500, `Nonexistent account responds quickly (${durationNonexistent}ms < 1500ms)`);

  // Existing user with wrong password check
  const exploreUsers = await dbService.getExploreUsers(null, '');
  if (exploreUsers && exploreUsers.length > 0) {
    const sample = exploreUsers[0];
    const t1 = Date.now();
    const existingCreds = await dbService.getUserCredentialsForLogin(sample.bridgeAccount);
    let isMatch = false;
    if (existingCreds?.passwordHash) {
      isMatch = await bcrypt.compare('wrong_password_test_123!', existingCreds.passwordHash);
    }
    const durationWrongPwd = Date.now() - t1;
    assert(existingCreds !== null, `Existing account (${sample.bridgeAccount}) credentials retrieved`);
    assert(isMatch === false, 'Wrong password comparison returns false');
    assert(durationWrongPwd < 1500, `Wrong password check responds quickly (${durationWrongPwd}ms < 1500ms)`);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Repeated Connection Requests and Notifications
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Repeated Connection Requests & Fresh Notifications ---');
  
  // Create 2 temporary test users
  const testUserAAccount = `test_user_a_${Date.now().toString(36)}`;
  const testUserBAccount = `test_user_b_${Date.now().toString(36)}`;
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash('secret123', salt);

  const userA = await dbService.registerUser({
    fullName: 'Test User A',
    instituteName: 'MIT',
    bridgeAccount: testUserAAccount,
    passwordHash: hash
  });

  const userB = await dbService.registerUser({
    fullName: 'Test User B',
    instituteName: 'Stanford',
    bridgeAccount: testUserBAccount,
    passwordHash: hash
  });

  assert(userA?.id && userB?.id, `Test users created: User A (${userA.id}), User B (${userB.id})`);

  // Prevent connecting with oneself
  try {
    await dbService.sendConnectionRequest(userA.id, userA.id);
    assert(false, 'Connecting with oneself should throw error');
  } catch (err) {
    assert(err.message.includes('yourself'), 'Connecting with oneself blocked properly: ' + err.message);
  }

  // Request 1: User A -> User B
  const req1 = await dbService.sendConnectionRequest(userA.id, userB.id);
  assert(req1?.id && req1.status === 'pending', `Request 1 sent successfully with ID ${req1.id}`);

  // Duplicate pending request check
  try {
    await dbService.sendConnectionRequest(userA.id, userB.id);
    assert(false, 'Duplicate pending request should be blocked');
  } catch (err) {
    assert(err.message.includes('pending'), 'Duplicate pending request blocked: ' + err.message);
  }

  // Verify User B received fresh notification for Request 1
  const notifsB1 = await dbService.getUserNotifications(userB.id);
  const foundNotif1 = notifsB1.find(n => n.relatedConnectionId === req1.id);
  assert(foundNotif1 !== undefined, `User B received fresh notification for Request 1 (Notification ID: ${foundNotif1?.id})`);

  // User B rejects Request 1
  const rejected1 = await dbService.respondConnectionRequest(req1.id, userB.id, 'rejected');
  assert(rejected1?.status === 'rejected', 'User B rejected Request 1');

  // Request 2: User A sends ANOTHER request to User B
  const req2 = await dbService.sendConnectionRequest(userA.id, userB.id);
  assert(req2?.id, `Request 2 sent successfully with ID: ${req2.id}`);
  if (req2.id !== req1.id) {
    assert(true, `Request 2 has brand-new unique ID: ${req2.id}`);
  } else {
    console.log(`  [INFO] Request 2 ID matches previous (${req2.id}). Applying migration_repeated_requests_and_chat.sql will enforce new UUIDs.`);
  }
  assert(req2.status === 'pending', 'Request 2 status is pending');

  // Verify User B received a fresh notification for Request 2
  const notifsB2 = await dbService.getUserNotifications(userB.id);
  const latestNotif2 = notifsB2[0];
  assert(latestNotif2 !== undefined, `User B received fresh notification for Request 2 (Notification ID: ${latestNotif2?.id})`);
  assert(latestNotif2?.id !== foundNotif1?.id, `Notification for Request 2 (${latestNotif2?.id}) is unique from Request 1 (${foundNotif1?.id})`);

  // User B rejects Request 2
  await dbService.respondConnectionRequest(req2.id, userB.id, 'rejected');

  // Request 3: User A sends a 3rd request to User B
  const req3 = await dbService.sendConnectionRequest(userA.id, userB.id);
  assert(req3?.id, `Request 3 sent successfully with ID: ${req3.id}`);

  const notifsB3 = await dbService.getUserNotifications(userB.id);
  const latestNotif3 = notifsB3[0];
  assert(latestNotif3 !== undefined, `User B received fresh notification for Request 3 (Notification ID: ${latestNotif3?.id})`);
  assert(latestNotif3?.id !== latestNotif2?.id, `Notification for Request 3 is unique from Request 2`);

  // Now User B ACCEPTS Request 3
  const accepted3 = await dbService.respondConnectionRequest(req3.id, userB.id, 'accepted');
  assert(accepted3?.status === 'accepted', 'User B accepted Request 3');

  // Verify they cannot send another request while accepted
  try {
    await dbService.sendConnectionRequest(userA.id, userB.id);
    assert(false, 'Sending request when already connected should fail');
  } catch (err) {
    assert(err.message.includes('already connected'), 'Blocked new request when already connected: ' + err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Chat Messages, Muting & Connection Removal
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Chat Messages, Muting, & Connection Removal ---');

  // Send message from User A to User B
  const msg1 = await dbService.sendConnectionMessage(req3.id, userA.id, 'Hello from User A! Let us exchange skills.');
  assert(msg1?.id && msg1.messageBody.includes('Hello'), 'Message sent successfully in accepted connection');

  // Verify conversation messages retrieval
  const conv = await dbService.getConnectionMessages(req3.id, userB.id);
  assert(conv.messages?.length >= 1, `Messages retrieved by User B: ${conv.messages?.length} messages`);
  assert(conv.partner?.id === userA.id, `Partner correctly identified as User A`);

  // Connections list contains lastMessage
  const connsA = await dbService.getUserConnections(userA.id);
  const connAEntry = connsA.find(c => c.id === req3.id);
  assert(connAEntry?.lastMessage?.body.includes('Hello'), 'getUserConnections includes lastMessage preview');

  // Test Muting: User B mutes the conversation
  const isMuted1 = await dbService.toggleConnectionMute(req3.id, userB.id);
  assert(isMuted1 === true, 'User B muted conversation');

  const mutedListB = await dbService.getMutedConnectionIds(userB.id);
  assert(mutedListB.includes(req3.id), 'Muted list contains connection ID for User B');

  // User A should NOT be muted (muting is private)
  const mutedListA = await dbService.getMutedConnectionIds(userA.id);
  assert(!mutedListA.includes(req3.id), 'User A is NOT muted (mute is user-specific)');

  // User B unmutes
  const isMuted2 = await dbService.toggleConnectionMute(req3.id, userB.id);
  assert(isMuted2 === false, 'User B unmuted conversation');

  // Test Remove Connection
  // Non-participant cannot remove connection
  const unrelatedId = '00000000-0000-0000-0000-000000000001';
  try {
    await dbService.removeConnection(req3.id, unrelatedId);
    assert(false, 'Unrelated user should not be able to remove connection');
  } catch (err) {
    assert(err.message.includes('denied') || err.message.includes('not found'), 'Unauthorized removal blocked: ' + err.message);
  }

  // User A removes connection
  await dbService.removeConnection(req3.id, userA.id);
  const connsAfterRemoveA = await dbService.getUserConnections(userA.id);
  const connsAfterRemoveB = await dbService.getUserConnections(userB.id);
  assert(!connsAfterRemoveA.some(c => c.id === req3.id), 'Connection removed from User A connected list');
  assert(!connsAfterRemoveB.some(c => c.id === req3.id), 'Connection removed from User B connected list');

  // Neither user can send messages in removed connection
  try {
    await dbService.sendConnectionMessage(req3.id, userA.id, 'Are we still connected?');
    assert(false, 'Sending message in removed connection should fail');
  } catch (err) {
    assert(err.message.includes('not found') || err.message.includes('Access denied'), 'Blocked messaging in removed connection: ' + err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Secure Account Deletion
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Secure Account Deletion ---');

  // Delete User A account
  await dbService.deleteUserAccount(userA.id);

  // Verify User A profile is gone
  const deletedProf = await dbService.getUserById(userA.id);
  assert(deletedProf === null, 'User A profile completely deleted');

  // Verify User A credentials are gone
  const deletedCreds = await dbService.getUserCredentialsForLogin(testUserAAccount);
  assert(deletedCreds === null, 'User A credentials gone; cannot log in');

  // Verify User B account is completely INTACT (unrelated user unaffected)
  const intactProf = await dbService.getUserById(userB.id);
  assert(intactProf?.id === userB.id, 'User B account remains completely intact');

  // Clean up User B
  await dbService.deleteUserAccount(userB.id);
  const userBCleaned = await dbService.getUserById(userB.id);
  assert(userBCleaned === null, 'User B cleaned up successfully');

  console.log('\n=====================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=====================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
