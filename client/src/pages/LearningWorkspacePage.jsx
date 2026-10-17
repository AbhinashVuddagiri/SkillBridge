import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  CheckCircle,
  Video,
  FileText,
  Link2,
  Calendar,
  Save,
  Award,
  ArrowLeft,
  Plus,
  Trash2,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import confetti from 'canvas-confetti';
import ReviewModal from '../components/ReviewModal';

export default function LearningWorkspacePage({ exchangeId, setCurrentView }) {
  const { user, refreshUser } = useAuth();
  const [exchange, setExchange] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingNotes, setSavingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [checklist, setChecklist] = useState([]);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [resourceLinks, setResourceLinks] = useState([]);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [successBanner, setSuccessBanner] = useState('');

  const loadExchange = async () => {
    try {
      const res = await api.getExchange(exchangeId);
      if (res?.exchange) {
        setExchange(res.exchange);
        setNotes(res.exchange.workspace?.notes || '');
        setChecklist(res.exchange.workspace?.progressChecklist || []);
        setResourceLinks(res.exchange.workspace?.resourceLinks || []);
      }
    } catch (err) {
      console.error('Error loading workspace:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExchange();
  }, [exchangeId]);

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await api.updateWorkspace(exchangeId, { notes });
      setSuccessBanner('Notes saved successfully!');
      setTimeout(() => setSuccessBanner(''), 2000);
    } catch (err) {
      alert('Failed to save notes: ' + err.message);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleToggleChecklist = async (checkId) => {
    const updated = checklist.map(item =>
      item.id === checkId ? { ...item, completed: !item.completed } : item
    );
    setChecklist(updated);
    await api.updateWorkspace(exchangeId, { progressChecklist: updated });
  };

  const handleAddChecklist = async (e) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;
    const newItem = {
      id: `chk_${Date.now()}`,
      text: newChecklistText.trim(),
      completed: false
    };
    const updated = [...checklist, newItem];
    setChecklist(updated);
    setNewChecklistText('');
    await api.updateWorkspace(exchangeId, { progressChecklist: updated });
  };

  const handleDeleteChecklist = async (checkId) => {
    const updated = checklist.filter(c => c.id !== checkId);
    setChecklist(updated);
    await api.updateWorkspace(exchangeId, { progressChecklist: updated });
  };

  const handleAddLink = async (e) => {
    e.preventDefault();
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;
    const newLink = {
      title: newLinkTitle.trim(),
      url: newLinkUrl.trim().startsWith('http') ? newLinkUrl.trim() : `https://${newLinkUrl.trim()}`
    };
    const updated = [...resourceLinks, newLink];
    setResourceLinks(updated);
    setNewLinkTitle('');
    setNewLinkUrl('');
    await api.updateWorkspace(exchangeId, { resourceLinks: updated });
  };

  const handleConfirmCompletion = async () => {
    try {
      const res = await api.confirmCompletion(exchangeId);
      if (res.bothCompleted) {
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 }
        });
        setSuccessBanner('Exchange 100% Completed! +25 Credits & +300 XP awarded to both partners!');
        setReviewModalOpen(true);
      } else {
        setSuccessBanner('Your completion confirmed! Waiting for partner to confirm their side.');
      }
      await loadExchange();
      await refreshUser();
    } catch (err) {
      alert(err.message || 'Failed to confirm completion');
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="w-10 h-10 border-2 border-[#7657ff] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-400">Loading learning workspace...</p>
      </div>
    );
  }

  if (!exchange) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-4">
        <p className="text-white">Workspace not found.</p>
        <button
          onClick={() => setCurrentView('dashboard')}
          className="text-xs text-[#39d5f6] hover:underline"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const partner = exchange.partner;
  const isSender = exchange.isSender;
  const userConfirmed = isSender
    ? exchange.workspace?.senderConfirmed
    : exchange.workspace?.receiverConfirmed;
  const partnerConfirmed = isSender
    ? exchange.workspace?.receiverConfirmed
    : exchange.workspace?.senderConfirmed;

  const meetingLink = `https://meet.jit.si/skillbridge-${exchange.id}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentView('dashboard')}
          className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
        <div className="flex items-center gap-2">
          {exchange.conversationId && (
            <button
              onClick={() => setCurrentView(`messages_${exchange.conversationId}`)}
              className="px-3.5 py-1.5 rounded-xl glass-card text-xs font-bold text-slate-200 hover:text-white flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#39d5f6]" />
              <span>Chat with {partner?.name.split(' ')[0]}</span>
            </button>
          )}
          <a
            href={meetingLink}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#10b981] to-[#39d5f6] hover:opacity-95 shadow-md flex items-center gap-1.5"
          >
            <Video className="w-4 h-4" />
            <span>Launch Video Call</span>
          </a>
        </div>
      </div>

      {successBanner && (
        <div className="p-4 rounded-2xl bg-[#10b981]/20 border border-[#10b981]/40 text-[#10b981] text-xs font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Header Workspace Banner */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/15 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#39d5f6]">
                Dedicated Learning Workspace
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  exchange.status === 'completed'
                    ? 'bg-[#10b981]/20 text-[#10b981]'
                    : 'bg-[#7657ff]/20 text-[#b7a4ff]'
                }`}
              >
                {exchange.status === 'completed' ? 'Completed' : 'Active Exchange'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              {exchange.skillOffered} <span className="text-[#39d5f6]">⇄</span> {exchange.skillRequested}
            </h1>

            <p className="text-xs text-slate-300">
              Exchange between <strong className="text-white">{exchange.sender?.name}</strong> and{' '}
              <strong className="text-white">{exchange.receiver?.name}</strong>
            </p>
          </div>

          {/* Mutual Completion Status & Confirmation */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 shrink-0 min-w-[280px]">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Completion Verification</span>
            </h4>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Your Confirmation:</span>
                <span className={`font-bold ${userConfirmed ? 'text-[#10b981]' : 'text-amber-400'}`}>
                  {userConfirmed ? '✓ Confirmed' : 'Pending'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Partner Confirmation:</span>
                <span className={`font-bold ${partnerConfirmed ? 'text-[#10b981]' : 'text-amber-400'}`}>
                  {partnerConfirmed ? '✓ Confirmed' : 'Pending'}
                </span>
              </div>
            </div>

            {!userConfirmed ? (
              <button
                onClick={handleConfirmCompletion}
                className="w-full py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7657ff] to-[#39d5f6] hover:opacity-95 shadow-md shadow-[#7657ff]/25"
              >
                Confirm I Completed Sessions
              </button>
            ) : exchange.status === 'completed' ? (
              <button
                onClick={() => setReviewModalOpen(true)}
                className="w-full py-2 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30"
              >
                ★ Rate & Review Partner
              </button>
            ) : (
              <p className="text-[10px] text-center text-slate-400 italic">
                Awaiting partner confirmation to finalize.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Shared Notes & Objectives Checklist (7 Cols) */}
        <div className="lg:col-span-7 space-y-8">
          {/* Progress Checklist */}
          <div className="glass-card rounded-3xl p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#10b981]" />
                <h3 className="text-base font-bold text-white">Milestone Checklist</h3>
              </div>
              <span className="text-xs text-slate-400">
                {checklist.filter(c => c.completed).length} of {checklist.length} done
              </span>
            </div>

            <div className="space-y-2">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between gap-3 group"
                >
                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => handleToggleChecklist(item.id)}
                      className="w-4 h-4 rounded text-[#7657ff] focus:ring-[#7657ff]"
                    />
                    <span
                      className={`text-xs ${
                        item.completed ? 'line-through text-slate-500' : 'text-slate-200'
                      }`}
                    >
                      {item.text}
                    </span>
                  </label>
                  <button
                    onClick={() => handleDeleteChecklist(item.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddChecklist} className="flex gap-2 pt-2">
              <input
                type="text"
                placeholder="Add session milestone or learning goal..."
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                className="flex-1 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#7657ff]"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#7657ff] hover:bg-[#7657ff]/90 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </form>
          </div>

          {/* Shared Session Notes */}
          <div className="glass-card rounded-3xl p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#7657ff]" />
                <h3 className="text-base font-bold text-white">Shared Workspace Notes</h3>
              </div>
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7657ff] to-[#39d5f6] hover:opacity-95 shadow-sm flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingNotes ? 'Saving...' : 'Save Notes'}</span>
              </button>
            </div>

            <textarea
              rows={8}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record takeaways, code snippets, project links, questions, and action items discussed during your peer exchange sessions..."
              className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-200 placeholder-slate-500 font-mono leading-relaxed focus:outline-none focus:border-[#7657ff]"
            />
          </div>
        </div>

        {/* Right Column: Resource Links & Exchange Overview (5 Cols) */}
        <div className="lg:col-span-5 space-y-8">
          {/* Resource Links */}
          <div className="glass-card rounded-3xl p-6 sm:p-7 space-y-4">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#39d5f6]" />
              <h3 className="text-base font-bold text-white">Shared Learning Resources</h3>
            </div>

            <div className="space-y-2">
              {resourceLinks.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">
                  No resources added yet. Add GitHub repos, Figma files, documentation, or tutorial links below.
                </p>
              ) : (
                resourceLinks.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs text-slate-200 hover:bg-white/10 transition-colors group"
                  >
                    <span className="font-semibold text-white group-hover:text-[#39d5f6] transition-colors truncate max-w-[220px]">
                      {link.title}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-white shrink-0" />
                  </a>
                ))
              )}
            </div>

            <form onSubmit={handleAddLink} className="space-y-2 pt-2 border-t border-white/5">
              <input
                type="text"
                placeholder="Resource Title (e.g. Figma Tokens File)"
                value={newLinkTitle}
                onChange={(e) => setNewLinkTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#39d5f6]"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="URL (https://...)"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  className="flex-1 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#39d5f6]"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#39d5f6]/20 border border-[#39d5f6]/30 text-[#39d5f6] hover:bg-[#39d5f6]/30"
                >
                  Add Link
                </button>
              </div>
            </form>
          </div>

          {/* Video Room Info Box */}
          <div className="glass-card rounded-3xl p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-[#10b981]" />
              <h4 className="text-xs font-bold text-white">Private Video Room</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Every accepted exchange gets an encrypted, zero-download peer meeting room powered by Jitsi Meet.
            </p>
            <a
              href={meetingLink}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-[#10b981] hover:bg-[#10b981]/90 flex items-center justify-center gap-2"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Enter Call Now</span>
            </a>
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {reviewModalOpen && (
        <ReviewModal
          exchange={exchange}
          onClose={() => setReviewModalOpen(false)}
          onReviewSubmitted={() => {
            loadExchange();
            refreshUser();
          }}
        />
      )}
    </div>
  );
}
