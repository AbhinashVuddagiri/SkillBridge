import bcrypt from 'bcryptjs';
import { dbService, supabase } from './db.js';

async function runVerification() {
  console.log('=====================================================');
  console.log('SKILLBRIDGE CHAT IMPROVEMENTS & CONNECTION VERIFICATION');
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

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash('testpass123', salt);
  const suffix = Date.now().toString(36);

  // 1. Create two completed user profiles
  console.log('--- Step 1: Create Test Users ---');
  const userA = await dbService.registerUser({
    fullName: 'Alice Developer',
    instituteName: 'MIT Tech',
    bridgeAccount: `alice_${suffix}`,
    passwordHash: hash
  });

  const userB = await dbService.registerUser({
    fullName: 'Bob Designer',
    instituteName: 'Stanford Design',
    bridgeAccount: `bob_${suffix}`,
    passwordHash: hash
  });

  assert(userA?.id && userB?.id, `Users created: Alice (${userA.id}), Bob (${userB.id})`);

  // Complete their profiles
  await dbService.updateUserProfile(userA.id, {
    name: 'Alice Developer',
    instituteName: 'MIT Tech',
    skillsTeach: ['React', 'Node.js'],
    skillsLearn: ['Figma', 'UI Design']
  });

  await dbService.updateUserProfile(userB.id, {
    name: 'Bob Designer',
    instituteName: 'Stanford Design',
    skillsTeach: ['Figma', 'UI Design'],
    skillsLearn: ['React', 'JavaScript']
  });

  // --------------------------------------------------------------------------
  // TEST: CHANGE 2 — Request -> Decline -> Request Again -> Accept -> Status
  // --------------------------------------------------------------------------
  console.log('\n--- Step 2: Test Connection Request -> Decline -> Request Again -> Accept Flow ---');
  
  // 1. User A sends request to User B
  const req1 = await dbService.sendConnectionRequest(userA.id, userB.id);
  assert(req1?.status === 'pending', `Request 1 sent with status 'pending' (ID: ${req1.id})`);

  // 2. User B declines it
  const declined = await dbService.respondConnectionRequest(req1.id, userB.id, 'rejected');
  assert(declined?.status === 'rejected', `Request 1 declined by User B with status 'rejected'`);

  // Verify explore status for User A viewing User B
  const exploreAfterDecline = await dbService.getExploreUsers(userA.id, '');
  const bobCard1 = exploreAfterDecline.find(u => u.id === userB.id);
  assert(bobCard1?.connectionStatus === 'rejected', `User A sees Bob's status as 'rejected' ("Declined — Connect Again")`);

  // 3. User A sends another request to User B
  const req2 = await dbService.sendConnectionRequest(userA.id, userB.id);
  assert(req2?.status === 'pending' && req2.id !== req1.id, `Request 2 sent with new unique ID (${req2.id}) and status 'pending'`);

  // 4. User B accepts the second request
  const accepted = await dbService.respondConnectionRequest(req2.id, userB.id, 'accepted');
  assert(accepted?.status === 'accepted', `Request 2 accepted by User B`);

  // 5. Verify User A's explore skills card IMMEDIATELY shows 'accepted', NOT 'rejected'
  const exploreAfterAccept = await dbService.getExploreUsers(userA.id, '');
  const bobCard2 = exploreAfterAccept.find(u => u.id === userB.id);
  assert(bobCard2?.connectionStatus === 'accepted', `CRITICAL FIX: User A sees Bob's status as 'accepted' ("Connected — Open Chat"), NOT 'rejected'!`);
  assert(bobCard2?.connectionId === req2.id, `Connection ID returned matches accepted connection (${req2.id})`);

  // --------------------------------------------------------------------------
  // TEST: CHANGE 1 — Chat Features (Send, Reply, Edit, Unsend, Delete for me, Clear)
  // --------------------------------------------------------------------------
  console.log('\n--- Step 3: Test Chat Features ---');

  // Send message 1 from Alice to Bob
  const msg1 = await dbService.sendConnectionMessage(req2.id, userA.id, 'Hello Bob! Excited to exchange skills.');
  assert(msg1?.id && msg1.messageBody === 'Hello Bob! Excited to exchange skills.', `Message 1 sent by Alice (ID: ${msg1.id})`);

  // Reply to message 1 from Bob
  const msg2 = await dbService.sendConnectionMessage(req2.id, userB.id, 'Hey Alice! Absolutely, let us do this.', msg1.id);
  assert(msg2?.id && msg2.replyToId === msg1.id, `Message 2 sent by Bob with reply reference to msg1 (replyToId: ${msg2.replyToId})`);

  // Fetch messages and verify reply metadata is populated
  const conv1 = await dbService.getConnectionMessages(req2.id, userA.id);
  const fetchedMsg2 = conv1.messages.find(m => m.id === msg2.id);
  assert(fetchedMsg2?.replyTo?.id === msg1.id, `Message 2 has populated replyTo object with original snippet: "${fetchedMsg2?.replyTo?.messageBody}"`);

  // Edit message 1 by Alice
  const editedMsg1 = await dbService.editConnectionMessage(msg1.id, userA.id, 'Hello Bob! Excited to exchange skills. (Updated)');
  assert(editedMsg1?.isEdited === true && editedMsg1.messageBody.includes('(Updated)'), `Message 1 edited by Alice: isEdited is true`);

  // Verify Bob cannot edit Alice's message
  try {
    await dbService.editConnectionMessage(msg1.id, userB.id, 'Hacked text');
    assert(false, `Bob should not be able to edit Alice's message`);
  } catch (err) {
    assert(err.message.includes('own messages'), `Permission check passed: Bob cannot edit Alice's message: ${err.message}`);
  }

  // Delete from me: Alice deletes msg1 for herself only
  await dbService.deleteMessageForMe(msg1.id, userA.id);
  const convAlice = await dbService.getConnectionMessages(req2.id, userA.id);
  const convBob = await dbService.getConnectionMessages(req2.id, userB.id);

  assert(!convAlice.messages.some(m => m.id === msg1.id), `Message 1 is hidden from Alice's view`);
  assert(convBob.messages.some(m => m.id === msg1.id), `Message 1 is STILL VISIBLE to Bob (per-user delete working)`);

  // Send message 3 from Alice to Bob
  const msg3 = await dbService.sendConnectionMessage(req2.id, userA.id, 'This message will be unsent soon.');
  assert(msg3?.id, `Message 3 sent by Alice`);

  // Unsend message 3 by Alice
  await dbService.unsendConnectionMessage(msg3.id, userA.id);
  const convAliceAfterUnsend = await dbService.getConnectionMessages(req2.id, userA.id);
  const convBobAfterUnsend = await dbService.getConnectionMessages(req2.id, userB.id);

  assert(!convAliceAfterUnsend.messages.some(m => m.id === msg3.id), `Unsent Message 3 is removed from Alice's view`);
  assert(!convBobAfterUnsend.messages.some(m => m.id === msg3.id), `Unsent Message 3 is removed from Bob's view (removed for BOTH users)`);

  // Clear chat: Bob clears chat
  await dbService.clearConnectionChat(req2.id, userB.id);
  const convBobAfterClear = await dbService.getConnectionMessages(req2.id, userB.id);
  assert(convBobAfterClear.messages.length === 0, `Bob's chat history is cleared (0 messages)`);

  // Send new message 4 from Alice after clear
  const msg4 = await dbService.sendConnectionMessage(req2.id, userA.id, 'Brand new message after clear chat!');
  const convBobAfterNew = await dbService.getConnectionMessages(req2.id, userB.id);
  assert(convBobAfterNew.messages.length === 1 && convBobAfterNew.messages[0].id === msg4.id, `New message sent after clear chat appears for Bob`);

  // --------------------------------------------------------------------------
  // TEST: Mute Notifications
  // --------------------------------------------------------------------------
  console.log('\n--- Step 4: Test Mute / Unmute Notifications ---');
  const isMuted1 = await dbService.toggleConnectionMute(req2.id, userA.id);
  assert(isMuted1 === true, `Alice muted conversation (isMuted: true)`);

  const mutedListAlice = await dbService.getMutedConnectionIds(userA.id);
  assert(mutedListAlice.includes(req2.id), `req2 is in Alice's muted connections list`);

  const mutedListBob = await dbService.getMutedConnectionIds(userB.id);
  assert(!mutedListBob.includes(req2.id), `Bob's conversation is NOT muted (individual conversation mute working)`);

  const isMuted2 = await dbService.toggleConnectionMute(req2.id, userA.id);
  assert(isMuted2 === false, `Alice unmuted conversation (isMuted: false)`);

  // --------------------------------------------------------------------------
  // TEST: Remove Connection
  // --------------------------------------------------------------------------
  console.log('\n--- Step 5: Test Remove Connection ---');
  await dbService.removeConnection(req2.id, userA.id);
  const connsAfterRemove = await dbService.getUserConnections(userA.id);
  assert(!connsAfterRemove.some(c => c.id === req2.id), `Connection removed from Alice's connection list`);

  // Cleanup test users
  console.log('\n--- Step 6: Cleanup Test Users ---');
  await dbService.deleteUserAccount(userA.id);
  await dbService.deleteUserAccount(userB.id);
  console.log('  Cleaned up test users Alice and Bob.');

  console.log('\n=====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
