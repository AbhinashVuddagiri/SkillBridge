import express from 'express';
import { db } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

// GET /api/reviews/user/:userId
router.get('/user/:userId', (req, res) => {
  const reviews = db.reviews
    .filter(r => r.revieweeId === req.params.userId)
    .map(r => {
      const reviewer = db.users.find(u => u.id === r.reviewerId);
      return {
        ...r,
        reviewerName: reviewer ? reviewer.name : 'SkillBridge Student',
        reviewerAvatar: reviewer ? reviewer.avatar : null,
        reviewerCollege: reviewer ? reviewer.college : null
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ reviews });
});

// POST /api/reviews - Submit review after exchange
router.post('/', authRequired, (req, res) => {
  try {
    const { exchangeId, rating, comment, skillEvaluated } = req.body;
    const reviewerId = req.user.id;

    if (!exchangeId || !rating || !comment) {
      return res.status(400).json({ error: 'Exchange ID, rating, and written review are required.' });
    }

    const numRating = Number(rating);
    if (numRating < 1 || numRating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5 stars.' });
    }

    const exc = db.exchanges.find(e => e.id === exchangeId);
    if (!exc) {
      return res.status(404).json({ error: 'Referenced exchange not found.' });
    }

    if (exc.senderId !== reviewerId && exc.receiverId !== reviewerId) {
      return res.status(403).json({ error: 'You were not a participant in this exchange.' });
    }

    // Only allow reviews once per reviewer per exchange
    const existing = db.reviews.find(r => r.exchangeId === exchangeId && r.reviewerId === reviewerId);
    if (existing) {
      return res.status(400).json({ error: 'You have already reviewed your partner for this exchange.' });
    }

    const revieweeId = exc.senderId === reviewerId ? exc.receiverId : exc.senderId;
    const reviewee = db.users.find(u => u.id === revieweeId);
    if (!reviewee) {
      return res.status(404).json({ error: 'Reviewee not found.' });
    }

    const newReview = {
      id: `rev_${Date.now()}`,
      exchangeId,
      reviewerId,
      revieweeId,
      rating: numRating,
      comment: comment.trim(),
      skillEvaluated: skillEvaluated || (exc.senderId === reviewerId ? exc.skillRequested : exc.skillOffered),
      createdAt: new Date().toISOString()
    };

    db.reviews.push(newReview);

    // Recalculate reviewee rating and count
    const allReviewsForReviewee = db.reviews.filter(r => r.revieweeId === revieweeId);
    const sum = allReviewsForReviewee.reduce((acc, r) => acc + r.rating, 0);
    reviewee.rating = Number((sum / allReviewsForReviewee.length).toFixed(1));
    reviewee.reviewCount = allReviewsForReviewee.length;

    // Check Community Mentor badge
    if (reviewee.rating >= 4.8 && reviewee.reviewCount >= 5) {
      if (!reviewee.badges.some(b => b.id === 'b_community_mentor')) {
        reviewee.badges.push({
          id: 'b_community_mentor',
          name: 'Community Mentor',
          icon: 'Award',
          desc: 'Achieved average 4.8+ rating across 5+ verified reviews',
          unlockedAt: new Date().toISOString()
        });
      }
    }

    // Notify reviewee
    db.notifications.push({
      id: `notif_${Date.now()}`,
      userId: revieweeId,
      title: 'New Review Received! ⭐',
      message: `${req.user.name} gave you a ${numRating}-star review for ${newReview.skillEvaluated}!`,
      type: 'credit_received',
      link: `/profile/${revieweeId}`,
      read: false,
      createdAt: new Date().toISOString()
    });

    db.saveData();

    res.status(201).json({
      success: true,
      review: newReview,
      updatedRating: reviewee.rating
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit review: ' + err.message });
  }
});

export default router;
