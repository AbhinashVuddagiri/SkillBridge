import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { dbService, supabase } from '../db.js';
import { authRequired, authOptional } from '../middleware/auth.js';

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

// GET /api/users
// Display all registered users who have completed their profiles, except the currently logged-in user
// Includes functional search by skill name (partial matches)
router.get('/', authOptional, async (req, res) => {
  try {
    const currentUserId = req.user ? req.user.id : null;
    const query = (req.query.q || '').trim();

    const users = await dbService.getExploreUsers(currentUserId, query);
    res.json({ users });
  } catch (err) {
    console.error('Error fetching explore users:', err);
    res.status(500).json({ error: 'Failed to load learner profiles: ' + err.message });
  }
});

// GET /api/users/profile
// Get current user's profile
router.get('/profile', authRequired, async (req, res) => {
  try {
    const user = await dbService.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get profile: ' + err.message });
  }
});

// PUT /api/users/profile
// Update full name, institute name, avatar, skills to teach, skills to learn
router.put('/profile', authRequired, async (req, res) => {
  try {
    const { name, instituteName, avatar, skillsTeach, skillsLearn } = req.body;

    const updatedUser = await dbService.updateUserProfile(req.user.id, {
      name: name || req.user.name,
      instituteName: instituteName !== undefined ? instituteName : req.user.instituteName,
      avatar: avatar || req.user.avatar,
      skillsTeach: Array.isArray(skillsTeach) ? skillsTeach : (req.user.skillsTeach || []),
      skillsLearn: Array.isArray(skillsLearn) ? skillsLearn : (req.user.skillsLearn || [])
    });

    res.json({
      success: true,
      user: sanitizeUser(updatedUser),
      profileCompleted: updatedUser.profileCompleted
    });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Failed to update profile: ' + err.message });
  }
});

function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return email;
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***@${domain}`;
}

// POST /api/users/account/verify-password
// Verifies user's current password for delete account confirmation
router.post('/account/verify-password', authRequired, async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: 'Please enter your current password.' });
    }

    const creds = await dbService.getUserCredentialsForLogin(req.user.bridgeAccount || req.user.username);
    const userEmail = creds?.email || req.user.email;
    let isMatch = false;

    // 1. Check bcrypt hash if present in user_credentials
    if (creds && creds.passwordHash) {
      isMatch = await bcrypt.compare(password, creds.passwordHash);
    }

    // 2. Check Supabase Auth password if bcrypt didn't match or wasn't present
    if (!isMatch && userEmail) {
      try {
        const { data: supaAuth, error: supaErr } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password
        });
        if (!supaErr && supaAuth?.user) {
          isMatch = true;
          // Backfill user_credentials password hash for consistency
          try {
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);
            await dbService.updateUserPasswordHash(req.user.id, hash);
          } catch (e) {}
        }
      } catch (sErr) {}
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect password. Deletion blocked.' });
    }

    const deleteToken = jwt.sign(
      { userId: req.user.id, purpose: 'delete-account-verified', verifiedBy: 'password' },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      verified: true,
      deleteToken,
      message: 'Password verified successfully.'
    });
  } catch (err) {
    console.error('Verify delete password error:', err);
    res.status(500).json({ error: 'Password verification failed: ' + err.message });
  }
});

// POST /api/users/account/send-delete-otp
// Sends security OTP to the user's verified Gmail before account deletion
router.post('/account/send-delete-otp', authRequired, async (req, res) => {
  try {
    // Current authenticated user -> resolve linked Gmail from DB record
    const user = await dbService.getUserById(req.user.id);
    let targetEmail = user?.email || null;

    if (!targetEmail) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', req.user.id)
        .maybeSingle();
      if (prof?.email) targetEmail = prof.email;
    }

    if (!targetEmail) {
      return res.status(400).json({
        error: 'No verified Gmail address linked to this account.'
      });
    }

    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: { shouldCreateUser: false }
    });

    if (otpErr) {
      console.warn('Supabase delete account send OTP notice:', otpErr.message);
      // Fallback: send OTP allowing sign in
      const { error: retryErr } = await supabase.auth.signInWithOtp({
        email: targetEmail
      });
      if (retryErr) {
        return res.status(400).json({ error: 'Failed to send OTP to Gmail: ' + retryErr.message });
      }
    }

    res.json({
      success: true,
      email: targetEmail,
      maskedEmail: maskEmail(targetEmail),
      message: 'Verification code sent to your verified Gmail address.'
    });
  } catch (err) {
    console.error('Error sending delete OTP:', err);
    res.status(500).json({ error: 'Failed to send verification code: ' + err.message });
  }
});

// POST /api/users/account/verify-delete-otp
// Verifies OTP sent to user's verified Gmail for delete account confirmation
router.post('/account/verify-delete-otp', authRequired, async (req, res) => {
  try {
    const { otp } = req.body || {};
    const trimmedOtp = (otp || '').trim();

    if (!trimmedOtp || trimmedOtp.length < 6) {
      return res.status(400).json({ error: 'Please enter the 6-digit OTP code sent to your Gmail.' });
    }

    const user = await dbService.getUserById(req.user.id);
    let targetEmail = user?.email || null;

    if (!targetEmail) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', req.user.id)
        .maybeSingle();
      if (prof?.email) targetEmail = prof.email;
    }

    if (!targetEmail) {
      return res.status(400).json({ error: 'No verified Gmail address linked to this account.' });
    }

    let { data, error } = await supabase.auth.verifyOtp({
      email: targetEmail,
      token: trimmedOtp,
      type: 'email'
    });

    if (error) {
      const signupAttempt = await supabase.auth.verifyOtp({
        email: targetEmail,
        token: trimmedOtp,
        type: 'signup'
      });
      if (!signupAttempt.error) {
        data = signupAttempt.data;
        error = null;
      }
    }

    if (error) {
      return res.status(400).json({
        verified: false,
        error: 'Invalid OTP'
      });
    }

    const deleteToken = jwt.sign(
      {
        userId: req.user.id,
        purpose: 'delete-account-verified',
        verifiedBy: 'otp'
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      verified: true,
      message: 'Email verified',
      deleteToken
    });
  } catch (err) {
    console.error('Verify delete OTP error:', err);
    res.status(500).json({ error: 'OTP verification failed: ' + err.message });
  }
});

// DELETE /api/users/account
// Securely and permanently delete authenticated user's account and associated data
router.delete('/account', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const { deleteToken, password, otp } = req.body || {};

    let isAuthorized = false;

    // 1. Verify deleteToken
    if (deleteToken) {
      try {
        const decoded = jwt.verify(deleteToken, JWT_SECRET);
        if (decoded.purpose === 'delete-account-verified' && decoded.userId === userId) {
          isAuthorized = true;
        }
      } catch (tokErr) {
        return res.status(401).json({ error: 'Deletion verification token expired or invalid. Please re-verify.' });
      }
    }

    // 2. Direct password verification fallback
    if (!isAuthorized && password) {
      const creds = await dbService.getUserCredentialsForLogin(req.user.bridgeAccount || req.user.username);
      const userEmail = creds?.email || req.user.email;
      if (creds && creds.passwordHash) {
        isAuthorized = await bcrypt.compare(password, creds.passwordHash);
      }
      if (!isAuthorized && userEmail) {
        try {
          const { data: supaAuth, error: supaErr } = await supabase.auth.signInWithPassword({
            email: userEmail,
            password
          });
          if (!supaErr && supaAuth?.user) {
            isAuthorized = true;
          }
        } catch (e) {}
      }
    }

    // 3. Direct OTP verification fallback
    if (!isAuthorized && otp) {
      const user = await dbService.getUserById(userId);
      const targetEmail = user?.email;
      if (targetEmail) {
        let { error: otpErr } = await supabase.auth.verifyOtp({
          email: targetEmail,
          token: (otp || '').trim(),
          type: 'email'
        });
        if (otpErr) {
          const sAttempt = await supabase.auth.verifyOtp({
            email: targetEmail,
            token: (otp || '').trim(),
            type: 'signup'
          });
          if (!sAttempt.error) otpErr = null;
        }
        if (!otpErr) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return res.status(401).json({
        error: 'Unauthorized: You must verify your password or email OTP before permanently deleting your account.'
      });
    }

    // Execute permanent deletion of user's records
    await dbService.deleteUserAccount(userId);

    // Attempt Supabase Auth account deletion if service role is available
    try {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const adminClient = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false }
        });
        await adminClient.auth.admin.deleteUser(userId);
      }
    } catch (authDelErr) {
      console.warn('Supabase Auth user delete notice:', authDelErr.message);
    }

    res.json({
      success: true,
      message: 'Your account and all associated data have been permanently deleted.'
    });
  } catch (err) {
    console.error('Account deletion error:', err);
    res.status(500).json({ error: 'Failed to delete account: ' + err.message });
  }
});

// GET /api/users/:id
router.get('/:id', authOptional, async (req, res) => {
  try {
    const user = await dbService.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isSelf = req.user && req.user.id === user.id;
    const safe = sanitizeUser(user);
    if (!isSelf && safe) {
      delete safe.email;
    }

    res.json({
      user: safe
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user: ' + err.message });
  }
});

export default router;
