import express from 'express';
import jwt from 'jsonwebtoken';
import { dbService } from './db.js';
import usersRoutes from './routes/users.js';
import authRoutes from './routes/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'skillbridge_super_secure_jwt_secret_key_2026_production';

async function runTests() {
  console.log('================================================================');
  console.log('SKILLBRIDGE DELETE ACCOUNT + LINKED GMAIL OTP TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(` [PASS] ${message}`);
      passed++;
    } else {
      console.error(` [FAIL] ${message}`);
      failed++;
    }
  }

  // Set up Express test server
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 1. Existing User Retrieval & Linked Email check
    console.log('1. Testing Linked Email Retrieval:');
    const existingProfile = await dbService.getUserCredentialsForLogin('abhi_bridge');
    assert(existingProfile !== null, 'Existing user abhi_bridge retrieved');
    assert(existingProfile.email === 'vuddagiriabhinash2126@gmail.com', 'Existing user has linked Gmail in DB');

    const userRecord = await dbService.getUserById(existingProfile.id);
    assert(userRecord !== null, 'getUserById resolves existing user');
    assert(userRecord.email === 'vuddagiriabhinash2126@gmail.com', 'getUserById includes linked Gmail (vuddagiriabhinash2126@gmail.com)');

    // Generate valid auth token for existing user
    const userToken = jwt.sign(
      { userId: userRecord.id, bridgeAccount: userRecord.bridgeAccount },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 2. GET /api/auth/me returns linked email
    console.log('\n2. Testing /api/auth/me and /api/users/profile for Linked Email:');
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    const meData = await meRes.json();
    assert(meRes.ok, '/api/auth/me returns 200 OK');
    assert(meData.user?.email === 'vuddagiriabhinash2126@gmail.com', '/api/auth/me provides user.email to frontend');

    const profRes = await fetch(`${baseUrl}/api/users/profile`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    const profData = await profRes.json();
    assert(profRes.ok, '/api/users/profile returns 200 OK');
    assert(profData.user?.email === 'vuddagiriabhinash2126@gmail.com', '/api/users/profile provides user.email to frontend');

    // 3. Normal Password Verification (POST /api/users/account/verify-password)
    console.log('\n3. Testing Delete Account Password Verification:');
    // Empty password
    const emptyPwdRes = await fetch(`${baseUrl}/api/users/account/verify-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ password: '' })
    });
    assert(emptyPwdRes.status === 400, 'Rejects empty password with 400 Bad Request');

    // Wrong password
    const wrongPwdRes = await fetch(`${baseUrl}/api/users/account/verify-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ password: 'IncorrectPassword#999' })
    });
    const wrongPwdData = await wrongPwdRes.json();
    assert(wrongPwdRes.status === 401, 'Rejects incorrect password with 401 Unauthorized');
    assert(wrongPwdData.error.includes('Incorrect password'), 'Returns "Incorrect password. Deletion blocked."');
    assert(!wrongPwdData.deleteToken, 'Does NOT issue deleteToken on incorrect password');

    // Unauthenticated call
    const noAuthPwdRes = await fetch(`${baseUrl}/api/users/account/verify-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'AnyPassword@123' })
    });
    assert(noAuthPwdRes.status === 401, 'Blocks unauthenticated password verification');

    // 4. Send Delete OTP (POST /api/users/account/send-delete-otp)
    console.log('\n4. Testing Send Delete OTP to Linked Gmail:');
    // Unauthenticated call rejected
    const noAuthOtpRes = await fetch(`${baseUrl}/api/users/account/send-delete-otp`, {
      method: 'POST'
    });
    assert(noAuthOtpRes.status === 401, 'Blocks unauthenticated request to send delete OTP');

    // Client passes NO email in body — server resolves linked email automatically
    const sendOtpRes = await fetch(`${baseUrl}/api/users/account/send-delete-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({}) // No email passed from client!
    });
    const sendOtpData = await sendOtpRes.json();
    assert(sendOtpRes.ok, 'send-delete-otp succeeds without requiring client to enter email');
    assert(sendOtpData.email === 'vuddagiriabhinash2126@gmail.com', 'OTP destination is automatically the user\'s registered Gmail');
    assert(sendOtpData.maskedEmail === 'v***@gmail.com', 'Returns masked email for privacy (v***@gmail.com)');

    // Attempting to spoof an email in body is ignored (server still targets linked email, which triggers rate limit on same email)
    const spoofOtpRes = await fetch(`${baseUrl}/api/users/account/send-delete-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ gmail: 'attacker_random_address@gmail.com' })
    });
    const spoofData = await spoofOtpRes.json();
    assert(
      spoofData.email === 'vuddagiriabhinash2126@gmail.com' ||
      (spoofData.error && spoofData.error.includes('For security purposes')),
      'Server strictly targets authenticated user\'s linked email, ignoring spoofed client email'
    );

    // 5. Verify Delete OTP (POST /api/users/account/verify-delete-otp)
    console.log('\n5. Testing Verify Delete OTP:');
    // Empty OTP
    const emptyOtpRes = await fetch(`${baseUrl}/api/users/account/verify-delete-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ otp: '' })
    });
    assert(emptyOtpRes.status === 400, 'Rejects empty OTP with 400');

    // Short OTP
    const shortOtpRes = await fetch(`${baseUrl}/api/users/account/verify-delete-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ otp: '123' })
    });
    assert(shortOtpRes.status === 400, 'Rejects short OTP (< 6 digits) with 400');

    // Wrong OTP
    const wrongOtpRes = await fetch(`${baseUrl}/api/users/account/verify-delete-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ otp: '000000' })
    });
    const wrongOtpData = await wrongOtpRes.json();
    assert(wrongOtpRes.status === 400 || wrongOtpRes.status === 401, 'Rejects invalid OTP with error status');
    assert(wrongOtpData.error === 'Invalid OTP', 'Returns exact required error message: "Invalid OTP"');
    assert(wrongOtpData.verified === false, 'verified is false on wrong OTP');

    // 6. Delete Account Authorization Guard (DELETE /api/users/account)
    console.log('\n6. Testing Permanent Deletion Security Invariants:');
    // Without token or password or OTP
    const unverifiedDelRes = await fetch(`${baseUrl}/api/users/account`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({})
    });
    assert(unverifiedDelRes.status === 401, 'Rejects unverified deletion attempt (no token, no password, no OTP)');

    // With wrong purpose token
    const wrongPurposeToken = jwt.sign(
      { userId: userRecord.id, purpose: 'registration-verified' },
      JWT_SECRET,
      { expiresIn: '15m' }
    );
    const wrongPurposeDelRes = await fetch(`${baseUrl}/api/users/account`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ deleteToken: wrongPurposeToken })
    });
    assert(wrongPurposeDelRes.status === 401, 'Rejects token with purpose registration-verified');

    // With another user's token
    const otherUserToken = jwt.sign(
      { userId: 'different-uuid-1234-5678', purpose: 'delete-account-verified' },
      JWT_SECRET,
      { expiresIn: '15m' }
    );
    const mismatchDelRes = await fetch(`${baseUrl}/api/users/account`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ deleteToken: otherUserToken })
    });
    assert(mismatchDelRes.status === 401, 'Rejects deletion if token userId does not match authenticated user');

    // Expired token
    const expiredToken = jwt.sign(
      { userId: userRecord.id, purpose: 'delete-account-verified' },
      JWT_SECRET,
      { expiresIn: '-1s' }
    );
    const expiredDelRes = await fetch(`${baseUrl}/api/users/account`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ deleteToken: expiredToken })
    });
    assert(expiredDelRes.status === 401, 'Rejects expired deleteToken');

    // 7. Security & Non-leakage Invariants
    console.log('\n7. Testing Security & Non-leakage Invariants:');
    const exploreRes = await fetch(`${baseUrl}/api/users`);
    const exploreData = await exploreRes.json();
    assert(exploreRes.ok, '/api/users returns 200');
    const exposedEmail = (exploreData.users || []).some(u => Boolean(u.email));
    assert(!exposedEmail, 'Explore profiles do NOT expose email addresses');

    console.log(`\n================================================================`);
    console.log(`DELETE ACCOUNT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`================================================================`);
  } finally {
    server.close();
  }

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
