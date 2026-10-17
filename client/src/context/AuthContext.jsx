import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { supabase } from '../services/supabase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal & Drawer controls
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login'); // 'login' | 'register'
  const [activeChatConnectionId, setActiveChatConnectionId] = useState(null);

  // Load authenticated user on mount / page refresh
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      const token = localStorage.getItem('skillbridge_token');
      if (!token) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const res = await api.getMe();
        if (res?.user && mounted) {
          setUser(res.user);
        }
      } catch (err) {
        console.warn('Session restoration failed:', err.message);
        localStorage.removeItem('skillbridge_token');
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const login = async ({ username, bridgeAccount, identifier, email, password }) => {
    const targetIdentifier = (identifier || username || email || bridgeAccount || '').trim();
    const data = await api.login({ identifier: targetIdentifier, username: targetIdentifier, password });
    if (data?.token && data?.user) {
      localStorage.setItem('skillbridge_token', data.token);
      setUser(data.user);
      setAuthModalOpen(false);
      return data.user;
    }
    throw new Error('Invalid login response from server.');
  };

  const register = async ({
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
  }) => {
    const data = await api.register({
      fullName,
      instituteName,
      username: username || bridgeAccount,
      gmail: gmail || email,
      password,
      confirmPassword,
      otp,
      verificationToken,
      verified
    });
    if (data?.token && data?.user) {
      localStorage.setItem('skillbridge_token', data.token);
      setUser(data.user);
      setAuthModalOpen(false);
      return data.user;
    }
    throw new Error('Invalid registration response from server.');
  };

  const sendRegistrationOtp = async (gmail) => {
    return await api.sendRegistrationOtp(gmail);
  };

  const verifyRegistrationOtp = async (gmail, otp) => {
    return await api.verifyRegistrationOtp(gmail, otp);
  };

  const forgotPasswordSendOtp = async (identifier) => {
    return await api.forgotPasswordSendOtp(identifier);
  };

  const forgotPasswordReset = async ({ identifier, otp, newPassword, confirmPassword }) => {
    return await api.forgotPasswordReset({ identifier, otp, newPassword, confirmPassword });
  };

  const sendDeleteAccountOtp = async (gmail) => {
    return await api.sendDeleteAccountOtp(gmail);
  };

  const verifyDeletePassword = async (password) => {
    return await api.verifyDeletePassword(password);
  };

  const verifyDeleteAccountOtp = async (otp) => {
    return await api.verifyDeleteAccountOtp(otp);
  };

  const permanentlyDeleteAccount = async (payload) => {
    const res = await api.permanentlyDeleteAccount(payload);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Supabase signOut notice:', e.message);
    }
    localStorage.removeItem('skillbridge_token');
    setUser(null);
    setActiveChatConnectionId(null);
    return res;
  };

  const deleteAccount = async (otpOrPassword) => {
    const res = await api.deleteAccount(otpOrPassword);
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    localStorage.removeItem('skillbridge_token');
    setUser(null);
    setActiveChatConnectionId(null);
    return res;
  };

  const deleteAccountWithOtp = async (otp) => {
    const res = await api.deleteAccountWithOtp(otp);
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    localStorage.removeItem('skillbridge_token');
    setUser(null);
    setActiveChatConnectionId(null);
    return res;
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    localStorage.removeItem('skillbridge_token');
    setUser(null);
    setActiveChatConnectionId(null);
  };

  const refreshUser = async () => {
    try {
      const res = await api.getMe();
      if (res?.user) {
        setUser(res.user);
        return res.user;
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  const updateUserProfile = async (profileData) => {
    const res = await api.updateProfile(profileData);
    if (res?.user) {
      setUser(res.user);
      return res.user;
    }
    throw new Error('Failed to update profile');
  };

  const openAuth = (mode = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        deleteAccount,
        deleteAccountWithOtp,
        verifyDeletePassword,
        verifyDeleteAccountOtp,
        permanentlyDeleteAccount,
        sendRegistrationOtp,
        verifyRegistrationOtp,
        forgotPasswordSendOtp,
        forgotPasswordReset,
        sendDeleteAccountOtp,
        refreshUser,
        updateUserProfile,
        authModalOpen,
        setAuthModalOpen,
        authModalMode,
        setAuthModalMode,
        openAuth,
        activeChatConnectionId,
        setActiveChatConnectionId
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
