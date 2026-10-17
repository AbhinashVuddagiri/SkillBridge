import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { dbService, supabase } from '../db.js';
import { authRequired, signToken } from '../middleware/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'skillbridge_super_secure_jwt_secret_key_2026_production';
const supabaseUrl = process.env.SUPABASE_URL || 'https://lbkeyicltxjzipvzfwlx.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_H3Cee41GdLhMlz5jnzTvjA_UV2LaMt7';

const router = express.Router();

function sanitizeUser(user) {
  if (!user) return null;
  const { password, passwordHash, ...safe } = user;
  return {
    ...safe,
    username: safe.username || safe.bridgeAccount,
    bridgeAccount: safe.bridgeAccount || safe.username
  };
}

// Password strength validator:
// - contains letters
// - contains numbers
// - contains at least one special character such as @ # $ %
// - suitable minimum length (>= 8)
export function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required.' };
  }
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number.' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character (e.g. @, #, $, %).' };
  }
  return { valid: true };
}

// Gmail format validator
export function isValidGmail(email) {
  if (!email || typeof email !== 'string') return false;
  const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
  return gmailRegex.test(email.trim());
}

// GET /api/auth/check-username?username=xxx
router.get('/check-username', async (req, res) => {
  try {
    const rawUsername = req.query.username || req.query.account || '';
    const trimmed = rawUsername.trim();

    if (!trimmed) {
      return res.status(400).json({ available: false, message: 'Username cannot be empty.' });
    }

    const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    if (!usernameRegex.test(trimmed)) {
      return res.status(400).json({
        available: false,
        message: 'Username must be 3-30 characters long and contain only letters, numbers, underscores, or hyphens.'
      });
    }

    const result = await dbService.checkUsernameAvailable(trimmed);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ available: false, message: err.message });
  }
});

// Backward compatibility alias: GET /api/auth/check-bridge-account?account=xxx
router.get('/check-bridge-account', async (req, res) => {
  try {
    const rawAccount = req.query.account || req.query.username || '';
    const trimmed = rawAccount.trim();
    const result = await dbService.checkUsernameAvailable(trimmed);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ available: false, message: err.message });
  }
});

// POST /api/auth/check-gmail
router.post('/check-gmail', async (req, res) => {
  try {
    const { gmail } = req.body || {};
    const result = await dbService.checkGmailAvailable(gmail);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ available: false, message: err.message });
  }
});

// POST /api/auth/send-registration-otp
// Sends verification OTP using Supabase Auth
router.post('/send-registration-otp', async (req, res) => {
  try {
    const { gmail } = req.body || {};
    const trimmedGmail = (gmail || '').trim().toLowerCase();

    if (!isValidGmail(trimmedGmail)) {
      return res.status(400).json({ error: 'Please enter a valid Gmail address (ending with @gmail.com).' });
    }

    // Check if Gmail is already registered to another account
    const check = await dbService.checkGmailAvailable(trimmedGmail);
    if (!check.available) {
      return res.status(400).json({ error: check.message });
    }

    // Send OTP using Supabase Auth
    const { data, error } = await supabase.auth.signInWithOtp({
      email: trimmedGmail,
      options: {
        shouldCreateUser: true
      }
    });

    if (error) {
      console.error('Supabase send OTP notice:', error.message);
      return res.status(400).json({ error: error.message || 'Failed to send OTP to Gmail.' });
    }

    return res.json({
      success: true,
      message: 'Verification OTP has been sent to your Gmail address.'
    });
  } catch (err) {
    console.error('Send registration OTP error:', err);
    return res.status(500).json({ error: 'Failed to send verification OTP: ' + err.message });
  }
});

// POST /api/auth/verify-registration-otp
// Verifies OTP using Supabase Auth
router.post('/verify-registration-otp', async (req, res) => {
  try {
    const { gmail, otp } = req.body || {};
    const trimmedGmail = (gmail || '').trim().toLowerCase();
    const trimmedOtp = (otp || '').trim();

    if (!isValidGmail(trimmedGmail)) {
      return res.status(400).json({ error: 'Please enter a valid Gmail address.' });
    }
    if (!trimmedOtp || trimmedOtp.length < 6) {
      return res.status(400).json({ error: 'Please enter the 6-digit OTP code sent to your Gmail.' });
    }

    // Verify OTP via Supabase Auth (tries 'email', falls back to 'signup')
    let { data, error } = await supabase.auth.verifyOtp({
      email: trimmedGmail,
      token: trimmedOtp,
      type: 'email'
    });

    if (error) {
      const signupAttempt = await supabase.auth.verifyOtp({
        email: trimmedGmail,
        token: trimmedOtp,
        type: 'signup'
      });
      if (!signupAttempt.error) {
        data = signupAttempt.data;
        error = null;
      }
    }

    if (error) {
      console.warn('Verify OTP error from Supabase:', error.message);
      return res.status(400).json({
        verified: false,
        error: 'Invalid or expired OTP. Please check the code and try again.'
      });
    }

    // Sign a verification token so registration can confirm verification without re-verifying a consumed OTP
    const verificationToken = jwt.sign(
      {
        email: trimmedGmail,
        userId: data?.user?.id,
        session: data?.session,
        purpose: 'registration-verified'
      },
      JWT_SECRET,
      { expiresIn: '30m' }
    );

    return res.json({
      verified: true,
      success: true,
      message: 'Email account is verified ✓',
      userId: data?.user?.id,
      session: data?.session,
      verificationToken
    });
  } catch (err) {
    console.error('Verify registration OTP error:', err);
    return res.status(500).json({ error: 'Error verifying OTP: ' + err.message });
  }
});

// POST /api/auth/register
// Requirements: Full Name, Institute Name, Gmail Account, Username, Password, Confirm Password
// Verified OTP is required. User/profile is not created until verification succeeds.
router.post('/register', async (req, res) => {
  try {
    const {
      fullName,
      instituteName,
      username,
      bridgeAccount,
      gmail,
      email,
      password,
      confirmPassword,
      otp,
      verificationToken,
      verified
    } = req.body;

    const chosenUsername = (username || bridgeAccount || '').trim();
    const chosenGmail = (gmail || email || '').trim().toLowerCase();

    // 1. Validate required text fields
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ error: 'Please enter your Full Name.' });
    }
    if (!instituteName || !instituteName.trim()) {
      return res.status(400).json({ error: 'Please enter your Institute Name.' });
    }
    if (!chosenGmail) {
      return res.status(400).json({ error: 'Please enter your Gmail address.' });
    }
    if (!isValidGmail(chosenGmail)) {
      return res.status(400).json({ error: 'Please enter a valid Gmail address (ending with @gmail.com).' });
    }
    if (!chosenUsername) {
      return res.status(400).json({ error: 'Please choose a Username.' });
    }

    // 2. Validate Username format
    const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    if (!usernameRegex.test(chosenUsername)) {
      return res.status(400).json({
        error: 'Username must be 3-30 characters long and contain only letters, numbers, underscores, or hyphens.'
      });
    }

    // 3. Username uniqueness check
    const userCheck = await dbService.checkUsernameAvailable(chosenUsername);
    if (!userCheck.available) {
      return res.status(400).json({ error: userCheck.message || 'Username already taken.' });
    }

    // 4. Validate Password security requirements
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: passwordCheck.message });
    }

    // 5. Confirm Password matching
    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match. Please verify both fields.' });
    }

    // 6. Gmail verification requirement:
    // Accept cryptographically signed verificationToken (from verified OTP step) OR raw valid OTP
    let supabaseUserId = null;
    let verifiedSession = null;

    if (verificationToken) {
      try {
        const decoded = jwt.verify(verificationToken, JWT_SECRET);
        if (decoded.purpose === 'registration-verified' && decoded.email === chosenGmail) {
          supabaseUserId = decoded.userId || null;
          verifiedSession = decoded.session || null;
        } else {
          return res.status(400).json({ error: 'Email verification token does not match the provided Gmail.' });
        }
      } catch (tokErr) {
        return res.status(400).json({ error: 'Email verification has expired. Please verify your Gmail OTP again.' });
      }
    } else if (otp) {
      const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
        email: chosenGmail,
        token: otp.trim(),
        type: 'email'
      });

      if (verifyErr) {
        return res.status(400).json({ error: 'Invalid or expired OTP. Email verification is required before registration.' });
      }
      supabaseUserId = verifyData?.user?.id;
      verifiedSession = verifyData?.session;
    } else {
      return res.status(400).json({ error: 'Email account verification is required before completing registration.' });
    }

    // Set password on Supabase Auth user session if access token is available
    if (verifiedSession?.access_token) {
      try {
        const supaUserClient = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false }
        });
        await supaUserClient.auth.setSession({
          access_token: verifiedSession.access_token,
          refresh_token: verifiedSession.refresh_token || ''
        });
        await supaUserClient.auth.updateUser({ password });
      } catch (supaErr) {
        console.warn('Supabase auth updateUser password notice:', supaErr.message);
      }
    }

    // 7. Secure password hashing for user_credentials
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 8. Create user profile linked to Supabase Auth UID
    const newUser = await dbService.registerVerifiedUser({
      id: supabaseUserId || null,
      fullName: fullName.trim(),
      instituteName: instituteName.trim(),
      username: chosenUsername,
      email: chosenGmail,
      passwordHash: hashedPassword
    });

    const token = signToken(newUser);
    res.status(201).json({
      token,
      user: sanitizeUser(newUser),
      message: 'Registration successful! Welcome to SkillBridge.'
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during registration: ' + err.message });
  }
});

// POST /api/auth/login
// Supports Username + Password (as well as backwards-compatible Bridge Account)
router.post('/login', async (req, res) => {
  try {
    const { username, bridgeAccount, email, identifier, password } = req.body;
    let loginIdentifier = (identifier || username || email || bridgeAccount || '').trim();
    if (loginIdentifier.startsWith('@') && !loginIdentifier.slice(1).includes('@')) {
      loginIdentifier = loginIdentifier.slice(1).trim();
    }

    if (!loginIdentifier || !password) {
      return res.status(400).json({ error: 'Please enter both Username/Gmail and password.' });
    }

    const user = await dbService.getUserCredentialsForLogin(loginIdentifier);

    // Uniform friendly message prevents account enumeration
    const INVALID_CREDENTIALS_MSG = 'Invalid Username, Gmail, or password. Please try again.';

    if (!user) {
      console.info(`[Auth Diagnostic] Login failed: account not found for '${loginIdentifier}'`);
      return res.status(401).json({ error: INVALID_CREDENTIALS_MSG });
    }

    let isMatch = false;

    // Check 1: User credentials password hash
    if (user.passwordHash) {
      isMatch = await bcrypt.compare(password, user.passwordHash);
    }

    // Check 2: If user has a verified email and bcrypt didn't match, attempt Supabase Auth sign in
    if (!isMatch && user.email) {
      try {
        const { data: supaAuth, error: supaErr } = await supabase.auth.signInWithPassword({
          email: user.email,
          password
        });
        if (!supaErr && supaAuth?.user) {
          isMatch = true;
        }
      } catch (sErr) {
        // ignore fallback error
      }
    }

    if (!isMatch) {
      console.info(`[Auth Diagnostic] Login failed: incorrect password for user ID ${user.id}`);
      return res.status(401).json({ error: INVALID_CREDENTIALS_MSG });
    }

    const token = signToken(user);
    res.json({
      token,
      user: sanitizeUser(user)
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error during login: ' + err.message });
  }
});

// POST /api/auth/forgot-password/send-otp
// Accepts Username OR Gmail.
// If Username is entered: finds verified Gmail linked, sends OTP, and NEVER reveals the Gmail.
// If Gmail is entered: sends OTP to that Gmail.
router.post('/forgot-password/send-otp', async (req, res) => {
  try {
    const { identifier } = req.body || {};
    let trimmed = (identifier || '').trim();

    if (!trimmed) {
      return res.status(400).json({ error: 'Please enter your Username or Gmail address.' });
    }

    // Strip leading '@' if user entered @username
    if (trimmed.startsWith('@') && !trimmed.slice(1).includes('@')) {
      trimmed = trimmed.slice(1).trim();
    }

    const isEmail = trimmed.includes('@');
    let targetEmail = null;

    if (isEmail) {
      if (!isValidGmail(trimmed)) {
        return res.status(400).json({ error: 'Please enter a valid Gmail address.' });
      }
      const user = await dbService.getUserCredentialsForLogin(trimmed);
      if (!user) {
        return res.status(404).json({ error: 'No SkillBridge account found with this Gmail address.' });
      }
      targetEmail = user.email || trimmed.toLowerCase();
    } else {
      // Username entered: find verified Gmail linked to that username
      const user = await dbService.getUserCredentialsForLogin(trimmed);
      if (!user) {
        return res.status(404).json({ error: 'No SkillBridge account found with this username.' });
      }
      if (!user.email) {
        return res.status(400).json({
          error: 'This account does not have a verified Gmail address linked for recovery. Please contact support.'
        });
      }
      targetEmail = user.email;
    }

    // Send recovery OTP using Supabase Auth
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: {
        shouldCreateUser: false
      }
    });

    if (otpErr) {
      console.warn('Supabase reset OTP notice:', otpErr.message);
      // Fallback: try resetPasswordForEmail
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(targetEmail);
      if (resetErr) {
        return res.status(400).json({ error: resetErr.message || 'Failed to send recovery OTP.' });
      }
    }

    // CRITICAL SECURITY REQUIREMENT:
    // If username was entered: do NOT reveal the Gmail address to the user!
    return res.json({
      success: true,
      message: isEmail
        ? 'A recovery OTP has been sent to your Gmail address.'
        : 'A recovery OTP has been sent to the verified Gmail linked to this account.'
    });
  } catch (err) {
    console.error('Forgot password send OTP error:', err);
    return res.status(500).json({ error: 'Failed to send recovery OTP: ' + err.message });
  }
});

// POST /api/auth/forgot-password/reset
// Verifies OTP with Supabase Auth, updates password, sets new password for next login
router.post('/forgot-password/reset', async (req, res) => {
  try {
    const { identifier, otp, newPassword, confirmPassword } = req.body || {};
    let trimmed = (identifier || '').trim();
    if (trimmed.startsWith('@') && !trimmed.slice(1).includes('@')) {
      trimmed = trimmed.slice(1).trim();
    }
    const trimmedOtp = (otp || '').trim();

    if (!trimmed) {
      return res.status(400).json({ error: 'Please enter your Username or Gmail address.' });
    }
    if (!trimmedOtp || trimmedOtp.length < 6) {
      return res.status(400).json({ error: 'Please enter the 6-digit OTP code sent to your Gmail.' });
    }

    // Validate new password rules
    const passCheck = validatePasswordStrength(newPassword);
    if (!passCheck.valid) {
      return res.status(400).json({ error: passCheck.message });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match. Please verify both fields.' });
    }

    // Find user
    const user = await dbService.getUserCredentialsForLogin(trimmed);
    if (!user || !user.email) {
      return res.status(400).json({ error: 'Account or verified Gmail address not found.' });
    }

    // Verify OTP using Supabase Auth
    let verifyRes = await supabase.auth.verifyOtp({
      email: user.email,
      token: trimmedOtp,
      type: 'email'
    });

    if (verifyRes.error) {
      // Try recovery type
      verifyRes = await supabase.auth.verifyOtp({
        email: user.email,
        token: trimmedOtp,
        type: 'recovery'
      });
    }

    if (verifyRes.error) {
      return res.status(400).json({
        error: 'Invalid or expired OTP code. Password reset cancelled.'
      });
    }

    // Update password in Supabase Auth user session if available
    try {
      if (verifyRes.data?.session?.access_token) {
        const supaUserClient = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false }
        });
        await supaUserClient.auth.setSession({
          access_token: verifyRes.data.session.access_token,
          refresh_token: verifyRes.data.session.refresh_token || ''
        });
        await supaUserClient.auth.updateUser({ password: newPassword });
      }
    } catch (supaErr) {
      console.warn('Supabase updateUser password notice:', supaErr.message);
    }

    // Update hashed password in user_credentials to ensure immediate next login works
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await dbService.updateUserPasswordHash(user.id, hashedPassword);

    return res.json({
      success: true,
      message: 'Password updated successfully! You can now sign in with your new password.'
    });
  } catch (err) {
    console.error('Password reset error:', err);
    return res.status(500).json({ error: 'Failed to reset password: ' + err.message });
  }
});

// GET /api/auth/me
router.get('/me', authRequired, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

export default router;
