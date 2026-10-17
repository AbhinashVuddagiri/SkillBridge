import bcrypt from 'bcryptjs';
import express from 'express';
import cors from 'cors';
import { dbService } from './db.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import connectionsRoutes from './routes/connections.js';
import notificationsRoutes from './routes/notifications.js';
import messagesRoutes from './routes/messages.js';

async function runHttpVerification() {
  console.log('=====================================================');
  console.log('SKILLBRIDGE HTTP REST API FULL CHAT & STATUS TEST');
  console.log('=====================================================\n');

  // 1. Create and start express app on a local port
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/connections', connectionsRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/messages', messagesRoutes);

  const server = app.listen(5099);
  const BASE_URL = 'http://localhost:5099';

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

  try {
    const suffix = Date.now().toString(36);
    const accountA = `alice_${suffix}`;
    const accountB = `bob_${suffix}`;

    // Step 1: Register User A and User B via HTTP API
    console.log('--- Step 1: Register User A and User B via HTTP API ---');
    const resA = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Alice Developer',
        instituteName: 'MIT Tech',
        bridgeAccount: accountA,
        password: 'Password123!',
        confirmPassword: 'Password123!'
      })
    });
    const dataA = await resA.json();
    assert(resA.ok && dataA.token, `User A registered successfully (${accountA})`);
    const tokenA = dataA.token;
    const userA = dataA.user;

    const resB = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Bob Designer',
        instituteName: 'Stanford Design',
        bridgeAccount: accountB,
        password: 'Password123!',
        confirmPassword: 'Password123!'
      })
    });
    const dataB = await resB.json();
    assert(resB.ok && dataB.token, `User B registered successfully (${accountB})`);
    const tokenB = dataB.token;
    const userB = dataB.user;

    // Complete their profiles
    await fetch(`${BASE_URL}/api/users/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
      body: JSON.stringify({
        name: 'Alice Developer',
        instituteName: 'MIT Tech',
        skillsTeach: ['React', 'Node.js'],
        skillsLearn: ['Figma', 'UI Design']
      })
    });

    await fetch(`${BASE_URL}/api/users/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
      body: JSON.stringify({
        name: 'Bob Designer',
        instituteName: 'Stanford Design',
        skillsTeach: ['Figma', 'UI Design'],
        skillsLearn: ['React', 'JavaScript']
      })
    });

    // Step 2: Connection Lifecycle: Request -> Decline -> Request Again -> Accept
    console.log('\n--- Step 2: Connection Cycle: Request -> Decline -> Connect Again -> Accept ---');
    // 1. User A sends connection request to User B
    const sendReq1 = await fetch(`${BASE_URL}/api/connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
      body: JSON.stringify({ recipientId: userB.id })
    });
    const req1Data = await sendReq1.json();
    assert(sendReq1.ok && req1Data.connection?.status === 'pending', `Request 1 sent (ID: ${req1Data.connection?.id})`);
    const req1Id = req1Data.connection.id;

    // 2. User B declines Request 1
    const decline1 = await fetch(`${BASE_URL}/api/connections/${req1Id}/reject`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    assert(decline1.ok, 'User B declined Request 1');

    // Verify Explore Skills shows rejected
    const explore1 = await (await fetch(`${BASE_URL}/api/users`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    })).json();
    const bobCard1 = explore1.users.find(u => u.id === userB.id);
    assert(bobCard1?.connectionStatus === 'rejected', `User A sees Bob as 'rejected' ("Declined — Connect Again")`);

    // 3. User A sends ANOTHER request to User B
    const sendReq2 = await fetch(`${BASE_URL}/api/connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
      body: JSON.stringify({ recipientId: userB.id })
    });
    const req2Data = await sendReq2.json();
    assert(sendReq2.ok && req2Data.connection?.id !== req1Id, `Request 2 sent with new ID (${req2Data.connection?.id})`);
    const req2Id = req2Data.connection.id;

    // 4. User B accepts Request 2
    const accept2 = await fetch(`${BASE_URL}/api/connections/${req2Id}/accept`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    assert(accept2.ok, 'User B accepted Request 2');

    // 5. CRITICAL CHECK: User A's Explore Skills card MUST immediately change to 'accepted' ("Connected — Open Chat")
    const explore2 = await (await fetch(`${BASE_URL}/api/users`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    })).json();
    const bobCard2 = explore2.users.find(u => u.id === userB.id);
    assert(bobCard2?.connectionStatus === 'accepted', `CRITICAL FIX: User A sees Bob as 'accepted' ("Connected — Open Chat"), NOT 'rejected'!`);
    assert(bobCard2?.connectionId === req2Id, `Connection ID is correctly populated for Open Chat button (${bobCard2?.connectionId})`);

    // Step 3: Chat HTTP API (Send, Reply, Edit, Unsend, Delete For Me, Clear Chat)
    console.log('\n--- Step 3: Chat HTTP API Tests ---');
    // Alice sends msg 1
    const sendMsg1 = await fetch(`${BASE_URL}/api/messages/${req2Id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
      body: JSON.stringify({ messageBody: 'Hello Bob! Excited to exchange skills.' })
    });
    const msg1Data = await sendMsg1.json();
    assert(sendMsg1.ok && msg1Data.message?.id, `Message 1 sent via HTTP API (ID: ${msg1Data.message?.id})`);
    const msg1Id = msg1Data.message.id;

    // Bob replies to msg 1
    const sendMsg2 = await fetch(`${BASE_URL}/api/messages/${req2Id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
      body: JSON.stringify({ messageBody: 'Hey Alice! Absolutely.', replyToId: msg1Id })
    });
    const msg2Data = await sendMsg2.json();
    assert(sendMsg2.ok && msg2Data.message?.replyToId === msg1Id, `Message 2 sent by Bob as a reply to Msg 1`);

    // Fetch conversation and verify reply snippet
    const getConv1 = await (await fetch(`${BASE_URL}/api/messages/${req2Id}`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    })).json();
    const fetchedMsg2 = getConv1.messages.find(m => m.id === msg2Data.message.id);
    assert(fetchedMsg2?.replyTo?.id === msg1Id && fetchedMsg2?.replyTo?.messageBody.includes('Excited to exchange'), `Message 2 reply preview populated in conversation response`);

    // Alice edits message 1
    const editMsg1 = await fetch(`${BASE_URL}/api/messages/${msg1Id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
      body: JSON.stringify({ messageBody: 'Hello Bob! Excited to exchange skills. (Edited)' })
    });
    const editData = await editMsg1.json();
    assert(editMsg1.ok && editData.message?.isEdited === true, `Message 1 edited by Alice (isEdited: true)`);

    // Bob attempts to edit Alice's message (MUST be forbidden)
    const badEdit = await fetch(`${BASE_URL}/api/messages/${msg1Id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
      body: JSON.stringify({ messageBody: 'Hacked body' })
    });
    assert(badEdit.status === 403, `Bob cannot edit Alice's message (HTTP 403 Forbidden check passed)`);

    // Alice deletes message 1 for herself
    const delForMe = await fetch(`${BASE_URL}/api/messages/${msg1Id}/delete-for-me`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    assert(delForMe.ok, `Alice deleted Msg 1 for herself`);

    const convAliceAfterDel = await (await fetch(`${BASE_URL}/api/messages/${req2Id}`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    })).json();
    const convBobAfterDel = await (await fetch(`${BASE_URL}/api/messages/${req2Id}`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    })).json();
    assert(!convAliceAfterDel.messages.some(m => m.id === msg1Id), `Msg 1 is hidden from Alice`);
    assert(convBobAfterDel.messages.some(m => m.id === msg1Id), `Msg 1 is STILL VISIBLE to Bob`);

    // Alice sends msg 3 and unsends it
    const sendMsg3 = await fetch(`${BASE_URL}/api/messages/${req2Id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
      body: JSON.stringify({ messageBody: 'This message will be unsent.' })
    });
    const msg3Data = await sendMsg3.json();
    const msg3Id = msg3Data.message.id;

    const unsendRes = await fetch(`${BASE_URL}/api/messages/${msg3Id}/unsend`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    assert(unsendRes.ok, `Alice unsent Msg 3`);

    const convAliceAfterUnsend = await (await fetch(`${BASE_URL}/api/messages/${req2Id}`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    })).json();
    const convBobAfterUnsend = await (await fetch(`${BASE_URL}/api/messages/${req2Id}`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    })).json();
    assert(!convAliceAfterUnsend.messages.some(m => m.id === msg3Id), `Unsent Msg 3 removed from Alice`);
    assert(!convBobAfterUnsend.messages.some(m => m.id === msg3Id), `Unsent Msg 3 removed from Bob (removed for BOTH users)`);

    // Bob clears chat
    const clearRes = await fetch(`${BASE_URL}/api/messages/${req2Id}/clear`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    assert(clearRes.ok, `Bob cleared chat`);

    const convBobAfterClear = await (await fetch(`${BASE_URL}/api/messages/${req2Id}`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    })).json();
    assert(convBobAfterClear.messages.length === 0, `Bob's chat history is empty after clear chat`);

    // Alice sends message 4 after Bob's clear chat
    const sendMsg4 = await fetch(`${BASE_URL}/api/messages/${req2Id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
      body: JSON.stringify({ messageBody: 'Fresh message after clear chat!' })
    });
    const msg4Data = await sendMsg4.json();
    const convBobAfterMsg4 = await (await fetch(`${BASE_URL}/api/messages/${req2Id}`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    })).json();
    assert(convBobAfterMsg4.messages.length === 1 && convBobAfterMsg4.messages[0].id === msg4Data.message.id, `New message sent after clear chat appears in Bob's view`);

    // Step 4: Mute / Unmute Notifications
    console.log('\n--- Step 4: Mute / Unmute Notifications ---');
    const muteRes1 = await fetch(`${BASE_URL}/api/connections/${req2Id}/mute`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const muteData1 = await muteRes1.json();
    assert(muteRes1.ok && muteData1.isMuted === true, `Alice muted conversation`);

    const mutedA = await (await fetch(`${BASE_URL}/api/connections/muted`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    })).json();
    assert(mutedA.mutedIds.includes(req2Id), `Connection is in Alice's muted list`);

    const mutedB = await (await fetch(`${BASE_URL}/api/connections/muted`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    })).json();
    assert(!mutedB.mutedIds.includes(req2Id), `Connection is NOT in Bob's muted list (mute is individual)`);

    const unmuteRes = await fetch(`${BASE_URL}/api/connections/${req2Id}/mute`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const unmuteData = await unmuteRes.json();
    assert(unmuteRes.ok && unmuteData.isMuted === false, `Alice unmuted conversation`);

    // Step 5: Remove Connection
    console.log('\n--- Step 5: Remove Connection ---');
    const removeRes = await fetch(`${BASE_URL}/api/connections/${req2Id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    assert(removeRes.ok, `Alice removed connection`);

    const connsA = await (await fetch(`${BASE_URL}/api/connections`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    })).json();
    assert(!connsA.connections.some(c => c.id === req2Id), `Connection removed from Alice's active connection list`);

    // Step 6: Cleanup Test Accounts
    console.log('\n--- Step 6: Cleanup Test Accounts ---');
    await fetch(`${BASE_URL}/api/users/account`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
      body: JSON.stringify({ password: 'Password123!' })
    });
    await fetch(`${BASE_URL}/api/users/account`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
      body: JSON.stringify({ password: 'Password123!' })
    });
    console.log('  Cleaned up Alice and Bob.');

    console.log('\n=====================================================');
    console.log(`HTTP API TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=====================================================');

    server.close();
    if (failed > 0) process.exit(1);
    process.exit(0);
  } catch (err) {
    console.error('Test execution failed:', err);
    server.close();
    process.exit(1);
  }
}

runHttpVerification();
