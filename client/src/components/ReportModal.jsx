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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#164E41]/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#D5E9DF]">
        <button
          onClick={() => setActiveReportUser(null)}
          className="absolute top-5 right-5 p-2 rounded-full text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {success ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#E4F6EE] border border-[#A8E6CF] flex items-center justify-center text-[#16866A]">
              <CheckCircle className="w-10 h-10 text-[#16866A]" />
            </div>
            <h3 className="text-xl font-bold text-[#164E41]">Report Submitted</h3>
            <p className="text-xs text-[#527568]">
              Our safety team has received your report. {blockUserToo && 'This user has also been blocked from interacting with you.'}
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 mb-2 border border-rose-200">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[#164E41]">Trust & Safety Report</h3>
              <p className="text-xs text-[#527568] mt-1">
                Report <span className="text-[#164E41] font-semibold">{activeReportUser.name}</span> for community guideline violations.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#164E41] mb-1">Violation Reason</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] text-xs focus:outline-none focus:border-rose-500"
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
                <label className="block text-xs font-semibold text-[#164E41] mb-1">Additional Context</label>
                <textarea
                  rows={3}
                  placeholder="Provide specific details to help our safety moderators investigate..."
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:border-rose-500"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-[#527568] cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={blockUserToo}
                  onChange={(e) => setBlockUserToo(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-[#C8DFD3]"
                />
                <span>Also block this user from contacting me</span>
              </label>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveReportUser(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] border border-[#D5E9DF] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs text-white bg-rose-600 hover:bg-rose-700 shadow-md transition-colors cursor-pointer"
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
