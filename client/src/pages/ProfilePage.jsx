import React, { useState, useEffect } from 'react';
import {
  User,
  Building,
  AtSign,
  Camera,
  Plus,
  X,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Mail,
  KeyRound,
  ShieldCheck,
  RotateCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { uploadAvatarToSupabase } from '../services/supabase';

export default function ProfilePage({ setCurrentView }) {
  const {
    user,
    refreshUser,
    updateUserProfile,
    verifyDeletePassword,
    sendDeleteAccountOtp,
    verifyDeleteAccountOtp,
    permanentlyDeleteAccount,
    openAuth
  } = useAuth();

  const [fullName, setFullName] = useState('');
  const [instituteName, setInstituteName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [skillsTeach, setSkillsTeach] = useState([]);
  const [skillsLearn, setSkillsLearn] = useState([]);

  const [teachInput, setTeachInput] = useState('');
  const [learnInput, setLearnInput] = useState('');

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Delete Account Multi-Step States:
  // Step 2: Password Verification (Current Password, Forgot Password? link, Continue)
  // Step 'otp': Forgot Password inside Delete Flow (Linked Gmail, Send OTP, Verify OTP, "Email verified")
  // Step 3: Final Confirmation ("Are you sure you want to permanently delete your account?", Cancel, Permanently Delete)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(2);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [deleteOtp, setDeleteOtp] = useState('');
  const [deleteOtpSent, setDeleteOtpSent] = useState(false);
  const [sendingDeleteOtp, setSendingDeleteOtp] = useState(false);
  const [verifyingDeleteOtp, setVerifyingDeleteOtp] = useState(false);
  const [deleteOtpVerified, setDeleteOtpVerified] = useState(false);
  const [deleteToken, setDeleteToken] = useState('');
  const [deleteCooldown, setDeleteCooldown] = useState(0);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [serverMaskedEmail, setServerMaskedEmail] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const maskEmail = (email) => {
    if (!email || typeof email !== 'string') return '';
    const parts = email.trim().split('@');
    if (parts.length !== 2) return email;
    const [local, domain] = parts;
    if (local.length <= 1) {
      return `${local}***@${domain}`;
    }
    return `${local[0]}***@${domain}`;
  };

  const resetDeleteModal = () => {
    setDeleteStep(2);
    setDeletePassword('');
    setShowDeletePassword(false);
    setVerifyingPassword(false);
    setDeleteOtp('');
    setDeleteOtpSent(false);
    setSendingDeleteOtp(false);
    setVerifyingDeleteOtp(false);
    setDeleteOtpVerified(false);
    setDeleteToken('');
    setDeleteError('');
    setDeleteModalOpen(false);
  };

  const handleVerifyPassword = async () => {
    if (!deletePassword.trim()) {
      setDeleteError('Please enter your current password to proceed.');
      return;
    }
    setVerifyingPassword(true);
    setDeleteError('');
    try {
      const res = await verifyDeletePassword(deletePassword);
      if (res && res.verified) {
        setDeleteToken(res.deleteToken || '');
        setDeleteStep(3); // Proceed to final confirmation
      } else {
        setDeleteError(res?.error || 'Incorrect password. Deletion blocked.');
      }
    } catch (err) {
      setDeleteError(err.message || 'Incorrect password. Deletion blocked.');
    } finally {
      setVerifyingPassword(false);
    }
  };

  const handleSendDeleteOtp = async () => {
    setSendingDeleteOtp(true);
    setDeleteError('');
    try {
      const res = await sendDeleteAccountOtp();
      setDeleteOtpSent(true);
      setDeleteCooldown(45);
      if (res?.maskedEmail) {
        setServerMaskedEmail(res.maskedEmail);
      }
    } catch (err) {
      setDeleteError(err.message || 'Failed to send OTP to linked Gmail.');
    } finally {
      setSendingDeleteOtp(false);
    }
  };

  const handleVerifyDeleteOtp = async () => {
    const trimmed = (deleteOtp || '').trim();
    if (!trimmed || trimmed.length < 6) {
      setDeleteError('Please enter the 6-digit OTP code sent to your Gmail.');
      return;
    }
    setVerifyingDeleteOtp(true);
    setDeleteError('');
    try {
      const res = await verifyDeleteAccountOtp(trimmed);
      if (res && res.verified) {
        setDeleteOtpVerified(true);
        setDeleteToken(res.deleteToken || '');
        setDeleteError('');
      } else {
        setDeleteError(res?.error || 'Invalid OTP');
      }
    } catch (err) {
      setDeleteError(err.message || 'Invalid OTP');
    } finally {
      setVerifyingDeleteOtp(false);
    }
  };

  const handleFinalPermanentlyDelete = async () => {
    setDeletingAccount(true);
    setDeleteError('');
    try {
      await permanentlyDeleteAccount({
        deleteToken,
        password: deletePassword || undefined,
        otp: deleteOtp || undefined
      });
      resetDeleteModal();
      if (setCurrentView) setCurrentView('home');
      openAuth('login');
      alert('Your SkillBridge account has been permanently deleted.');
    } catch (err) {
      setDeleteError(err.message || 'Failed to permanently delete account.');
    } finally {
      setDeletingAccount(false);
    }
  };

  useEffect(() => {
    if (deleteCooldown <= 0) return;
    const timer = setInterval(() => {
      setDeleteCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [deleteCooldown]);

  useEffect(() => {
    if (user) {
      setFullName(user.name || '');
      setInstituteName(user.instituteName || '');
      setAvatar(user.avatar || '');
      setSkillsTeach(user.skillsTeach || []);
      setSkillsLearn(user.skillsLearn || []);
    }
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-24 px-4 text-center space-y-4">
        <p className="text-[#164E41] font-semibold">Please sign in to update your profile.</p>
        <button
          onClick={() => openAuth('login')}
          className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#16866A] hover:bg-[#0F7058] shadow-md cursor-pointer"
        >
          Sign In
        </button>
      </div>
    );
  }

  // Add skill to teach
  const handleAddTeachSkill = (e) => {
    e?.preventDefault();
    const trimmed = teachInput.trim();
    if (!trimmed) return;
    if (skillsTeach.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg(`"${trimmed}" is already added to skills you teach.`);
      return;
    }
    setSkillsTeach([...skillsTeach, trimmed]);
    setTeachInput('');
    setErrorMsg('');
  };

  // Remove skill to teach
  const handleRemoveTeachSkill = (skillToRemove) => {
    setSkillsTeach(skillsTeach.filter(s => s !== skillToRemove));
  };

  // Add skill to learn
  const handleAddLearnSkill = (e) => {
    e?.preventDefault();
    const trimmed = learnInput.trim();
    if (!trimmed) return;
    if (skillsLearn.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg(`"${trimmed}" is already added to skills you want to learn.`);
      return;
    }
    setSkillsLearn([...skillsLearn, trimmed]);
    setLearnInput('');
    setErrorMsg('');
  };

  // Remove skill to learn
  const handleRemoveLearnSkill = (skillToRemove) => {
    setSkillsLearn(skillsLearn.filter(s => s !== skillToRemove));
  };

  // Handle image upload with Supabase Storage
  const handleImageFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image file size must be less than 5MB.');
      return;
    }

    // Set immediate preview
    const previewUrl = URL.createObjectURL(file);
    setAvatar(previewUrl);
    setErrorMsg('');
    setUploadingAvatar(true);

    try {
      const publicUrl = await uploadAvatarToSupabase(file, user?.id);
      if (publicUrl) {
        setAvatar(publicUrl);
      }
    } catch (err) {
      console.warn('Supabase storage upload notice:', err.message);
      // Fallback to local DataURL if avatars bucket not yet created
      const reader = new FileReader();
      reader.onload = () => {
        setAvatar(reader.result);
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Randomize Dicebear avatar seed
  const handleRandomizeAvatar = () => {
    const randomSeed = Math.random().toString(36).substring(2, 9);
    setAvatar(`https://api.dicebear.com/7.x/bottts/svg?seed=${randomSeed}`);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!instituteName.trim()) {
      setErrorMsg('Please enter your institute name.');
      return;
    }

    setLoading(true);
    try {
      const updated = await updateUserProfile({
        name: fullName.trim(),
        instituteName: instituteName.trim(),
        avatar: avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.bridgeAccount)}`,
        skillsTeach,
        skillsLearn
      });

      await refreshUser();

      if (updated.profileCompleted) {
        setSuccessMsg('Profile updated successfully! You are now visible in Explore Skills.');
      } else {
        setSuccessMsg('Profile saved! Note: Add at least 1 skill to teach and 1 skill to learn to appear in Explore Skills.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const isProfileComplete = skillsTeach.length > 0 && skillsLearn.length > 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white border border-[#D5E9DF] p-1 flex items-center justify-center shadow-xs overflow-hidden shrink-0">
              <img src="/logo.png" alt="SkillBridge Logo" className="w-full h-full object-contain rounded-xl" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#16866A]">
                Profile & Account
              </span>
              <h1 className="text-3xl font-black text-[#164E41] tracking-tight mt-0.5">
                Update Profile
              </h1>
              <p className="text-xs sm:text-sm text-[#527568]">
                Manage your credentials, teaching capabilities, and learning interests.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${
              isProfileComplete
                ? 'bg-[#E4F6EE] border-[#D5E9DF] text-[#16866A]'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              {isProfileComplete ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Public & Discoverable</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Incomplete Profile</span>
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-[#E4F6EE] border border-[#A8E6CF] text-[#16866A] text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-[#16866A]" />
            <span>{successMsg}</span>
          </div>
          {isProfileComplete && (
            <button
              onClick={() => setCurrentView('explore')}
              className="px-3 py-1.5 rounded-xl bg-[#16866A] hover:bg-[#0F7058] text-white font-bold text-xs flex items-center gap-1 transition-colors shrink-0"
            >
              <span>Explore Skills</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Profile Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Card 1: Identity & Avatar */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#D5E9DF] space-y-6 shadow-xs">
          <h2 className="text-base font-bold text-[#164E41] flex items-center gap-2 border-b border-[#D5E9DF] pb-3">
            <User className="w-4 h-4 text-[#16866A]" />
            <span>Profile Identity</span>
          </h2>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Avatar Preview */}
            <div className="relative group shrink-0">
              <img
                src={avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.bridgeAccount)}`}
                alt={user.name}
                className="w-24 h-24 rounded-2xl object-cover border-2 border-[#16866A]/30 shadow-md"
              />
              <label
                htmlFor="avatar-upload"
                className="absolute inset-0 rounded-2xl bg-[#164E41]/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-semibold cursor-pointer transition-opacity"
              >
                <Camera className="w-5 h-5 mb-1" />
                <span>Change</span>
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                className="hidden"
              />
            </div>

            {/* Avatar Controls */}
            <div className="space-y-2 text-center sm:text-left">
              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                <label
                  htmlFor="avatar-upload-btn"
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#164E41] bg-[#F1FAF5] hover:bg-[#E4F6EE] border border-[#D5E9DF] cursor-pointer transition-colors"
                >
                  Upload New Photo
                </label>
                <input
                  id="avatar-upload-btn"
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={handleRandomizeAvatar}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#527568] hover:text-[#164E41] bg-[#F1FAF5] hover:bg-[#E4F6EE] border border-[#D5E9DF] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Randomize Avatar</span>
                </button>
              </div>
              <p className="text-[11px] text-[#527568]">
                Supports JPG, PNG, WebP or SVG up to 5MB. Stored securely.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-[#164E41] mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-[#16866A]" /> Full Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your Full Name"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A]"
              />
            </div>

            {/* Institute Name */}
            <div>
              <label className="block text-xs font-semibold text-[#164E41] mb-1 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-[#16866A]" /> Institute Name *
              </label>
              <input
                type="text"
                required
                value={instituteName}
                onChange={(e) => setInstituteName(e.target.value)}
                placeholder="e.g. Stanford University or Self-Taught"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A]"
              />
            </div>

            {/* Username (Read Only) */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#164E41] mb-1 flex items-center gap-1">
                <AtSign className="w-3.5 h-3.5 text-[#16866A]" /> Username Handle
              </label>
              <input
                type="text"
                disabled
                value={`@${user.username || user.bridgeAccount}`}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F1FAF5] border border-[#D5E9DF] text-[#527568] font-mono text-xs cursor-not-allowed select-none"
              />
              <p className="text-[10px] text-[#527568] mt-1">
                Your unique SkillBridge username is locked for security.
              </p>
            </div>

            {/* Verified Gmail Display */}
            {user.email && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#164E41] mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-[#16866A]" /> Verified Gmail Account
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    disabled
                    value={user.email}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#E4F6EE] border border-[#A8E6CF] text-[#16866A] font-mono text-xs cursor-not-allowed select-none"
                  />
                  <span className="text-[11px] text-[#16866A] font-bold shrink-0 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Verified
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Skills You Can Teach */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#D5E9DF] space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#D5E9DF] pb-3">
            <h2 className="text-base font-bold text-[#164E41] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#16866A]" />
              <span>Skills You Can Teach</span>
            </h2>
            <span className="text-[11px] text-[#527568]">
              {skillsTeach.length} skill{skillsTeach.length !== 1 ? 's' : ''} added (At least 1 required)
            </span>
          </div>

          <p className="text-xs text-[#527568] leading-relaxed">
            List the skills or topics you are confident sharing with others (e.g. Python, UI Design, Guitar, Video Editing).
          </p>

          {/* Add Skill Input */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Python, React, Web Development..."
              value={teachInput}
              onChange={(e) => setTeachInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTeachSkill();
                }
              }}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A]"
            />
            <button
              type="button"
              onClick={handleAddTeachSkill}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#16866A] hover:bg-[#0F7058] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>

          {/* Skills Badges */}
          <div className="flex flex-wrap gap-2 pt-1 min-h-[40px]">
            {skillsTeach.length === 0 ? (
              <span className="text-xs text-[#527568]/70 italic">
                No teaching skills added yet. Add at least one skill.
              </span>
            ) : (
              skillsTeach.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E4F6EE] border border-[#D5E9DF] text-[#16866A] text-xs font-semibold shadow-xs"
                >
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTeachSkill(skill)}
                    className="p-0.5 rounded-full hover:bg-[#16866A]/20 text-[#16866A] transition-colors cursor-pointer"
                    title={`Remove ${skill}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Card 3: Skills You Want to Learn */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#D5E9DF] space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#D5E9DF] pb-3">
            <h2 className="text-base font-bold text-[#164E41] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#16866A]" />
              <span>Skills You Want to Learn</span>
            </h2>
            <span className="text-[11px] text-[#527568]">
              {skillsLearn.length} skill{skillsLearn.length !== 1 ? 's' : ''} added (At least 1 required)
            </span>
          </div>

          <p className="text-xs text-[#527568] leading-relaxed">
            List the skills you are looking to master from peers on the platform (e.g. Figma, Machine Learning, Spanish).
          </p>

          {/* Add Skill Input */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Figma, Machine Learning, UI/UX Design..."
              value={learnInput}
              onChange={(e) => setLearnInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddLearnSkill();
                }
              }}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A]"
            />
            <button
              type="button"
              onClick={handleAddLearnSkill}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#16866A] hover:bg-[#0F7058] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>

          {/* Skills Badges */}
          <div className="flex flex-wrap gap-2 pt-1 min-h-[40px]">
            {skillsLearn.length === 0 ? (
              <span className="text-xs text-[#527568]/70 italic">
                No learning skills added yet. Add at least one skill.
              </span>
            ) : (
              skillsLearn.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F1FAF5] border border-[#D5E9DF] text-[#164E41] text-xs font-semibold shadow-xs"
                >
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveLearnSkill(skill)}
                    className="p-0.5 rounded-full hover:bg-[#164E41]/10 text-[#527568] hover:text-[#164E41] transition-colors cursor-pointer"
                    title={`Remove ${skill}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl text-xs font-bold text-white bg-[#16866A] hover:bg-[#0F7058] shadow-md shadow-[#16866A]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Update Profile</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* DANGER ZONE: Account Deletion (At the very bottom of the profile settings) */}
      <div className="mt-8 pt-6 border-t border-rose-200">
        <div className="p-6 rounded-3xl bg-rose-50/60 border border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Danger Zone • Delete Account</span>
            </h3>
            <p className="text-xs text-[#527568] max-w-xl">
              Permanently delete your SkillBridge account, profile, skill listings, connection requests, and messages. This action is irreversible.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              resetDeleteModal();
              setDeleteModalOpen(true);
            }}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-100 hover:bg-rose-200 border border-rose-300 transition-colors flex items-center gap-2 shrink-0 cursor-pointer shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Account</span>
          </button>
        </div>
      </div>

      {/* Confirmation Dialog Modal with Multi-Step Password & Gmail OTP Verification Flow */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#164E41]/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-rose-200 max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={() => {
                if (!deletingAccount && !verifyingPassword && !verifyingDeleteOtp) {
                  resetDeleteModal();
                }
              }}
              disabled={deletingAccount || verifyingPassword || verifyingDeleteOtp}
              className="absolute top-5 right-5 p-2 rounded-full text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] transition-colors disabled:opacity-50"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Error Message banner */}
            {deleteError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{deleteError}</span>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* STEP 2: PASSWORD VERIFICATION (Normal Flow)                   */}
            {/* ------------------------------------------------------------- */}
            {deleteStep === 2 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#164E41]">Delete Account</h3>
                    <p className="text-xs text-[#527568] font-medium">Verify your password to proceed</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 mb-4 text-xs text-rose-800">
                  <p className="font-semibold text-rose-800">Warning: Deleting your account is permanent.</p>
                  <p className="text-[#527568] mt-1">Please enter your current account password to confirm ownership.</p>
                </div>

                <div className="space-y-3 mb-6">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-[#164E41] flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Current Password *</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteStep('otp');
                          setDeleteError('');
                        }}
                        className="text-[11px] text-[#16866A] hover:underline cursor-pointer font-medium"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type={showDeletePassword ? 'text' : 'password'}
                        placeholder="Enter your current password"
                        value={deletePassword}
                        onChange={(e) => {
                          setDeletePassword(e.target.value);
                          setDeleteError('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleVerifyPassword();
                          }
                        }}
                        disabled={verifyingPassword}
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A] disabled:opacity-60"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowDeletePassword(!showDeletePassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#527568] hover:text-[#164E41]"
                      >
                        {showDeletePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={resetDeleteModal}
                    disabled={verifyingPassword}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] border border-[#D5E9DF] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={verifyingPassword || !deletePassword.trim()}
                    onClick={handleVerifyPassword}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {verifyingPassword ? (
                      <>
                        <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Continue</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* STEP 2B: FORGOT PASSWORD INSIDE DELETE ACCOUNT (Gmail OTP)    */}
            {/* ------------------------------------------------------------- */}
            {deleteStep === 'otp' && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#E4F6EE] text-[#16866A] border border-[#D5E9DF] flex items-center justify-center shrink-0">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#164E41]">Verify via Linked Gmail</h3>
                    <p className="text-xs text-[#16866A] font-medium">Forgot Password • Ownership Verification</p>
                  </div>
                </div>

                {/* Masked linked Gmail display */}
                <div className="p-4 rounded-2xl bg-[#F1FAF5] border border-[#D5E9DF] mb-4 text-center sm:text-left space-y-1.5">
                  <p className="text-xs text-[#527568]">
                    {deleteOtpSent
                      ? 'OTP was sent to your registered email:'
                      : 'OTP will be sent to your registered email:'}
                  </p>
                  <p className="text-sm font-mono font-bold text-[#16866A] bg-[#E4F6EE] py-1.5 px-3 rounded-xl border border-[#A8E6CF] inline-block tracking-wider">
                    {maskEmail(user?.email || serverMaskedEmail) || 'your registered email'}
                  </p>
                </div>

                {/* Send OTP button (before sending) */}
                {!deleteOtpSent && (
                  <div className="mb-4">
                    <button
                      type="button"
                      disabled={sendingDeleteOtp}
                      onClick={handleSendDeleteOtp}
                      className="w-full py-3 rounded-xl text-xs font-bold text-white bg-[#16866A] hover:bg-[#0F7058] shadow-md shadow-[#16866A]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {sendingDeleteOtp ? (
                        <>
                          <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                          <span>Sending OTP...</span>
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4" />
                          <span>Send OTP</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* OTP Flow (After Send OTP succeeds) */}
                {deleteOtpSent && (
                  <div className="space-y-4 mb-4 animate-in fade-in duration-200">
                    <div>
                      <label htmlFor="delete-account-otp-input" className="block text-xs font-semibold text-[#164E41] mb-1.5">
                        Enter OTP
                      </label>
                      <input
                        id="delete-account-otp-input"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]*"
                        maxLength={6}
                        placeholder="6-digit OTP"
                        value={deleteOtp}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                          setDeleteOtp(val);
                          setDeleteError('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && deleteOtp.trim().length === 6) {
                            e.preventDefault();
                            handleVerifyDeleteOtp();
                          }
                        }}
                        disabled={verifyingDeleteOtp || deleteOtpVerified}
                        className="w-full px-4 py-3 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-base sm:text-lg font-mono tracking-[0.3em] text-center focus:outline-none focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A] transition-all disabled:opacity-60"
                        autoFocus
                      />
                    </div>

                    {!deleteOtpVerified && (
                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <button
                          type="button"
                          disabled={verifyingDeleteOtp || deleteOtp.trim().length < 6}
                          onClick={handleVerifyDeleteOtp}
                          className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#16866A] hover:bg-[#0F7058] shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                        >
                          {verifyingDeleteOtp ? (
                            <>
                              <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                              <span>Verifying...</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Verify OTP</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={sendingDeleteOtp || deleteCooldown > 0}
                          onClick={handleSendDeleteOtp}
                          className="py-2.5 px-4 rounded-xl text-xs font-semibold text-[#527568] hover:text-[#164E41] bg-[#F1FAF5] hover:bg-[#E4F6EE] border border-[#D5E9DF] transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                        >
                          {sendingDeleteOtp ? (
                            <span className="animate-spin w-3.5 h-3.5 border-2 border-[#16866A] border-t-transparent rounded-full" />
                          ) : (
                            <RotateCw className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {deleteCooldown > 0 ? `Resend in ${deleteCooldown}s` : 'Resend OTP'}
                          </span>
                        </button>
                      </div>
                    )}

                    {/* Correct OTP -> Email verified badge and continue */}
                    {deleteOtpVerified && (
                      <div className="p-3.5 rounded-xl bg-[#E4F6EE] border border-[#A8E6CF] text-[#16866A] text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[#16866A] shrink-0" />
                          <span>Email verified</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteStep(3);
                            setDeleteError('');
                          }}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#16866A] hover:bg-[#0F7058] shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <span>Continue</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-[#D5E9DF]">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteStep(2);
                      setDeleteError('');
                    }}
                    className="text-xs text-[#527568] hover:text-[#164E41] transition-colors cursor-pointer"
                  >
                    ← Verify with password instead
                  </button>

                  <button
                    type="button"
                    onClick={resetDeleteModal}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] border border-[#D5E9DF] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* STEP 3: FINAL CONFIRMATION (Cancel / Permanently Delete)      */}
            {/* ------------------------------------------------------------- */}
            {deleteStep === 3 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                    <Trash2 className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#164E41]">Final Confirmation</h3>
                    <p className="text-xs text-rose-600 font-semibold">Permanently Delete Account</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 mb-6 text-xs text-rose-800 leading-relaxed space-y-2">
                  <p className="font-extrabold text-[#164E41] text-sm">
                    Are you sure you want to permanently delete your account?
                  </p>
                  <p className="font-semibold text-rose-700">
                    This action is permanent and cannot be undone.
                  </p>
                  <p className="text-[#527568]">
                    All your skills, chat history, connection requests, profile details, and account credentials will be permanently erased immediately.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={resetDeleteModal}
                    disabled={deletingAccount}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] border border-[#D5E9DF] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={deletingAccount}
                    onClick={handleFinalPermanentlyDelete}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {deletingAccount ? (
                      <>
                        <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Permanently Delete</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
