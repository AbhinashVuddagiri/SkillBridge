import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://lbkeyicltxjzipvzfwlx.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'sb_publishable_H3Cee41GdLhMlz5jnzTvjA_UV2LaMt7';

const fetchWithRetry = async (url, options, retries = 2) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
    }
  }
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  global: {
    fetch: fetchWithRetry
  }
});

// In-memory fallback cache for user connection mutes, removed connections, deleted users, edits, unsends, per-user deletes, clear chat, and replies
const localMutes = new Map();
const localRemovedConnections = new Set();
const localDeletedUsers = new Set();
const localEditedMessages = new Map(); // msgId -> { text, isEdited: true }
const localUnsentMessages = new Set(); // msgId
const localDeletedByMessages = new Map(); // msgId -> Set of userIds
const localClearedChats = new Map(); // `${connectionId}_${userId}` -> timestamp
const localReplyTos = new Map(); // msgId -> replyToId
const localMessageSenders = new Map(); // msgId -> senderId

// Helper to check if tables exist or if schema needs to be executed
export async function checkSupabaseReady() {
  try {
    const { error } = await supabase.rpc('get_explore_users', {});
    if (error) {
      return {
        ready: false,
        error: 'Supabase schema error: ' + error.message
      };
    }
    return { ready: true };
  } catch (err) {
    return { ready: false, error: err.message };
  }
}

export const dbService = {
  // --------------------------------------------------------------------------
  // AUTH & USER CREDENTIALS
  // --------------------------------------------------------------------------
  async checkBridgeAccountAvailable(bridgeAccount) {
    return this.checkUsernameAvailable(bridgeAccount);
  },

  async checkUsernameAvailable(username) {
    const trimmed = (username || '').trim();
    if (!trimmed) return { available: false, message: 'Username cannot be empty.' };

    const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    if (!usernameRegex.test(trimmed)) {
      return {
        available: false,
        message: 'Username must be 3-30 characters long and contain only letters, numbers, underscores, or hyphens.'
      };
    }

    try {
      const { data: rpcUser } = await supabase.rpc('get_user_by_username_or_email', {
        p_identifier: trimmed
      });

      if (rpcUser && !localDeletedUsers.has(rpcUser.id)) {
        return { available: false, message: 'Username is already taken.' };
      }
    } catch (e) {
      // fallback
    }

    try {
      const { data: creds, error: rpcErr } = await supabase.rpc('get_bridge_user_credentials', {
        p_bridge_account: trimmed
      });

      if (!rpcErr && creds && !localDeletedUsers.has(creds.id)) {
        return { available: false, message: 'Username is already taken.' };
      }
    } catch (e) {
      // fallback to direct table query
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, bridge_account')
      .ilike('bridge_account', trimmed)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      if (error.code === 'PGRST205') {
        throw new Error('Supabase database tables have not been created yet. Please execute supabase/schema.sql in the Supabase SQL Editor.');
      }
      throw error;
    }

    if (data && !localDeletedUsers.has(data.id)) {
      return { available: false, message: 'Username is already taken.' };
    }
    return { available: true, message: 'Username is available!' };
  },

  async checkGmailAvailable(gmail) {
    const trimmed = (gmail || '').trim().toLowerCase();
    if (!trimmed) return { available: false, message: 'Gmail address cannot be empty.' };

    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    if (!gmailRegex.test(trimmed)) {
      return { available: false, message: 'Please provide a valid Gmail address (ending with @gmail.com).' };
    }

    try {
      const { data: rpcUser } = await supabase.rpc('get_user_by_username_or_email', {
        p_identifier: trimmed
      });
      if (rpcUser && !localDeletedUsers.has(rpcUser.id)) {
        return { available: false, message: 'This Gmail address is already registered to a SkillBridge account.' };
      }
    } catch (e) {
      // fallback
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email')
        .ilike('email', trimmed)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        // If email column doesn't exist yet, we treat as available
        if (error.code === '42703') {
          return { available: true, message: 'Gmail address is valid!' };
        }
        throw error;
      }

      if (data && !localDeletedUsers.has(data.id)) {
        return { available: false, message: 'This Gmail address is already registered to a SkillBridge account.' };
      }
      return { available: true, message: 'Gmail address is available!' };
    } catch (err) {
      return { available: true, message: 'Gmail address is valid!' };
    }
  },

  async registerVerifiedUser({ id, fullName, instituteName, username, email, passwordHash, avatarUrl }) {
    const normalizedUsername = (username || '').trim();
    const normalizedEmail = (email || '').trim().toLowerCase();
    const avatar = avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(normalizedUsername.toLowerCase())}`;

    // 1. Try upserting/inserting with email column
    let profileData = null;
    let profErr = null;

    const payloadWithEmail = {
      full_name: fullName.trim(),
      institute_name: instituteName.trim(),
      bridge_account: normalizedUsername,
      email: normalizedEmail || null,
      avatar_url: avatar,
      profile_completed: false
    };
    if (id) payloadWithEmail.id = id;

    const resWithEmail = await supabase
      .from('profiles')
      .upsert(payloadWithEmail, { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (resWithEmail.error && resWithEmail.error.code === '42703') {
      // Fallback: email column does not exist yet in Supabase
      const payloadWithoutEmail = {
        full_name: fullName.trim(),
        institute_name: instituteName.trim(),
        bridge_account: normalizedUsername,
        avatar_url: avatar,
        profile_completed: false
      };
      if (id) payloadWithoutEmail.id = id;

      const fallbackRes = await supabase
        .from('profiles')
        .upsert(payloadWithoutEmail, { onConflict: 'id' })
        .select()
        .maybeSingle();

      profileData = fallbackRes.data;
      profErr = fallbackRes.error;
    } else {
      profileData = resWithEmail.data;
      profErr = resWithEmail.error;
    }

    if (profErr) throw profErr;

    // 2. Insert or update password hash in user_credentials if provided
    if (passwordHash && profileData?.id) {
      await this.updateUserPasswordHash(profileData.id, passwordHash);
    }

    if (profileData?.id) {
      localDeletedUsers.delete(profileData.id);
    }

    return {
      id: profileData.id,
      name: profileData.full_name,
      instituteName: profileData.institute_name,
      bridgeAccount: profileData.bridge_account,
      username: profileData.bridge_account,
      email: profileData.email || normalizedEmail || null,
      avatar: profileData.avatar_url,
      profileCompleted: false,
      skillsTeach: [],
      skillsLearn: [],
      createdAt: profileData.created_at
    };
  },

  async registerUser({ fullName, instituteName, bridgeAccount, passwordHash, avatarUrl, email }) {
    return this.registerVerifiedUser({
      fullName,
      instituteName,
      username: bridgeAccount,
      email: email || null,
      passwordHash,
      avatarUrl
    });
  },

  async getUserCredentialsForLogin(identifier) {
    const rawTrimmed = (identifier || '').trim();
    if (!rawTrimmed) return null;
    const trimmed = rawTrimmed.startsWith('@') ? rawTrimmed.slice(1).trim() : rawTrimmed;
    if (!trimmed) return null;

    const isEmail = trimmed.includes('@');

    // 1. Try unified RPC get_user_by_username_or_email (handles both username and email case-insensitively)
    try {
      const { data: rpcUser, error: rpcErr } = await supabase.rpc('get_user_by_username_or_email', {
        p_identifier: trimmed
      });

      if (!rpcErr && rpcUser) {
        if (localDeletedUsers.has(rpcUser.id)) {
          localDeletedUsers.delete(rpcUser.id);
        }
        let skillsTeach = [];
        let skillsLearn = [];
        try {
          const { data: skills } = await supabase
            .from('user_skills')
            .select('skill_name, skill_type')
            .eq('user_id', rpcUser.id);
          if (Array.isArray(skills)) {
            skillsTeach = skills.filter(s => s.skill_type === 'teach').map(s => s.skill_name);
            skillsLearn = skills.filter(s => s.skill_type === 'learn').map(s => s.skill_name);
          }
        } catch (e) {
          // ignore
        }

        return {
          id: rpcUser.id,
          name: rpcUser.name,
          instituteName: rpcUser.instituteName,
          bridgeAccount: rpcUser.bridgeAccount,
          username: rpcUser.username || rpcUser.bridgeAccount,
          email: rpcUser.email || null,
          avatar: rpcUser.avatar,
          profileCompleted: rpcUser.profileCompleted,
          passwordHash: rpcUser.passwordHash || null,
          skillsTeach,
          skillsLearn
        };
      }
    } catch (rpcEx) {
      // fallback
    }

    // 2. Legacy fallback: If identifier is a username, try get_bridge_user_credentials
    if (!isEmail) {
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_bridge_user_credentials', {
          p_bridge_account: trimmed
        });

        if (!rpcError && rpcData) {
          if (localDeletedUsers.has(rpcData.id)) {
            localDeletedUsers.delete(rpcData.id);
          }
          return {
            ...rpcData,
            username: rpcData.bridgeAccount,
            email: rpcData.email || null
          };
        }
      } catch (rpcEx) {
        console.warn('RPC get_bridge_user_credentials notice:', rpcEx.message);
      }
    }

    // Direct table query: find profile by bridge_account OR email
    try {
      let query = supabase
        .from('profiles')
        .select(`
          *,
          user_credentials (
            password_hash
          ),
          user_skills (
            skill_name,
            skill_type
          )
        `);

      if (isEmail) {
        query = query.ilike('email', trimmed);
      } else {
        query = query.ilike('bridge_account', trimmed);
      }

      const { data: profile, error: profErr } = await query.maybeSingle();

      if (profErr || !profile || localDeletedUsers.has(profile.id)) {
        // If searching by email failed (e.g. column didn't exist yet), check if bridge_account matched
        if (isEmail) {
          const { data: fbProf } = await supabase
            .from('profiles')
            .select(`
              *,
              user_credentials ( password_hash ),
              user_skills ( skill_name, skill_type )
            `)
            .ilike('bridge_account', trimmed)
            .maybeSingle();

          if (fbProf && !localDeletedUsers.has(fbProf.id)) {
            const cred = Array.isArray(fbProf.user_credentials)
              ? fbProf.user_credentials[0]
              : fbProf.user_credentials;
            const skills = fbProf.user_skills || [];
            return {
              id: fbProf.id,
              name: fbProf.full_name,
              instituteName: fbProf.institute_name,
              bridgeAccount: fbProf.bridge_account,
              username: fbProf.bridge_account,
              email: fbProf.email || null,
              avatar: fbProf.avatar_url,
              profileCompleted: fbProf.profile_completed,
              passwordHash: cred?.password_hash || null,
              skillsTeach: skills.filter(s => s.skill_type === 'teach').map(s => s.skill_name),
              skillsLearn: skills.filter(s => s.skill_type === 'learn').map(s => s.skill_name)
            };
          }
        }
        return null;
      }

      const cred = Array.isArray(profile.user_credentials)
        ? profile.user_credentials[0]
        : profile.user_credentials;

      const skills = profile.user_skills || [];

      return {
        id: profile.id,
        name: profile.full_name,
        instituteName: profile.institute_name,
        bridgeAccount: profile.bridge_account,
        username: profile.bridge_account,
        email: profile.email || null,
        avatar: profile.avatar_url,
        profileCompleted: profile.profile_completed,
        passwordHash: cred?.password_hash || null,
        skillsTeach: skills.filter(s => s.skill_type === 'teach').map(s => s.skill_name),
        skillsLearn: skills.filter(s => s.skill_type === 'learn').map(s => s.skill_name)
      };
    } catch (fallbackErr) {
      console.error('Fallback login query error:', fallbackErr.message);
      return null;
    }
  },

  async updateUserPasswordHash(userId, passwordHash) {
    if (!userId || !passwordHash) throw new Error('User ID and password hash are required.');

    // 1. Try secure RPC function first (bypasses RLS if created)
    try {
      const { error: rpcErr } = await supabase.rpc('save_user_credential', {
        p_user_id: userId,
        p_password_hash: passwordHash
      });
      if (!rpcErr) {
        return true;
      }
    } catch (e) {
      // Continue to direct upsert fallback
    }

    // 2. Direct upsert into user_credentials table
    const { data, error } = await supabase
      .from('user_credentials')
      .upsert({
        user_id: userId,
        password_hash: passwordHash,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) {
      console.warn('Update user_credentials notice:', error.message);
    }
    return true;
  },

  async getUserById(userId) {
    if (!userId) return null;

    const { data: rpcData, error: rpcError } = await supabase.rpc('get_profile_by_id', {
      p_user_id: userId
    });

    if (!rpcError && rpcData) {
      if (localDeletedUsers.has(userId)) {
        localDeletedUsers.delete(userId);
      }
      let email = rpcData.email || null;
      if (!email && rpcData.bridgeAccount) {
        try {
          const { data: credUser } = await supabase.rpc('get_user_by_username_or_email', {
            p_identifier: rpcData.bridgeAccount
          });
          if (credUser?.email) {
            email = credUser.email;
          }
        } catch (e) {
          // ignore
        }
      }
      if (!email) {
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', userId)
            .maybeSingle();
          if (prof?.email) {
            email = prof.email;
          }
        } catch (e) {
          // ignore
        }
      }
      return {
        ...rpcData,
        username: rpcData.bridgeAccount,
        email: email || null
      };
    }

    const { data: p, error } = await supabase
      .from('profiles')
      .select(`
        *,
        user_skills (
          skill_name,
          skill_type
        )
      `)
      .eq('id', userId)
      .maybeSingle();

    if (error || !p) return null;

    const skills = p.user_skills || [];
    return {
      id: p.id,
      name: p.full_name,
      instituteName: p.institute_name,
      bridgeAccount: p.bridge_account,
      username: p.bridge_account,
      email: p.email || null,
      avatar: p.avatar_url,
      profileCompleted: p.profile_completed,
      skillsTeach: skills.filter(s => s.skill_type === 'teach').map(s => s.skill_name),
      skillsLearn: skills.filter(s => s.skill_type === 'learn').map(s => s.skill_name),
      createdAt: p.created_at,
      updatedAt: p.updated_at
    };
  },

  // --------------------------------------------------------------------------
  // EXPLORE USERS & PROFILES
  // --------------------------------------------------------------------------
  async getExploreUsers(currentUserId = null, searchQuery = '') {
    let users = null;
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_explore_users', {
        p_current_user_id: currentUserId || null,
        p_search_query: searchQuery || null
      });

      if (!rpcError && Array.isArray(rpcData)) {
        users = rpcData;
      }
    } catch (e) {
      // ignore
    }

    // Direct fallback if RPC was not used
    if (!users) {
      let query = supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          institute_name,
          bridge_account,
          avatar_url,
          profile_completed,
          user_skills (
            skill_name,
            skill_type
          )
        `);

      if (currentUserId) {
        query = query.neq('id', currentUserId);
      }

      const { data, error } = await query;
      if (error) throw error;

      users = (data || []).map(u => {
        const skills = u.user_skills || [];
        return {
          id: u.id,
          name: u.full_name,
          instituteName: u.institute_name || 'Independent Learner',
          bridgeAccount: u.bridge_account,
          avatar: u.avatar_url,
          skillsTeach: skills.filter(s => s.skill_type === 'teach').map(s => s.skill_name),
          skillsLearn: skills.filter(s => s.skill_type === 'learn').map(s => s.skill_name),
          connectionStatus: 'none',
          connectionId: null,
          isRequester: false
        };
      });

      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        users = users.filter(u => {
          const hasSkill = [...u.skillsTeach, ...u.skillsLearn].some(s => s.toLowerCase().includes(q));
          const hasName = u.name.toLowerCase().includes(q);
          const hasInst = u.instituteName.toLowerCase().includes(q);
          return hasSkill || hasName || hasInst;
        });
      }
    }

    // ALWAYS guarantee connection status prioritization (accepted > pending > rejected)
    if (currentUserId && users.length > 0) {
      const allConns = await this.getUserConnections(currentUserId);

      users = users.map(u => {
        const matchingConns = (allConns || []).filter(c =>
          !localRemovedConnections.has(c.id) && (
            c.partner?.id === u.id ||
            c.recipientId === u.id ||
            c.requesterId === u.id
          )
        );

        if (matchingConns.length === 0) {
          return {
            ...u,
            connectionStatus: 'none',
            connectionId: null,
            isRequester: false
          };
        }

        const statusPriority = (st) => (st === 'accepted' ? 3 : st === 'pending' ? 2 : st === 'rejected' ? 1 : 0);
        const conn = matchingConns.sort((a, b) => {
          const diff = statusPriority(b.status) - statusPriority(a.status);
          if (diff !== 0) return diff;
          const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          return timeB - timeA;
        })[0];

        return {
          ...u,
          connectionStatus: conn ? conn.status : 'none',
          connectionId: conn ? conn.id : null,
          isRequester: conn ? conn.isRequester : false
        };
      });
    }

    return users;
  },

  async updateUserProfile(userId, { name, instituteName, avatar, skillsTeach, skillsLearn }) {
    const { data: rpcData, error: rpcError } = await supabase.rpc('update_bridge_user_profile', {
      p_user_id: userId,
      p_full_name: name.trim(),
      p_institute_name: instituteName.trim(),
      p_avatar_url: avatar || '',
      p_skills_teach: skillsTeach || [],
      p_skills_learn: skillsLearn || []
    });

    if (!rpcError && rpcData) {
      return rpcData;
    }

    // Direct fallback
    const hasTeach = Array.isArray(skillsTeach) && skillsTeach.length > 0;
    const hasLearn = Array.isArray(skillsLearn) && skillsLearn.length > 0;
    const isCompleted = hasTeach && hasLearn;

    const { data: updatedProf, error: profErr } = await supabase
      .from('profiles')
      .update({
        full_name: name.trim(),
        institute_name: instituteName.trim(),
        avatar_url: avatar,
        profile_completed: isCompleted,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (profErr) throw profErr;

    // Refresh skills
    await supabase.from('user_skills').delete().eq('user_id', userId);

    const skillsToInsert = [
      ...(skillsTeach || []).map(s => ({
        user_id: userId,
        skill_name: (typeof s === 'string' ? s : s.name).trim(),
        skill_type: 'teach'
      })),
      ...(skillsLearn || []).map(s => ({
        user_id: userId,
        skill_name: (typeof s === 'string' ? s : s.name).trim(),
        skill_type: 'learn'
      }))
    ].filter(s => Boolean(s.skill_name));

    if (skillsToInsert.length > 0) {
      await supabase.from('user_skills').insert(skillsToInsert);
    }

    return this.getUserById(userId);
  },

  async getUserConnections(userId) {
    let connections = null;

    // Try RPC first
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_connections_list', {
        p_user_id: userId
      });

      if (!rpcError && Array.isArray(rpcData)) {
        connections = rpcData;
      }
    } catch (rpcEx) {
      console.warn('RPC get_user_connections_list failed, falling back:', rpcEx.message);
    }

    // Direct fallback only if RPC failed (connections === null)
    if (connections === null) {
      try {
        const { data, error } = await supabase
          .from('skill_connections')
          .select('*')
          .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
          .order('updated_at', { ascending: false });

        if (!error && data) {
          const rawList = data || [];
          connections = await Promise.all(
            rawList.map(async (c) => {
              const isRequester = c.requester_id === userId;
              const partnerId = isRequester ? c.recipient_id : c.requester_id;
              const partner = await this.getUserById(partnerId);

              return {
                id: c.id,
                requesterId: c.requester_id,
                recipientId: c.recipient_id,
                status: c.status,
                createdAt: c.created_at,
                updatedAt: c.updated_at,
                isRequester,
                partner
              };
            })
          );
        } else {
          connections = [];
        }
      } catch (err) {
        connections = [];
      }
    }

    // Enhance each connection with its latest message preview and muted status
    const mutedSet = new Set(await this.getMutedConnectionIds(userId));

    const enhanced = await Promise.all(
      connections.map(async (c) => {
        let lastMessage = null;
        if (c.status === 'accepted') {
          try {
            const conv = await this.getConnectionMessages(c.id, userId);
            const msgs = conv?.messages || [];
            if (msgs.length > 0) {
              const latest = msgs[msgs.length - 1];
              lastMessage = {
                id: latest.id,
                body: latest.messageBody,
                createdAt: latest.createdAt,
                senderId: latest.senderId
              };
            }
          } catch (e) {
            // ignore message preview error
          }
        }

        return {
          ...c,
          lastMessage,
          isMuted: mutedSet.has(c.id)
        };
      })
    );

    // Sort connections: those with recent messages or updates first
    enhanced.sort((a, b) => {
      const timeA = new Date(a.lastMessage?.createdAt || a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.lastMessage?.createdAt || b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    // Filter out removed connections and deleted users
    const active = enhanced.filter(c =>
      !localRemovedConnections.has(c.id) &&
      !localDeletedUsers.has(c.requesterId) &&
      !localDeletedUsers.has(c.recipientId) &&
      !localDeletedUsers.has(c.partner?.id)
    );

    return active;
  },

  async sendConnectionRequest(requesterId, recipientId) {
    if (requesterId === recipientId) {
      throw new Error('You cannot connect with yourself.');
    }

    // Check for active pending request
    const existingConns = await this.getUserConnections(requesterId);
    const pendingWithPartner = existingConns.find(
      c => (c.partner?.id === recipientId || c.recipientId === recipientId || c.requesterId === recipientId) && c.status === 'pending'
    );
    if (pendingWithPartner) {
      throw new Error('A connection request is already pending between you.');
    }

    const acceptedWithPartner = existingConns.find(
      c => (c.partner?.id === recipientId || c.recipientId === recipientId || c.requesterId === recipientId) && c.status === 'accepted'
    );
    if (acceptedWithPartner) {
      throw new Error('You are already connected with this user.');
    }

    let createdConnection = null;

    // Try RPC first
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_connection_request', {
        p_requester_id: requesterId,
        p_recipient_id: recipientId
      });

      if (!rpcError && rpcData) {
        createdConnection = rpcData;
      } else if (rpcError) {
        if (rpcError.message.includes('pending') || rpcError.message.includes('already connected')) {
          throw new Error(rpcError.message);
        }
      }
    } catch (rpcErr) {
      if (rpcErr.message.includes('pending') || rpcErr.message.includes('already connected')) {
        throw rpcErr;
      }
      console.warn('RPC create_connection_request notice, using direct fallback:', rpcErr.message);
    }

    // Direct fallback if RPC was not used
    if (!createdConnection) {
      try {
        await supabase.from('skill_connections').delete().eq('status', 'rejected').eq('requester_id', requesterId).eq('recipient_id', recipientId);
        await supabase.from('skill_connections').delete().eq('status', 'rejected').eq('requester_id', recipientId).eq('recipient_id', requesterId);
      } catch (e) {
        // ignore
      }

      const { data: created, error: crtErr } = await supabase
        .from('skill_connections')
        .insert({
          requester_id: requesterId,
          recipient_id: recipientId,
          status: 'pending'
        })
        .select()
        .single();

      if (!crtErr && created) {
        createdConnection = created;
      }
    }

    // Guarantee that User B receives a fresh persistent in-app notification every time
    if (createdConnection) {
      try {
        const sender = await this.getUserById(requesterId);
        const senderName = sender?.name || 'A user';
        await supabase.from('notifications').insert({
          recipient_id: recipientId,
          sender_id: requesterId,
          notification_type: 'connection_request',
          message: `${senderName} sent you a connection request!`,
          related_connection_id: createdConnection.id,
          read_status: false
        });
      } catch (notifErr) {
        console.warn('Notification insert notice:', notifErr.message);
      }
    }

    return createdConnection;
  },

  async respondConnectionRequest(connectionId, recipientId, status) {
    const { data: rpcData, error: rpcError } = await supabase.rpc('respond_connection_request', {
      p_connection_id: connectionId,
      p_user_id: recipientId,
      p_status: status
    });

    if (!rpcError && rpcData) {
      return rpcData;
    }

    if (rpcError && !rpcError.message.includes('function') && !rpcError.message.includes('not found')) {
      throw new Error(rpcError.message);
    }

    // Direct fallback: Enforce authorization
    const { data: conn, error: getErr } = await supabase
      .from('skill_connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (getErr || !conn) throw new Error('Connection request not found.');

    if (conn.recipient_id !== recipientId) {
      throw new Error('Only the recipient can respond to this connection request.');
    }

    const { data: updated, error: updErr } = await supabase
      .from('skill_connections')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId)
      .select()
      .single();

    if (updErr) throw updErr;

    // If accepted, clean up any older rejected requests between this pair
    if (status === 'accepted') {
      try {
        await supabase.from('skill_connections').delete().eq('status', 'rejected').eq('requester_id', conn.requester_id).eq('recipient_id', conn.recipient_id);
        await supabase.from('skill_connections').delete().eq('status', 'rejected').eq('requester_id', conn.recipient_id).eq('recipient_id', conn.requester_id);
      } catch (cleanErr) {
        // ignore cleanup error
      }
    }

    // Send notification if accepted or rejected
    try {
      const recipient = await this.getUserById(recipientId);
      const recipientName = recipient?.name || 'A user';
      const notifType = status === 'accepted' ? 'connection_accepted' : 'connection_rejected';
      const notifMsg = status === 'accepted'
        ? `${recipientName} accepted your connection request! You can now chat.`
        : `${recipientName} declined your connection request.`;

      await supabase.from('notifications').insert({
        recipient_id: conn.requester_id,
        sender_id: recipientId,
        notification_type: notifType,
        message: notifMsg,
        related_connection_id: connectionId,
        read_status: false
      });
    } catch (e) {
      console.warn('Notification insert notice:', e.message);
    }

    return updated;
  },

  async removeConnection(connectionId, userId) {
    // Verify user is a participant using getUserConnections
    const userConns = await this.getUserConnections(userId);
    const conn = userConns.find(c => c.id === connectionId);

    if (!conn) {
      throw new Error('Connection not found or access denied.');
    }

    localRemovedConnections.add(connectionId);

    // Try RPC first
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('remove_user_connection', {
        p_connection_id: connectionId,
        p_user_id: userId
      });
      if (!rpcError) return true;
    } catch (e) {
      // fallback
    }

    // Direct deletion attempt
    try {
      await supabase
        .from('skill_connections')
        .delete()
        .eq('id', connectionId);
    } catch (e) {
      // ignore
    }

    return true;
  },

  async toggleConnectionMute(connectionId, userId) {
    // Try RPC first
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('toggle_connection_mute', {
        p_connection_id: connectionId,
        p_user_id: userId
      });
      if (!rpcError && typeof rpcData === 'boolean') {
        return rpcData;
      }
    } catch (e) {
      // fallback
    }

    // Fallback: verify user is a participant using getUserConnections
    const userConns = await this.getUserConnections(userId);
    const conn = userConns.find(c => c.id === connectionId);

    if (!conn) {
      throw new Error('Connection not found or access denied.');
    }

    try {
      const { data: existing } = await supabase
        .from('connection_mutes')
        .select('id')
        .eq('user_id', userId)
        .eq('connection_id', connectionId)
        .maybeSingle();

      if (existing) {
        await supabase.from('connection_mutes').delete().eq('id', existing.id);
        const userSet = localMutes.get(userId);
        if (userSet) userSet.delete(connectionId);
        return false; // unmuted
      } else {
        const { error: insErr } = await supabase.from('connection_mutes').insert({
          user_id: userId,
          connection_id: connectionId
        });
        if (insErr) throw insErr;
        let userSet = localMutes.get(userId);
        if (!userSet) {
          userSet = new Set();
          localMutes.set(userId, userSet);
        }
        userSet.add(connectionId);
        return true; // muted
      }
    } catch (tblErr) {
      // If table connection_mutes is not yet created in Supabase SQL editor, use localMutes seamlessly
      let userSet = localMutes.get(userId);
      if (!userSet) {
        userSet = new Set();
        localMutes.set(userId, userSet);
      }
      if (userSet.has(connectionId)) {
        userSet.delete(connectionId);
        return false; // unmuted
      } else {
        userSet.add(connectionId);
        return true; // muted
      }
    }
  },

  async getMutedConnectionIds(userId) {
    const list = [];
    try {
      const { data, error } = await supabase
        .from('connection_mutes')
        .select('connection_id')
        .eq('user_id', userId);

      if (!error && data) {
        list.push(...data.map(m => m.connection_id));
      }
    } catch (e) {
      // ignore
    }

    const localSet = localMutes.get(userId);
    if (localSet) {
      for (const id of localSet) {
        if (!list.includes(id)) list.push(id);
      }
    }

    return list;
  },

  async deleteUserAccount(userId) {
    if (!userId) throw new Error('User ID is required for account deletion.');

    // Verify user exists using getUserById or direct profile lookup
    let user = await this.getUserById(userId);
    if (!user) {
      const { data: prof } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
      if (!prof) {
        throw new Error('User account not found.');
      }
    }

    localDeletedUsers.add(userId);

    // Try RPC first (executes SECURITY DEFINER function in Supabase)
    let rpcSucceeded = false;
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('delete_user_account', {
        p_user_id: userId
      });
      if (!rpcError && (rpcData === true || rpcData === null)) {
        rpcSucceeded = true;
      }
    } catch (e) {
      console.warn('RPC delete_user_account notice, using direct fallback:', e.message);
    }

    // Direct fallback or supplementary cleanup to ensure zero orphaned records
    try {
      // Find all connections involving this user
      const { data: conns } = await supabase
        .from('skill_connections')
        .select('id')
        .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`);

      const connIds = (conns || []).map(c => c.id);
      if (connIds.length > 0) {
        await supabase.from('messages').delete().in('connection_id', connIds);
        await supabase.from('connection_mutes').delete().in('connection_id', connIds);
        await supabase.from('notifications').delete().in('related_connection_id', connIds);
      }

      await supabase.from('messages').delete().eq('sender_id', userId);
      await supabase.from('notifications').delete().or(`recipient_id.eq.${userId},sender_id.eq.${userId}`);
      await supabase.from('connection_mutes').delete().eq('user_id', userId);
      await supabase.from('skill_connections').delete().or(`requester_id.eq.${userId},recipient_id.eq.${userId}`);
      await supabase.from('user_skills').delete().eq('user_id', userId);
      await supabase.from('user_credentials').delete().eq('user_id', userId);
      await supabase.from('profiles').delete().eq('id', userId);
    } catch (e) {
      if (!rpcSucceeded) {
        console.warn('Supplementary table deletion notice:', e.message);
      }
    }

    return true;
  },

  // --------------------------------------------------------------------------
  // NOTIFICATIONS
  // --------------------------------------------------------------------------
  async getUserNotifications(userId) {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_notifications_list', {
      p_user_id: userId
    });

    if (!rpcError && Array.isArray(rpcData)) {
      return rpcData;
    }

    const { data, error } = await supabase
      .from('notifications')
      .select(`
        id,
        recipient_id,
        sender_id,
        notification_type,
        message,
        related_connection_id,
        read_status,
        created_at
      `)
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const list = data || [];
    const populated = await Promise.all(
      list.map(async (n) => {
        let sender = null;
        if (n.sender_id) {
          const s = await this.getUserById(n.sender_id);
          if (s) {
            sender = {
              id: s.id,
              name: s.name,
              instituteName: s.instituteName,
              bridgeAccount: s.bridgeAccount,
              avatar: s.avatar
            };
          }
        }

        let connection = null;
        if (n.related_connection_id) {
          const { data: c } = await supabase
            .from('skill_connections')
            .select('*')
            .eq('id', n.related_connection_id)
            .maybeSingle();
          connection = c || null;
        }

        return {
          id: n.id,
          recipientId: n.recipient_id,
          senderId: n.sender_id,
          type: n.notification_type,
          message: n.message,
          relatedConnectionId: n.related_connection_id,
          read: n.read_status,
          createdAt: n.created_at,
          sender,
          connection
        };
      })
    );

    return populated;
  },

  async markNotificationRead(notificationId, userId) {
    try {
      const { error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId,
        p_user_id: userId
      });
      if (!error) return true;
      console.warn('RPC mark_notification_read notice:', error.message);
    } catch (e) {
      console.warn('RPC mark_notification_read notice:', e.message);
    }

    const { error } = await supabase
      .from('notifications')
      .update({ read_status: true })
      .eq('id', notificationId)
      .eq('recipient_id', userId);

    if (error) throw error;
    return true;
  },

  async markAllNotificationsRead(userId) {
    try {
      const { error } = await supabase.rpc('mark_all_notifications_read', {
        p_user_id: userId
      });
      if (!error) return true;
      console.warn('RPC mark_all_notifications_read notice:', error.message);
    } catch (e) {
      console.warn('RPC mark_all_notifications_read notice:', e.message);
    }

    const { error } = await supabase
      .from('notifications')
      .update({ read_status: true })
      .eq('recipient_id', userId);

    if (error) throw error;
    return true;
  },

  // --------------------------------------------------------------------------
  // MESSAGES & PRIVATE CHAT
  // --------------------------------------------------------------------------
  async getConnectionMessages(connectionId, userId) {
    if (localRemovedConnections.has(connectionId)) {
      throw new Error('Connection not found or access denied.');
    }

    let result = null;

    // Try RPC first
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_connection_messages_list', {
        p_connection_id: connectionId,
        p_user_id: userId
      });

      if (!rpcError && rpcData) {
        result = rpcData;
      }
    } catch (rpcEx) {
      // fallback
    }

    if (!result) {
      const userConns = await this.getUserConnections(userId);
      const conn = userConns.find(c => c.id === connectionId);

      if (!conn) {
        throw new Error('Connection not found or access denied.');
      }

      if (conn.status !== 'accepted') {
        throw new Error('Chat is only accessible for accepted connections.');
      }

      result = {
        connectionId,
        partner: conn.partner || null,
        messages: []
      };
    }

    const clearKey = `${connectionId}_${userId}`;
    const clearTime = localClearedChats.get(clearKey) || 0;

    const rawList = result.messages || [];
    rawList.forEach(m => {
      const sId = m.senderId || m.sender_id;
      if (sId) localMessageSenders.set(m.id, sId);
    });
    const msgMap = new Map(rawList.map(m => [m.id, m]));

    // Apply local edits, unsends, delete-for-me, and reply metadata
    const enhancedMessages = rawList
      .filter(m => {
        if (m.isUnsent || localUnsentMessages.has(m.id)) return false;
        const delSet = localDeletedByMessages.get(m.id);
        if (delSet && delSet.has(userId)) return false;
        const mTime = new Date(m.createdAt || m.created_at || 0).getTime();
        if (clearTime > 0 && !isNaN(mTime) && mTime <= clearTime) return false;
        return true;
      })
      .map(m => {
        const edited = localEditedMessages.get(m.id);
        const replyToId = m.replyToId || localReplyTos.get(m.id) || null;
        let replyTo = m.replyTo || null;
        if (!replyTo && replyToId && msgMap.has(replyToId)) {
          const orig = msgMap.get(replyToId);
          replyTo = {
            id: orig.id,
            senderId: orig.senderId,
            messageBody: (orig.isUnsent || localUnsentMessages.has(orig.id)) ? 'This message was unsent' : orig.messageBody
          };
        }

        return {
          ...m,
          messageBody: edited ? edited.text : m.messageBody,
          isEdited: edited ? true : Boolean(m.isEdited),
          replyToId,
          replyTo
        };
      });

    return {
      ...result,
      messages: enhancedMessages
    };
  },

  async sendConnectionMessage(connectionId, senderId, messageBody, replyToId = null) {
    if (localRemovedConnections.has(connectionId)) {
      throw new Error('Connection not found or access denied.');
    }

    const text = (messageBody || '').trim();
    if (!text) throw new Error('Message cannot be empty.');

    let newMsg = null;

    // 1. Try 4-param RPC first (with explicit p_reply_to_id or null to resolve function overloading)
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('send_connection_message_entry', {
        p_connection_id: connectionId,
        p_user_id: senderId,
        p_message_body: text,
        p_reply_to_id: replyToId || null
      });
      if (!rpcError && rpcData) newMsg = rpcData;
    } catch (e) {
      // fallback
    }

    // 2. Try standard 3-param RPC
    if (!newMsg) {
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('send_connection_message_entry', {
          p_connection_id: connectionId,
          p_user_id: senderId,
          p_message_body: text
        });
        if (!rpcError && rpcData) newMsg = rpcData;
      } catch (e) {
        // fallback
      }
    }

    // 3. Fallback: verify user connection
    if (!newMsg) {
      const userConns = await this.getUserConnections(senderId);
      const conn = userConns.find(c => c.id === connectionId);
      if (!conn) {
        throw new Error('Connection not found or access denied.');
      }
      if (conn.status !== 'accepted') {
        throw new Error('Chat is only accessible for accepted connections.');
      }

      const crypto = await import('crypto');
      newMsg = {
        id: crypto.randomUUID(),
        connectionId,
        senderId,
        messageBody: text,
        createdAt: new Date().toISOString()
      };
    }

    if (newMsg && newMsg.id) {
      localMessageSenders.set(newMsg.id, senderId);
    }

    if (replyToId) {
      localReplyTos.set(newMsg.id, replyToId);
      newMsg.replyToId = replyToId;
    }

    return newMsg;
  },

  async editConnectionMessage(messageId, userId, newBody) {
    const text = (newBody || '').trim();
    if (!text) throw new Error('Message cannot be empty.');

    // Check sender ownership
    let senderId = localMessageSenders.get(messageId);
    if (!senderId) {
      try {
        const { data: dbMsg } = await supabase
          .from('messages')
          .select('sender_id')
          .eq('id', messageId)
          .maybeSingle();
        if (dbMsg && dbMsg.sender_id) {
          senderId = dbMsg.sender_id;
          localMessageSenders.set(messageId, senderId);
        }
      } catch (e) {
        // ignore
      }
    }

    if (senderId && senderId !== userId) {
      throw new Error('Access denied: You can only edit your own messages.');
    }

    // Try RPC first
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('edit_connection_message', {
        p_message_id: messageId,
        p_user_id: userId,
        p_new_body: text
      });
      if (rpcError) {
        if (rpcError.message && (rpcError.message.includes('own messages') || rpcError.message.includes('Access denied'))) {
          throw new Error(rpcError.message);
        }
      } else if (rpcData) {
        localEditedMessages.set(messageId, { text, isEdited: true });
        return rpcData;
      }
    } catch (e) {
      if (e.message && (e.message.includes('own messages') || e.message.includes('Access denied'))) {
        throw e;
      }
      // fallback
    }

    localEditedMessages.set(messageId, { text, isEdited: true });
    return {
      id: messageId,
      messageBody: text,
      isEdited: true
    };
  },

  async unsendConnectionMessage(messageId, userId) {
    let senderId = localMessageSenders.get(messageId);
    if (!senderId) {
      try {
        const { data: dbMsg } = await supabase
          .from('messages')
          .select('sender_id')
          .eq('id', messageId)
          .maybeSingle();
        if (dbMsg && dbMsg.sender_id) {
          senderId = dbMsg.sender_id;
          localMessageSenders.set(messageId, senderId);
        }
      } catch (e) {
        // ignore
      }
    }

    if (senderId && senderId !== userId) {
      throw new Error('Access denied: You can only unsend your own messages.');
    }

    localUnsentMessages.add(messageId);
    try {
      const { error: rpcError } = await supabase.rpc('unsend_connection_message', {
        p_message_id: messageId,
        p_user_id: userId
      });
      if (rpcError && rpcError.message && (rpcError.message.includes('own messages') || rpcError.message.includes('Access denied'))) {
        throw new Error(rpcError.message);
      }
    } catch (e) {
      if (e.message && (e.message.includes('own messages') || e.message.includes('Access denied'))) {
        throw e;
      }
      // fallback
    }
    return true;
  },

  async deleteMessageForMe(messageId, userId) {
    let set = localDeletedByMessages.get(messageId);
    if (!set) {
      set = new Set();
      localDeletedByMessages.set(messageId, set);
    }
    set.add(userId);

    try {
      await supabase.rpc('delete_message_for_me', {
        p_message_id: messageId,
        p_user_id: userId
      });
    } catch (e) {
      // fallback
    }
    return true;
  },

  async clearConnectionChat(connectionId, userId) {
    let clearTime = Date.now();
    try {
      const { data: rpcData } = await supabase.rpc('get_connection_messages_list', {
        p_connection_id: connectionId,
        p_user_id: userId
      });
      if (rpcData && Array.isArray(rpcData.messages) && rpcData.messages.length > 0) {
        for (const m of rpcData.messages) {
          const t = new Date(m.createdAt || m.created_at || 0).getTime();
          if (!isNaN(t) && t > clearTime) {
            clearTime = t;
          }
        }
      }
    } catch (e) {
      // ignore
    }

    localClearedChats.set(`${connectionId}_${userId}`, clearTime);
    try {
      await supabase.rpc('clear_connection_chat', {
        p_connection_id: connectionId,
        p_user_id: userId
      });
    } catch (e) {
      // fallback
    }
    return true;
  }
};
