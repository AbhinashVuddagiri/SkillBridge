import React, { useState } from 'react';
import { X, Star, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import confetti from 'canvas-confetti';

export default function ReviewModal({ exchange, onClose, onReviewSubmitted }) {
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!exchange) return null;

  const partner = exchange.isSender ? exchange.receiver : exchange.sender;
  const partnerSkill = exchange.isSender ? exchange.skillRequested : exchange.skillOffered;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) {
      setError('Please provide feedback about what you learned and your partner’s teaching.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.submitReview({
        exchangeId: exchange.id,
        rating,
        comment: comment.trim(),
        skillEvaluated: partnerSkill
      });

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });

      setSuccess(true);
      if (onReviewSubmitted) onReviewSubmitted();
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to submit review.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#164E41]/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#D5E9DF]">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {success ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#E4F6EE] border border-[#A8E6CF] flex items-center justify-center text-[#16866A]">
              <CheckCircle className="w-10 h-10 animate-bounce text-[#16866A]" />
            </div>
            <h3 className="text-xl font-bold text-[#164E41]">Review Published! ⭐</h3>
            <p className="text-xs text-[#527568]">
              Thank you for supporting community trust and recognizing your peer partner.
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#E4F6EE] text-[#16866A] mb-2 border border-[#D5E9DF]">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[#164E41]">Rate Skill Exchange</h3>
              <p className="text-xs text-[#527568] mt-1">
                How was your peer learning experience with {partner?.name}?
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Star Rating */}
              <div className="flex flex-col items-center gap-1.5 py-2">
                <span className="text-xs font-semibold text-[#164E41]">
                  Rating for {partnerSkill}:
                </span>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 transition-transform hover:scale-125 cursor-pointer"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          (hoverRating || rating) >= star
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-[#C8DFD3]'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Written review */}
              <div>
                <label className="block text-xs font-semibold text-[#164E41] mb-1">
                  Written Feedback & Testimonial
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder={`Describe how ${partner?.name} helped you learn ${partnerSkill}, their teaching style, and any helpful projects you tackled.`}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-xs text-white bg-[#16866A] hover:bg-[#0F7058] shadow-md shadow-[#16866A]/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                {loading ? (
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <span>Submit Verified Review</span>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
