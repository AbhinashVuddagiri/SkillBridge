import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function ReportModal() {
  const { activeReportUser, setActiveReportUser } = useAuth();
  const [reason, setReason] = useState('Inappropriate behavior or language');
  const [details, setDetails] = useState('');
  const [blockUserToo, setBlockUserToo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!activeReportUser) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.reportUser({
        reportedUserId: activeReportUser.id,
        reason,
        details
      });

      if (blockUserToo) {
        await api.blockUser(activeReportUser.id);
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setActiveReportUser(null);
      }, 1600);
    } catch (err) {
      setError(err.message || 'Failed to submit report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-md glass-panel rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/20">
        <button
          onClick={() => setActiveReportUser(null)}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        {success ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#10b981]/20 border border-[#10b981]/40 flex items-center justify-center text-[#10b981]">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-white">Report Submitted</h3>
            <p className="text-xs text-slate-300">
              Our safety team has received your report. {blockUserToo && 'This user has also been blocked from interacting with you.'}
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 mb-2 border border-rose-500/40">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Trust & Safety Report</h3>
              <p className="text-xs text-slate-400 mt-1">
                Report <span className="text-white font-semibold">{activeReportUser.name}</span> for community guideline violations.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Violation Reason</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-xs focus:outline-none focus:border-rose-500"
                >
                  <option value="Inappropriate behavior or language">Inappropriate behavior or language</option>
                  <option value="Spam or commercial solicitations">Spam or commercial solicitations</option>
                  <option value="Asking for money or external payments">Asking for money or external payments (Violates zero-money policy)</option>
                  <option value="No-show or repeated ghosting">Repeated ghosting / no-shows</option>
                  <option value="Fake or impersonated profile">Fake or impersonated profile</option>
                  <option value="Harassment or hate speech">Harassment or hate speech</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Additional Context</label>
                <textarea
                  rows={3}
                  placeholder="Provide specific details to help our safety moderators investigate..."
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-white text-xs focus:outline-none focus:border-rose-500"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={blockUserToo}
                  onChange={(e) => setBlockUserToo(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-500 focus:ring-rose-500"
                />
                <span>Also block this user from contacting me</span>
              </label>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveReportUser(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs text-white bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-600/25"
                >
                  {loading ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
