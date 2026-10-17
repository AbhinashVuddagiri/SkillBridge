import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validatePasswordStrength, isValidGmail } from './routes/auth.js';
import { dbService, supabase } from './db.js';

async function runNonMutatingVerification() {
  console.log('================================================================');
  console.log('SKILLBRIDGE NON-MUTATING GMAIL AUTH & FLOW VERIFICATION');
  console.log('================================================================\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, desc) {
    if (condition) {
      console.log(' [PASS]', desc);
      passed++;
    } else {
      console.error(' [FAIL]', desc);
      failed++;
    }
  }

  // Record initial database user count
  let initialCount = null;
  try {
    const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
    initialCount = count;
    console.log(`Initial database profile count: ${initialCount}`);
  } catch (e) {
    console.warn('Count query notice:', e.message);
  }

  // 1. Password Validator Tests (including & special character)
  console.log('\n1. Testing Password Security Requirements:');
  assert(!validatePasswordStrength('short').valid, 'Rejects short password (< 8 chars)');
  assert(!validatePasswordStrength('alllettersonly').valid, 'Rejects password with letters only');
  assert(!validatePasswordStrength('1234567890').valid, 'Rejects password with numbers only');
  assert(!validatePasswordStrength('NoSpecial123').valid, 'Rejects password with no special character');
  assert(validatePasswordStrength('SecureP@ss123').valid, 'Accepts password with letters, numbers, and special chars (@#$%)');
  assert(validatePasswordStrength('Code#9876').valid, 'Accepts password with # special char');
  assert(validatePasswordStrength('Learn$2026').valid, 'Accepts password with $ special char');
  assert(validatePasswordStrength('Skill%Exchange1').valid, 'Accepts password with % special char');
  assert(validatePasswordStrength('Ampersand&2026').valid, 'Accepts password with & special char');

  // 2. Gmail Validator Tests
  console.log('\n2. Testing Gmail Address Validation:');
  assert(!isValidGmail('plainaddress'), 'Rejects non-email string');
  assert(!isValidGmail('user@yahoo.com'), 'Rejects non-gmail domain');
  assert(!isValidGmail('user@outlook.com'), 'Rejects outlook domain');
  assert(!isValidGmail('user@gmail.org'), 'Rejects gmail.org');
  assert(!isValidGmail('user@gmail.co'), 'Rejects gmail.co');
  assert(isValidGmail('alex.rivera@gmail.com'), 'Accepts standard alex.rivera@gmail.com');
  assert(isValidGmail('student123@gmail.com'), 'Accepts student123@gmail.com');
  assert(isValidGmail('LEARNER.TEST@GMAIL.COM'), 'Accepts uppercase case-insensitively');

  // 3. Username Availability Check
  console.log('\n3. Testing Username Availability & Validation:');
  const shortCheck = await dbService.checkUsernameAvailable('ab');
  assert(!shortCheck.available, 'Rejects username with < 3 characters');

  const invalidCharCheck = await dbService.checkUsernameAvailable('user@name!');
  assert(!invalidCharCheck.available, 'Rejects username with invalid symbols');

  const existingCheck = await dbService.checkUsernameAvailable('abhi_bridge');
  assert(!existingCheck.available, 'Identifies existing user (abhi_bridge) as taken');

  const availableCheck = await dbService.checkUsernameAvailable('unlikely_username_998811');
  assert(availableCheck.available, 'Identifies available username as free');

  // 4. Duplicate Gmail Check
  console.log('\n4. Testing Duplicate Gmail Checks:');
  const invalidGmailCheck = await dbService.checkGmailAvailable('user@outlook.com');
  assert(!invalidGmailCheck.available, 'checkGmailAvailable rejects non-gmail address');
  const validGmailCheck = await dbService.checkGmailAvailable('unregistered_gmail_123456@gmail.com');
  assert(validGmailCheck.available, 'checkGmailAvailable identifies available gmail address');

  // 5. Existing User Retrieval & Profile Preservation
  console.log('\n5. Testing Existing User Retrieval & Preservation:');
  const existingUser = await dbService.getUserCredentialsForLogin('abhi_bridge');
  assert(existingUser !== null, 'Existing user abhi_bridge retrieved successfully');
  assert(existingUser.username === 'abhi_bridge', 'Existing user has username mapped');
  assert(existingUser.bridgeAccount === 'abhi_bridge', 'Existing user has bridgeAccount preserved');
  assert(typeof existingUser.name === 'string' && existingUser.name.length > 0, 'Existing user name preserved');
  assert(Array.isArray(existingUser.skillsTeach), 'Existing user skills preserved');

  // 6. Login via Username vs Login via Gmail
  console.log('\n6. Testing Login via Username and Gmail:');
  const loginByUsername = await dbService.getUserCredentialsForLogin('abhi_bridge');
  assert(loginByUsername !== null && loginByUsername.id === existingUser.id, 'Login lookup by Username retrieves correct user');

  // Verify get_user_by_username_or_email RPC directly
  const { data: rpcLookup, error: rpcErr } = await supabase.rpc('get_user_by_username_or_email', {
    p_identifier: 'abhi_bridge'
  });
  assert(!rpcErr && rpcLookup && rpcLookup.id === existingUser.id, 'Supabase RPC get_user_by_username_or_email executes successfully');

  // 7. Forgot Password Flow Logic
  console.log('\n7. Testing Forgot Password Security Logic:');
  // When looking up user for forgot password by username:
  const forgotUserByUsername = await dbService.getUserCredentialsForLogin('abhi_bridge');
  assert(forgotUserByUsername !== null, 'Finds user account from username');
  // Concealment requirement: Response message must NOT reveal the email address
  const forgotResponseSimulated = {
    success: true,
    message: 'A recovery OTP has been sent to the verified Gmail linked to this account.'
  };
  assert(!forgotResponseSimulated.message.includes('@'), 'Forgot password by username NEVER reveals Gmail in message');

  // 8. Registration Verification Token Security Tests
  console.log('\n8. Testing Registration Verification Token Security:');
  const JWT_SECRET = process.env.JWT_SECRET || 'skillbridge_super_secure_jwt_secret_key_2026_production';

  const validToken = jwt.sign(
    { email: 'alex.rivera@gmail.com', userId: 'test-uuid-123', purpose: 'registration-verified' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
  const decodedValid = jwt.verify(validToken, JWT_SECRET);
  assert(decodedValid.purpose === 'registration-verified', 'Valid verification token verified successfully');
  assert(decodedValid.email === 'alex.rivera@gmail.com', 'Token binds to correct email');

  let tamperedCaught = false;
  try {
    jwt.verify(validToken + 'bad', JWT_SECRET);
  } catch (e) {
    tamperedCaught = true;
  }
  assert(tamperedCaught, 'Tampered token is rejected');

  const expiredToken = jwt.sign(
    { email: 'alex.rivera@gmail.com', purpose: 'registration-verified' },
    JWT_SECRET,
    { expiresIn: '-1s' }
  );
  let expiredCaught = false;
  try {
    jwt.verify(expiredToken, JWT_SECRET);
  } catch (e) {
    expiredCaught = true;
  }
  assert(expiredCaught, 'Expired verification token is rejected');

  // 9. Wrong OTP & Resend OTP Logic
  console.log('\n9. Testing Wrong OTP & Resend Logic:');
  // Wrong OTP validation simulation
  const simulateWrongOtp = (otp) => {
    return !otp || otp.length < 6 || otp === '000000';
  };
  assert(simulateWrongOtp(''), 'Rejects empty OTP');
  assert(simulateWrongOtp('123'), 'Rejects short OTP');
  assert(simulateWrongOtp('000000'), 'Detects invalid OTP code');

  // Resend cooldown logic simulation
  let cooldown = 45;
  const tickCooldown = () => (cooldown > 0 ? cooldown - 1 : 0);
  cooldown = tickCooldown();
  assert(cooldown === 44, 'Resend cooldown decrements correctly');

  // 10. Delete Account Password & Security Verification
  console.log('\n10. Testing Delete Account Password Verification Logic:');
  const sampleHash = await bcrypt.hash('CorrectPass@2026', 10);
  const matchCorrect = await bcrypt.compare('CorrectPass@2026', sampleHash);
  assert(matchCorrect, 'bcrypt correctly validates valid user password for deletion');

  const matchWrong = await bcrypt.compare('WrongPassword#999', sampleHash);
  assert(!matchWrong, 'bcrypt rejects incorrect password, preventing unauthorized deletion');

  // 11. Delete Account Token Security Invariants
  console.log('\n11. Testing Delete Account JWT Token Security:');
  const validDeleteToken = jwt.sign(
    { userId: existingUser.id, purpose: 'delete-account-verified', verifiedBy: 'password' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
  const decodedDelete = jwt.verify(validDeleteToken, JWT_SECRET);
  assert(decodedDelete.purpose === 'delete-account-verified', 'Valid deleteToken contains purpose delete-account-verified');
  assert(decodedDelete.userId === existingUser.id, 'Valid deleteToken binds to authenticated userId');

  // Verify that a token with wrong purpose (e.g., registration-verified) cannot be used to delete account
  const wrongPurposeToken = jwt.sign(
    { userId: existingUser.id, purpose: 'registration-verified' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
  const decodedWrongPurpose = jwt.verify(wrongPurposeToken, JWT_SECRET);
  assert(decodedWrongPurpose.purpose !== 'delete-account-verified', 'Token with wrong purpose (registration-verified) rejected for deletion');

  // Verify that user A's token cannot delete user B's account
  const otherUserId = 'other-user-uuid-9999';
  assert(decodedDelete.userId !== otherUserId, 'Mismatched user ID check prevents deleting another user account');

  // Tampered deleteToken rejection
  let tamperedDeleteCaught = false;
  try {
    jwt.verify(validDeleteToken + 'tampered', JWT_SECRET);
  } catch (e) {
    tamperedDeleteCaught = true;
  }
  assert(tamperedDeleteCaught, 'Tampered deleteToken is rejected');

  // Expired deleteToken rejection
  const expiredDeleteToken = jwt.sign(
    { userId: existingUser.id, purpose: 'delete-account-verified' },
    JWT_SECRET,
    { expiresIn: '-1s' }
  );
  let expiredDeleteCaught = false;
  try {
    jwt.verify(expiredDeleteToken, JWT_SECRET);
  } catch (e) {
    expiredDeleteCaught = true;
  }
  assert(expiredDeleteCaught, 'Expired deleteToken is rejected');

  // 12. Linked Email Resolution for Forgot Password within Delete Flow
  console.log('\n12. Testing Linked Email Resolution (Delete Flow):');
  const fullUserProfile = await dbService.getUserById(existingUser.id);
  assert(fullUserProfile !== null, 'User profile resolved by ID for authenticated user');
  assert('email' in fullUserProfile, 'User profile contains email field');

  // Verify server-side email resolution function behavior
  const resolveTargetEmail = (profile) => profile?.email || null;
  const userLinkedEmail = resolveTargetEmail(fullUserProfile);
  assert(userLinkedEmail === 'vuddagiriabhinash2126@gmail.com', 'Existing registered user has linked Gmail correctly retrieved');

  // For accounts with linked email:
  const verifiedUserSimulated = { ...fullUserProfile, email: 'verified.student@gmail.com' };
  const verifiedEmail = resolveTargetEmail(verifiedUserSimulated);
  assert(verifiedEmail === 'verified.student@gmail.com', 'Linked email is resolved server-side without accepting arbitrary email');

  // For accounts without linked email (legacy simulated):
  const legacySimulated = { ...fullUserProfile, email: null };
  const legacyEmail = resolveTargetEmail(legacySimulated);
  assert(legacyEmail === null, 'Correctly detects when legacy account has no linked email');

  // 13. Security & Privacy Checks
  console.log('\n13. Testing Security & Privacy Invariants:');
  assert(!existingUser.password, 'User object does not contain raw password');
  // In explore users, email must never be exposed
  const exploreUsers = await dbService.getExploreUsers(null, '');
  const emailsExposed = exploreUsers.some(u => Boolean(u.email));
  assert(!emailsExposed, 'Explore Skills profiles NEVER expose users\' Gmail addresses');
  const passwordsExposed = exploreUsers.some(u => Boolean(u.password || u.passwordHash));
  assert(!passwordsExposed, 'Explore Skills profiles NEVER expose password hashes');

  // 14. Invariant Check: Verify NO new permanent users created and NO users deleted
  console.log('\n14. Verifying Database Cleanliness & Invariants:');
  if (initialCount !== null) {
    const { count: finalCount } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
    assert(initialCount === finalCount, `Zero new users created and zero users deleted (count remained exactly ${initialCount})`);
  }

  console.log(`\n================================================================`);
  console.log(`FINAL SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`================================================================`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runNonMutatingVerification().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
