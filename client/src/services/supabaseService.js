import { supabase, isSupabaseConfigured } from './supabase';

export const supabaseService = {
  // ----------------------------------------------------------------------------
  // SUPABASE AUTHENTICATION & GMAIL OTP VERIFICATION
  // ----------------------------------------------------------------------------
  async sendRegistrationOtp(gmail) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }
    const { data, error } = await supabase.auth.signInWithOtp({
      email: gmail.trim().toLowerCase(),
      options: { shouldCreateUser: true }
    });
    if (error) throw error;
    return data;
  },

  async verifyRegistrationOtp(gmail, otp) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }
    let res = await supabase.auth.verifyOtp({
      email: gmail.trim().toLowerCase(),
      token: otp.trim(),
      type: 'email'
    });
    if (res.error) {
      res = await supabase.auth.verifyOtp({
        email: gmail.trim().toLowerCase(),
        token: otp.trim(),
        type: 'signup'
      });
    }
    if (res.error) throw res.error;
    return res.data;
  },

  async sendPasswordRecoveryOtp(gmail) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }
    const { data, error } = await supabase.auth.signInWithOtp({
      email: gmail.trim().toLowerCase(),
      options: { shouldCreateUser: false }
    });
    if (error) throw error;
    return data;
  },

  async resetPasswordWithOtp(gmail, otp, newPassword) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }
    let verifyRes = await supabase.auth.verifyOtp({
      email: gmail.trim().toLowerCase(),
      token: otp.trim(),
      type: 'email'
    });
    if (verifyRes.error) {
      verifyRes = await supabase.auth.verifyOtp({
        email: gmail.trim().toLowerCase(),
        token: otp.trim(),
        type: 'recovery'
      });
    }
    if (verifyRes.error) throw verifyRes.error;

    const { data: updateData, error: updateErr } = await supabase.auth.updateUser({
      password: newPassword
    });
    if (updateErr) throw updateErr;
    return updateData;
  },

  async sendDeleteAccountOtp(gmail) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }
    const { data, error } = await supabase.auth.signInWithOtp({
      email: gmail.trim().toLowerCase(),
      options: { shouldCreateUser: false }
    });
    if (error) throw error;
    return data;
  },

  async verifyDeleteAccountOtp(gmail, otp) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }
    const { data, error } = await supabase.auth.verifyOtp({
      email: gmail.trim().toLowerCase(),
      token: otp.trim(),
      type: 'email'
    });
    if (error) throw error;
    return data;
  },

  async signUpWithBridgeAccount({ fullName, instituteName, bridgeAccount, username, password, email }) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }

    const targetUser = username || bridgeAccount;
    const targetEmail = email || `${targetUser.trim().toLowerCase()}@skillbridge.internal`;

    const { data, error } = await supabase.auth.signUp({
      email: targetEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          institute_name: instituteName.trim(),
          username: targetUser.trim(),
          bridge_account: targetUser.trim()
        }
      }
    });

    if (error) throw error;

    if (data.user) {
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName.trim(),
        institute_name: instituteName.trim(),
        bridge_account: targetUser.trim(),
        email: targetEmail,
        avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(targetUser.trim())}`,
        profile_completed: false
      });
      if (profileErr) console.warn('Supabase profile notice:', profileErr.message);
    }

    return data;
  },

  async signInWithBridgeAccount({ bridgeAccount, username, password, email }) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }

    const targetUser = username || bridgeAccount;
    const targetEmail = email || `${targetUser.trim().toLowerCase()}@skillbridge.internal`;

    const { data, error } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password
    });

    if (error) throw error;
    return data;
  },

  async signOut() {
    if (!isSupabaseConfigured()) return;
    await supabase.auth.signOut();
  },

  // ----------------------------------------------------------------------------
  // PROFILES & SKILLS
  // ----------------------------------------------------------------------------
  async getCompletedProfiles(searchQuery = '', currentUserId = null) {
    if (!isSupabaseConfigured()) return [];

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
          id,
          skill_name,
          skill_type
        )
      `)
      .eq('profile_completed', true);

    if (currentUserId) {
      query = query.neq('id', currentUserId);
    }

    const { data, error } = await query;
    if (error) throw error;

    let profiles = data || [];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      profiles = profiles.filter(p => {
        const hasSkill = (p.user_skills || []).some(s => s.skill_name.toLowerCase().includes(q));
        const hasName = p.full_name.toLowerCase().includes(q);
        const hasInst = p.institute_name.toLowerCase().includes(q);
        return hasSkill || hasName || hasInst;
      });
    }

    return profiles.map(p => ({
      id: p.id,
      name: p.full_name,
      instituteName: p.institute_name,
      bridgeAccount: p.bridge_account,
      avatar: p.avatar_url,
      skillsTeach: (p.user_skills || []).filter(s => s.skill_type === 'teach').map(s => s.skill_name),
      skillsLearn: (p.user_skills || []).filter(s => s.skill_type === 'learn').map(s => s.skill_name)
    }));
  },

  async getMyProfile(userId) {
    if (!isSupabaseConfigured() || !userId) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        institute_name,
        bridge_account,
        avatar_url,
        profile_completed,
        user_skills (
          id,
          skill_name,
          skill_type
        )
      `)
      .eq('id', userId)
      .single();

    if (error) return null;

    return {
      id: data.id,
      name: data.full_name,
      instituteName: data.institute_name,
      bridgeAccount: data.bridge_account,
      avatar: data.avatar_url,
      profileCompleted: data.profile_completed,
      skillsTeach: (data.user_skills || []).filter(s => s.skill_type === 'teach').map(s => s.skill_name),
      skillsLearn: (data.user_skills || []).filter(s => s.skill_type === 'learn').map(s => s.skill_name)
    };
  },

  async updateProfile(userId, { name, instituteName, avatarUrl, skillsTeach, skillsLearn }) {
    if (!isSupabaseConfigured() || !userId) return null;

    const hasTeach = skillsTeach.length > 0;
    const hasLearn = skillsLearn.length > 0;
    const isCompleted = hasTeach && hasLearn;

    // 1. Update profiles table
    const { data: updatedProfile, error: profileErr } = await supabase
      .from('profiles')
      .update({
        full_name: name.trim(),
        institute_name: instituteName.trim(),
        avatar_url: avatarUrl,
        profile_completed: isCompleted,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (profileErr) throw profileErr;

    // 2. Refresh user_skills
    await supabase.from('user_skills').delete().eq('user_id', userId);

    const skillsToInsert = [
      ...skillsTeach.map(skill => ({
        user_id: userId,
        skill_name: skill.trim(),
        skill_type: 'teach'
      })),
      ...skillsLearn.map(skill => ({
        user_id: userId,
        skill_name: skill.trim(),
        skill_type: 'learn'
      }))
    ];

    if (skillsToInsert.length > 0) {
      const { error: skillsErr } = await supabase.from('user_skills').insert(skillsToInsert);
      if (skillsErr) console.warn('Skills insert notice:', skillsErr.message);
    }

    return {
      ...updatedProfile,
      profileCompleted: isCompleted,
      skillsTeach,
      skillsLearn
    };
  },

  // ----------------------------------------------------------------------------
  // CONNECTIONS
  // ----------------------------------------------------------------------------
  async sendConnectionRequest(requesterId, recipientId) {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('skill_connections')
      .insert({
        requester_id: requesterId,
        recipient_id: recipientId,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async acceptConnection(connectionId) {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('skill_connections')
      .update({
        status: 'accepted',
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async rejectConnection(connectionId) {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('skill_connections')
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ----------------------------------------------------------------------------
  // REAL-TIME MESSAGING
  // ----------------------------------------------------------------------------
  async getMessages(connectionId) {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('connection_id', connectionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async sendMessage(connectionId, senderId, messageBody) {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('messages')
      .insert({
        connection_id: connectionId,
        sender_id: senderId,
        message_body: messageBody.trim()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  subscribeToMessages(connectionId, callback) {
    if (!isSupabaseConfigured()) return { unsubscribe: () => {} };

    const channel = supabase
      .channel(`chat_${connectionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `connection_id=eq.${connectionId}`
        },
        (payload) => callback(payload.new)
      )
      .subscribe();

    return {
      unsubscribe: () => supabase.removeChannel(channel)
    };
  }
};
