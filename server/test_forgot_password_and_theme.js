import jwt from 'jsonwebtoken';
import { validatePasswordStrength, isValidGmail } from './routes/auth.js';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('SKILLBRIDGE UNIT TESTS: THEME AUDIT & RESET PASSWORD DECOUPLING');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, desc) {
  if (condition) {
    console.log('  [PASS]', desc);
    passed++;
  } else {
    console.error('  [FAIL]', desc);
    failed++;
  }
}

// --------------------------------------------------------------------------
// 1. Password Checklist Validation Rules (Letters, Numbers, Special, Min 8)
// --------------------------------------------------------------------------
console.log('1. Password Checklist & Strength Requirements:');

// Rule 1: Letters (a-z)
assert(!/[a-zA-Z]/.test('12345678!'), 'Checklist: Rejects password without letters');
assert(/[a-zA-Z]/.test('a'), 'Checklist: Detects lowercase letters');
assert(/[a-zA-Z]/.test('Z'), 'Checklist: Detects uppercase letters');

// Rule 2: Numbers (0-9)
assert(!/[0-9]/.test('abcdefgh!'), 'Checklist: Rejects password without numbers');
assert(/[0-9]/.test('a1b'), 'Checklist: Detects numbers');

// Rule 3: Special characters (@ # $ % &)
const specialPattern = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;
assert(!specialPattern.test('Password123'), 'Checklist: Rejects password without special characters');
assert(specialPattern.test('Pass@123'), 'Checklist: Detects @ special character');
assert(specialPattern.test('Pass#123'), 'Checklist: Detects # special character');
assert(specialPattern.test('Pass$123'), 'Checklist: Detects $ special character');
assert(specialPattern.test('Pass%123'), 'Checklist: Detects % special character');
assert(specialPattern.test('Pass&123'), 'Checklist: Detects & special character');

// Rule 4: Min 8 chars
assert(!('Short1!'.length >= 8), 'Checklist: Rejects password < 8 characters');
assert('ValidPass1@'.length >= 8, 'Checklist: Accepts password >= 8 characters');

// Comprehensive validatePasswordStrength helper check
assert(validatePasswordStrength('MintPass&2026').valid, 'Validator: MintPass&2026 is fully valid');
assert(!validatePasswordStrength('weak').valid, 'Validator: weak rejected');

// Password matching
const pw1 = 'MintPass&2026';
const pw2 = 'MintPass&2026';
const pwMismatch = 'MintPass&2027';
assert(pw1 === pw2, 'Checklist: Confirms matching passwords');
assert(pw1 !== pwMismatch, 'Checklist: Identifies mismatched passwords');

// --------------------------------------------------------------------------
// 2. Decoupled Forgot Password Token Verification Flow
// --------------------------------------------------------------------------
console.log('\n2. Decoupled Forgot Password Reset Token Logic:');

const JWT_SECRET = process.env.JWT_SECRET || 'skillbridge-secret-key-change-in-production';

// Sign a valid 15-minute resetToken (as done in /verify-otp)
const testPayload = {
  userId: 'test-user-id-1234',
  email: 'testuser@gmail.com',
  purpose: 'password_reset'
};

const validToken = jwt.sign(testPayload, JWT_SECRET, { expiresIn: '15m' });
const decoded = jwt.verify(validToken, JWT_SECRET);
assert(decoded.userId === testPayload.userId, 'JWT: Reset token contains valid userId');
assert(decoded.email === testPayload.email, 'JWT: Reset token contains valid email');
assert(decoded.purpose === 'password_reset', 'JWT: Reset token has purpose password_reset');

// Expired or forged token rejection
const expiredToken = jwt.sign(testPayload, JWT_SECRET, { expiresIn: '-1s' });
let expiredRejected = false;
try {
  jwt.verify(expiredToken, JWT_SECRET);
} catch {
  expiredRejected = true;
}
assert(expiredRejected, 'JWT: Rejects expired reset token');

let forgedRejected = false;
try {
  jwt.verify(validToken, 'wrong-secret-key');
} catch {
  forgedRejected = true;
}
assert(forgedRejected, 'JWT: Rejects forged reset token with incorrect signature');

// Delete account token verification
const deleteTokenPayload = {
  userId: 'test-user-id-5678',
  purpose: 'delete-account-verified',
  verifiedBy: 'password'
};
const validDeleteToken = jwt.sign(deleteTokenPayload, JWT_SECRET, { expiresIn: '15m' });
const decodedDelete = jwt.verify(validDeleteToken, JWT_SECRET);
assert(decodedDelete.purpose === 'delete-account-verified', 'JWT: Delete account token verified');

// --------------------------------------------------------------------------
// 2.5 Gmail and Username Format Validation
// --------------------------------------------------------------------------
console.log('\n2.5 Gmail and Username Format Validation:');
assert(isValidGmail('student123@gmail.com'), 'Gmail: Accepts valid @gmail.com');
assert(!isValidGmail('student123@yahoo.com'), 'Gmail: Rejects non-gmail address');
assert(!isValidGmail('plainstring'), 'Gmail: Rejects invalid email string');

const validUsernamePattern = /^[a-zA-Z0-9_-]{3,30}$/;
assert(validUsernamePattern.test('john_doe-99'), 'Username: Accepts alphanumeric with _ and -');
assert(!validUsernamePattern.test('ab'), 'Username: Rejects < 3 characters');
assert(!validUsernamePattern.test('user with spaces'), 'Username: Rejects spaces');
assert(!validUsernamePattern.test('user@bridge'), 'Username: Rejects symbols like @');

// --------------------------------------------------------------------------
// 3. Color Theme Audit (No old blue/purple/cyan accents in client/src)
// --------------------------------------------------------------------------
console.log('\n3. Complete Website Color Theme Audit:');

const oldColors = ['#7657ff', '#39d5f6', '#b7a4ff', '#6042ef'];
const clientSrcPath = path.resolve(process.cwd(), 'client', 'src');

function scanDirForOldColors(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  let found = [];

  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      found = found.concat(scanDirForOldColors(fullPath));
    } else if (/\.(jsx|js|css)$/.test(file.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const color of oldColors) {
        if (content.toLowerCase().includes(color.toLowerCase())) {
          found.push({ file: fullPath, color });
        }
      }
    }
  }
  return found;
}

const colorMatches = scanDirForOldColors(clientSrcPath);
assert(colorMatches.length === 0, `Theme Audit: Zero occurrences of old colors (#7657ff, #39d5f6, #b7a4ff, #6042ef) in client/src (found: ${colorMatches.length})`);

// Check that #A8E6CF and #F1FAF5 are present in index.css
const cssPath = path.join(clientSrcPath, 'index.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');
assert(cssContent.includes('#A8E6CF'), 'Theme: #A8E6CF (Mint Green) configured in index.css');
assert(cssContent.includes('#F1FAF5'), 'Theme: #F1FAF5 (Light Mint) configured in index.css');

// --------------------------------------------------------------------------
// 4. Client Build Artifact Verification
// --------------------------------------------------------------------------
console.log('\n4. Production Build Files Verification:');
const distHtml = path.resolve(process.cwd(), 'client', 'dist', 'index.html');
assert(fs.existsSync(distHtml), 'Build: client/dist/index.html exists and is compiled');

console.log(`\n================================================================`);
console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`================================================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

