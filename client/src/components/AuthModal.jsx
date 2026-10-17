import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  LogIn,
  UserPlus,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle,
  Lock,
  User,
  Building,
  AtSign,
  Loader2,
  Mail,
  KeyRound,
  RotateCw,
  ArrowLeft,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function AuthModal({ onNavigateToProfile }) {
  const {
    authModalOpen,
    setAuthModalOpen,
    authModalMode,
    setAuthModalMode,
    login,
    register,
    sendRegistrationOtp,
    verifyRegistrationOtp,
    forgotPasswordSendOtp,
    forgotPasswordReset
  } = useAuth();

  // Mode: 'login' | 'register' | 'forgot-password'
  const mode = authModalMode === 'forgot-password' ? 'forgot-password' : (authModalMode === 'register' ? 'register' : 'login');

  // --------------------------------------------------------------------------
  // Login Form Fields (Strictly isolated from registration fields)
  // --------------------------------------------------------------------------
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // --------------------------------------------------------------------------
  // Registration Form Fields (Strictly isolated from login fields)
  // --------------------------------------------------------------------------
  const [regFullName, setRegFullName] = useState('');
  const [regInstituteName, setRegInstituteName] = useState('');
  const [regGmail, setRegGmail] = useState('');
  const [regOtp, setRegOtp] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Registration OTP & verification state
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verificationToken, setVerificationToken] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Username availability check (registration only)
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState(null); // { available: boolean, message: string }

  // --------------------------------------------------------------------------
  // Forgot Password Form Fields
  // --------------------------------------------------------------------------
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotStep, setForgotStep] = useState(1); // 1 = identifier, 2 = otp + new password
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);

  // General feedback
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Clear helpers
  const clearLoginForm = () => {
    setLoginIdentifier('');
    setLoginPassword('');
    setShowLoginPassword(false);
  };

  const clearRegisterForm = () => {
    setRegFullName('');
    setRegInstituteName('');
    setRegGmail('');
    setRegOtp('');
    setRegUsername('');
    setRegPassword('');
    setRegConfirmPassword('');
    setShowRegPassword(false);
    setShowRegConfirmPassword(false);
    setIsSendingOtp(false);
    setOtpSent(false);
    setIsVerifyingOtp(false);
    setIsEmailVerified(false);
    setVerificationToken(null);
    setUsernameStatus(null);
  };

  const clearForgotPasswordForm = () => {
    setForgotIdentifier('');
    setForgotOtp('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotStep(1);
    setForgotMessage('');
    setForgotSuccess(false);
    setShowForgotNewPassword(false);
    setShowForgotConfirmPassword(false);
  };

  // Reset errors and transient states when modal opens or mode changes
  useEffect(() => {
    setError('');
    setSuccessMessage('');
  }, [authModalMode, authModalOpen]);

  // When modal is opened, ensure login form is always clean and never auto-filled
  useEffect(() => {
    if (authModalOpen) {
      clearLoginForm();
    }
  }, [authModalOpen]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Gmail format validation helper (must end with @gmail.com)
  const isGmailValid = (emailStr) => {
    if (!emailStr) return false;
    const regex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    return regex.test(emailStr.trim());
  };

  // Password requirements validation helper (Registration)
  const passwordRules = {
    hasLetters: /[a-zA-Z]/.test(regPassword),
    hasNumbers: /[0-9]/.test(regPassword),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(regPassword),
    hasMinLength: regPassword.length >= 8,
    matchesConfirm: regConfirmPassword.length > 0 && regPassword === regConfirmPassword
  };

  const isPasswordValid =
    passwordRules.hasLetters &&
    passwordRules.hasNumbers &&
    passwordRules.hasSpecial &&
    passwordRules.hasMinLength;

  // Forgot password requirements validation
  const forgotPasswordRules = {
    hasLetters: /[a-zA-Z]/.test(forgotNewPassword),
    hasNumbers: /[0-9]/.test(forgotNewPassword),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(forgotNewPassword),
    hasMinLength: forgotNewPassword.length >= 8,
    matchesConfirm: forgotConfirmPassword.length > 0 && forgotNewPassword === forgotConfirmPassword
  };

  // Debounced check for Username availability during registration
  useEffect(() => {
    if (mode !== 'register' || !regUsername.trim()) {
      setUsernameStatus(null);
      return;
    }

    const timer = setTimeout(async () => {
      const trimmed = regUsername.trim().replace(/^@/, '');
      if (trimmed.length < 3) {
        setUsernameStatus({ available: false, message: 'Username must be at least 3 characters.' });
        return;
      }
      setCheckingUsername(true);
      try {
        const res = await api.checkUsername(trimmed);
        setUsernameStatus(res);
      } catch (err) {
        setUsernameStatus({ available: false, message: err.message || 'Error checking availability' });
      } finally {
        setCheckingUsername(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [regUsername, mode]);

  if (!authModalOpen) return null;

  // --------------------------------------------------------------------------
  // OTP Verification Handlers (Registration)
  // --------------------------------------------------------------------------
  const handleSendRegistrationOtp = async () => {
    const trimmedGmail = regGmail.trim().toLowerCase();
    if (!isGmailValid(trimmedGmail)) {
      setError('Please enter a valid Gmail address (ending with @gmail.com).');
      return;
    }

    setError('');
    setSuccessMessage('');
    setIsSendingOtp(true);
    setOtpSent(true);

    try {
      const res = await sendRegistrationOtp(trimmedGmail);
      setResendCooldown(45);
      setSuccessMessage(res?.message || 'Verification code sent to your Gmail.');
      setTimeout(() => {
        const el = document.getElementById('registration-otp-container');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    } catch (err) {
      setError(err.message || 'Failed to send verification code. Please check your Gmail.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyRegistrationOtp = async () => {
    const trimmedOtp = regOtp.trim();
    if (!trimmedOtp || trimmedOtp.length < 6) {
      setError('Please enter the 6-digit OTP code sent to your Gmail.');
      return;
    }

    setError('');
    setIsVerifyingOtp(true);

    try {
      const res = await verifyRegistrationOtp(regGmail.trim().toLowerCase(), trimmedOtp);
      if (res && (res.verified || res.success)) {
        setIsEmailVerified(true);
        if (res.verificationToken) {
          setVerificationToken(res.verificationToken);
        }
        setSuccessMessage('Mail account is verified');
      } else {
        setError(res?.error || 'Wrong OTP. Email verification failed.');
      }
    } catch (err) {
      setError(err.message || 'Wrong OTP. Please enter the correct code.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // --------------------------------------------------------------------------
  // Forgot Password Handlers
  // --------------------------------------------------------------------------
  const handleForgotSendOtp = async (e) => {
    e.preventDefault();
    const rawTrimmed = (forgotIdentifier || '').trim();
    const trimmed = rawTrimmed.startsWith('@') ? rawTrimmed.slice(1).trim() : rawTrimmed;
    if (!trimmed) {
      setError('Please enter your Username or Gmail address.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await forgotPasswordSendOtp(trimmed);
      setForgotMessage(res.message || 'A recovery OTP has been sent to your registered Gmail.');
      setForgotStep(2);
      setResendCooldown(45);
    } catch (err) {
      setError(err.message || 'Failed to send recovery OTP. Please verify your username or Gmail.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotResetPassword = async (e) => {
    e.preventDefault();
    const trimmedOtp = forgotOtp.trim();
    const rawTrimmed = (forgotIdentifier || '').trim();
    const trimmedIdentifier = rawTrimmed.startsWith('@') ? rawTrimmed.slice(1).trim() : rawTrimmed;

    if (!trimmedOtp || trimmedOtp.length < 6) {
      setError('Please enter the 6-digit OTP code sent to your Gmail.');
      return;
    }

    if (!forgotPasswordRules.hasMinLength || !forgotPasswordRules.hasLetters || !forgotPasswordRules.hasNumbers || !forgotPasswordRules.hasSpecial) {
      setError('Password must contain letters, numbers, and at least one special character (@, #, $, etc.), and be at least 8 characters long.');
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setError('Passwords do not match. Please verify both fields.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await forgotPasswordReset({
        identifier: trimmedIdentifier,
        otp: trimmedOtp,
        newPassword: forgotNewPassword,
        confirmPassword: forgotConfirmPassword
      });

      setForgotSuccess(true);
      setSuccessMessage(res.message || 'Password updated successfully! You can now sign in.');
    } catch (err) {
      setError(err.message || 'Invalid or wrong OTP. Password reset cancelled.');
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // Form Submission (Login & Register)
  // --------------------------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    // REGISTRATION
    if (mode === 'register') {
      if (!regFullName.trim()) {
        setError('Please enter your Full Name.');
        return;
      }
      if (!regInstituteName.trim()) {
        setError('Please enter your Institute Name.');
        return;
      }
      if (!isGmailValid(regGmail)) {
        setError('Please enter a valid Gmail address (ending with @gmail.com).');
        return;
      }
      if (!isEmailVerified) {
        setError('Please complete the Gmail OTP verification before registering.');
        return;
      }
      const cleanUsername = regUsername.trim().replace(/^@/, '');
      if (!cleanUsername) {
        setError('Please choose a Username.');
        return;
      }
      if (usernameStatus && !usernameStatus.available) {
        setError(usernameStatus.message || 'Username already taken');
        return;
      }
      if (!isPasswordValid) {
        setError('Password must be at least 8 characters and contain letters, numbers, and at least one special character (@, #, $, %).');
        return;
      }
      if (regPassword !== regConfirmPassword) {
        setError('Passwords do not match. Please verify both fields.');
        return;
      }

      setLoading(true);
      try {
        await register({
          fullName: regFullName.trim(),
          instituteName: regInstituteName.trim(),
          username: cleanUsername,
          gmail: regGmail.trim().toLowerCase(),
          password: regPassword,
          confirmPassword: regConfirmPassword,
          otp: regOtp.trim(),
          verificationToken,
          verified: true
        });

        // Clear all form inputs so sign-in is NEVER auto-filled
        clearRegisterForm();
        clearLoginForm();
        clearForgotPasswordForm();

        // Direct user to profile immediately after registration
        setAuthModalOpen(false);
        if (onNavigateToProfile) {
          onNavigateToProfile();
        }
      } catch (err) {
        setError(err.message || 'Registration failed. Please check your information.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // SIGN-IN
    if (mode === 'login') {
      const cleanLoginIdentifier = loginIdentifier.trim().replace(/^@/, '');
      if (!cleanLoginIdentifier || !loginPassword) {
        setError('Please enter both Username/Gmail and password.');
        return;
      }

      setLoading(true);
      try {
        await login({ username: cleanLoginIdentifier, identifier: cleanLoginIdentifier, password: loginPassword });
        clearLoginForm();
        setAuthModalOpen(false);
      } catch (err) {
        setError(err.message || 'Invalid Username, Gmail, or password. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md glass-panel rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/20 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={() => {
            clearLoginForm();
            setAuthModalOpen(false);
          }}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-[#7657ff]/20 to-[#39d5f6]/20 border border-white/10 mb-3 shadow-inner">
            {mode === 'forgot-password' ? (
              <KeyRound className="w-7 h-7 text-[#39d5f6]" />
            ) : mode === 'register' ? (
              <UserPlus className="w-7 h-7 text-[#7657ff]" />
            ) : (
              <Sparkles className="w-7 h-7 text-[#39d5f6]" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {mode === 'forgot-password' && 'Reset Password'}
            {mode === 'login' && 'Sign In'}
            {mode === 'register' && 'Create Account'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {mode === 'forgot-password' && 'Recover your account securely with your verified Gmail'}
            {mode === 'login' && 'Enter your username and password to continue'}
            {mode === 'register' && 'Join the SkillBridge community with verified Gmail identity'}
          </p>
        </div>

        {/* Tab Toggle (Sign In vs Register) - Hidden in Forgot Password */}
        {mode !== 'forgot-password' && (
          <div className="flex p-1 rounded-xl bg-white/5 border border-white/10 mb-6">
            <button
              type="button"
              onClick={() => {
                setAuthModalMode('login');
                clearLoginForm();
                setError('');
                setSuccessMessage('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-gradient-to-r from-[#7657ff] to-[#39d5f6] text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthModalMode('register');
                setError('');
                setSuccessMessage('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-gradient-to-r from-[#7657ff] to-[#39d5f6] text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>
        )}

        {/* Success message */}
        {successMessage && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* ================================================================ */}
        {/* FORGOT PASSWORD VIEW */}
        {/* ================================================================ */}
        {mode === 'forgot-password' && (
          <div>
            {forgotSuccess ? (
              <div className="text-center py-4 space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <p className="text-sm text-white font-bold">Your password has been reset successfully!</p>
                <p className="text-xs text-slate-300">You can now sign in using your username and new password.</p>
                <button
                  type="button"
                  onClick={() => {
                    clearLoginForm();
                    clearForgotPasswordForm();
                    setAuthModalMode('login');
                    setError('');
                    setSuccessMessage('');
                  }}
                  className="w-full py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#7657ff] to-[#39d5f6] shadow-md transition-all cursor-pointer"
                >
                  Proceed to Sign In
                </button>
              </div>
            ) : forgotStep === 1 ? (
              <form onSubmit={handleForgotSendOtp} autoComplete="off" className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-[#39d5f6]" /> Username or Gmail Account *
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    disabled={loading}
                    placeholder="Enter your username or alex@gmail.com"
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-[#7657ff]"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    If username is entered, recovery code will be securely sent to the linked Gmail.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !forgotIdentifier.trim()}
                  className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#7657ff] to-[#39d5f6] hover:opacity-95 shadow-lg shadow-[#7657ff]/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? (
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>Send Recovery OTP</span>
                    </>
                  )}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      clearLoginForm();
                      clearForgotPasswordForm();
                      setAuthModalMode('login');
                      setError('');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleForgotResetPassword} autoComplete="off" className="space-y-3.5">
                {forgotMessage && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#39d5f6] shrink-0" />
                    <span>{forgotMessage}</span>
                  </div>
                )}

                {/* OTP code */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-[#39d5f6]" /> Enter 6-digit Recovery OTP *
                    </label>
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || loading}
                      onClick={handleForgotSendOtp}
                      className="text-[11px] text-[#39d5f6] hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCw className="w-3 h-3" />
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    maxLength={8}
                    disabled={loading}
                    placeholder="123456"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-xs font-mono tracking-widest text-center focus:outline-none focus:border-[#7657ff]"
                  />
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-[#7657ff]" /> New Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showForgotNewPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      disabled={loading}
                      placeholder="••••••••"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-[#7657ff]"
                    />
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {showForgotNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-[#7657ff]" /> Confirm New Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showForgotConfirmPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      disabled={loading}
                      placeholder="••••••••"
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-[#7657ff]"
                    />
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {showForgotConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Reset Button */}
                <button
                  type="submit"
                  disabled={
                    loading ||
                    !forgotOtp.trim() ||
                    !forgotPasswordRules.hasMinLength ||
                    !forgotPasswordRules.hasLetters ||
                    !forgotPasswordRules.hasNumbers ||
                    !forgotPasswordRules.hasSpecial ||
                    forgotNewPassword !== forgotConfirmPassword
                  }
                  className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#7657ff] to-[#39d5f6] hover:opacity-95 shadow-lg shadow-[#7657ff]/25 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? (
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <span>Update Password & Finish</span>
                  )}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep(1);
                      setError('');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Step 1
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* SIGN IN VIEW (Strictly separated from Register) */}
        {/* ================================================================ */}
        {mode === 'login' && (
          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
            {/* Username or Gmail Account */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <AtSign className="w-3.5 h-3.5 text-[#39d5f6]" /> Username or Gmail Account *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold font-mono">
                  @
                </span>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  disabled={loading}
                  placeholder="alex_rivera or alex@gmail.com"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-[#7657ff] disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-[#7657ff]" /> Password *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const clean = loginIdentifier.trim().replace(/^@/, '');
                    setForgotIdentifier(clean);
                    setAuthModalMode('forgot-password');
                    setError('');
                    setSuccessMessage('');
                  }}
                  className="text-[11px] text-[#39d5f6] hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-[#7657ff] disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !loginIdentifier.trim() || !loginPassword}
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#7657ff] to-[#39d5f6] hover:opacity-95 shadow-lg shadow-[#7657ff]/25 transition-all flex items-center justify-center gap-2 mt-5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* ================================================================ */}
        {/* REGISTER VIEW (Strictly separated from Login) */}
        {/* ================================================================ */}
        {mode === 'register' && (
          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-3.5">
            {/* 1. Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-[#39d5f6]" /> Full Name *
              </label>
              <input
                type="text"
                required
                autoComplete="off"
                placeholder="e.g. Alex Rivera"
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-[#7657ff]"
              />
            </div>

            {/* 2. Institute Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-[#39d5f6]" /> Institute Name *
              </label>
              <input
                type="text"
                required
                autoComplete="off"
                placeholder="e.g. Stanford University or Self-Taught"
                value={regInstituteName}
                onChange={(e) => setRegInstituteName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-[#7657ff]"
              />
            </div>

            {/* 3. Gmail Account & Send OTP */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-[#39d5f6]" /> Gmail Account *
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="email"
                    required
                    autoComplete="off"
                    disabled={isEmailVerified || isSendingOtp}
                    placeholder="alex@gmail.com"
                    value={regGmail}
                    onChange={(e) => {
                      setRegGmail(e.target.value);
                      setIsEmailVerified(false);
                      setOtpSent(false);
                      setVerificationToken(null);
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-white/5 border text-white placeholder-slate-500 text-xs focus:outline-none ${
                      isEmailVerified
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-200'
                        : 'border-white/10 focus:border-[#7657ff]'
                    }`}
                  />
                  {isEmailVerified && (
                    <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                  )}
                </div>

                <button
                  type="button"
                  disabled={!isGmailValid(regGmail) || isSendingOtp || isEmailVerified || resendCooldown > 0}
                  onClick={handleSendRegistrationOtp}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7657ff] to-[#39d5f6] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                >
                  {isSendingOtp ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Mail className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isEmailVerified
                      ? 'Verified'
                      : resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : otpSent
                      ? 'Resend OTP'
                      : 'Send OTP'}
                  </span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                A 6-digit OTP will be sent to your Gmail via Supabase Auth for identity verification.
              </p>
            </div>

            {/* 4. OTP Verification Input */}
            {otpSent && !isEmailVerified && (
              <div
                id="registration-otp-container"
                className="p-4 rounded-2xl bg-white/5 border border-white/15 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200 shadow-inner"
              >
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-[#39d5f6]" />
                    <span>Enter 6-digit OTP Code *</span>
                  </label>
                  <button
                    type="button"
                    disabled={isSendingOtp || resendCooldown > 0}
                    onClick={handleSendRegistrationOtp}
                    className="text-xs font-semibold text-[#39d5f6] hover:text-[#7657ff] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isSendingOtp ? 'animate-spin' : ''}`} />
                    <span>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}</span>
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    maxLength={8}
                    placeholder="e.g. 123456"
                    value={regOtp}
                    onChange={(e) => setRegOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    disabled={isVerifyingOtp}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-black/40 border border-white/20 text-white placeholder-slate-500 text-sm font-mono text-center tracking-widest focus:outline-none focus:border-[#39d5f6] disabled:opacity-60"
                  />
                  <button
                    type="button"
                    disabled={isVerifyingOtp || !regOtp.trim()}
                    onClick={handleVerifyRegistrationOtp}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-md shrink-0 cursor-pointer"
                  >
                    {isVerifyingOtp ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                    <span>Verify OTP</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-400">
                  Enter the 6-digit verification code sent to <span className="text-emerald-400 font-mono">{regGmail}</span>.
                </p>
              </div>
            )}

            {/* Verified Confirmation Badge */}
            {isEmailVerified && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2 text-emerald-300 text-xs font-semibold animate-in fade-in duration-200">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Mail account is verified</span>
              </div>
            )}

            {/* 5. Choose Username */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <AtSign className="w-3.5 h-3.5 text-[#7657ff]" /> Choose a Username *
                </label>
                {checkingUsername && (
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin text-[#39d5f6]" /> Checking...
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold font-mono">
                  @
                </span>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  disabled={loading}
                  placeholder="alex_rivera"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className={`w-full pl-8 pr-9 py-2.5 rounded-xl bg-white/5 border text-white placeholder-slate-500 text-xs font-mono focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed ${
                    usernameStatus
                      ? usernameStatus.available
                        ? 'border-[#10b981] focus:border-[#10b981]'
                        : 'border-rose-500 focus:border-rose-500'
                      : 'border-white/10 focus:border-[#7657ff]'
                  }`}
                />
                {usernameStatus && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {usernameStatus.available ? (
                      <CheckCircle className="w-4 h-4 text-[#10b981]" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                    )}
                  </div>
                )}
              </div>
              {usernameStatus && (
                <p
                  className={`text-[11px] mt-1 font-medium ${
                    usernameStatus.available ? 'text-[#10b981]' : 'text-rose-400 font-semibold'
                  }`}
                >
                  {usernameStatus.message}
                </p>
              )}
            </div>

            {/* 6. Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-[#7657ff]" /> Create Password *
              </label>
              <div className="relative">
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  disabled={loading}
                  placeholder="••••••••"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-[#7657ff] disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 7. Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-[#7657ff]" /> Confirm Password *
              </label>
              <div className="relative">
                <input
                  type={showRegConfirmPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  disabled={loading}
                  placeholder="••••••••"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-[#7657ff] disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showRegConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password Requirements Guide */}
            {regPassword && (
              <div className="p-2.5 rounded-xl bg-white/5 text-[11px] text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300">Password Checklist:</p>
                <div className="grid grid-cols-2 gap-1">
                  <span className={passwordRules.hasLetters ? 'text-emerald-400' : 'text-slate-400'}>
                    {passwordRules.hasLetters ? '✓' : '•'} Letters (a-z)
                  </span>
                  <span className={passwordRules.hasNumbers ? 'text-emerald-400' : 'text-slate-400'}>
                    {passwordRules.hasNumbers ? '✓' : '•'} Numbers (0-9)
                  </span>
                  <span className={passwordRules.hasSpecial ? 'text-emerald-400' : 'text-slate-400'}>
                    {passwordRules.hasSpecial ? '✓' : '•'} Special (@ # $ % &)
                  </span>
                  <span className={passwordRules.hasMinLength ? 'text-emerald-400' : 'text-slate-400'}>
                    {passwordRules.hasMinLength ? '✓' : '•'} Min 8 chars
                  </span>
                </div>
                {regConfirmPassword && (
                  <p className={passwordRules.matchesConfirm ? 'text-emerald-400' : 'text-rose-400'}>
                    {passwordRules.matchesConfirm ? '✓ Passwords match' : '✕ Passwords do not match'}
                  </p>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={
                loading ||
                !isEmailVerified ||
                !isPasswordValid ||
                regPassword !== regConfirmPassword ||
                (usernameStatus && !usernameStatus.available)
              }
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#7657ff] to-[#39d5f6] hover:opacity-95 shadow-lg shadow-[#7657ff]/25 transition-all flex items-center justify-center gap-2 mt-5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Register & Continue to Profile</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
