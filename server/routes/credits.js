import express from 'express';
import { db } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

// GET /api/credits/history - Get transaction history and summary
router.get('/history', authRequired, (req, res) => {
  const userId = req.user.id;
  const user = db.users.find(u => u.id === userId);

  const txs = db.creditTransactions
    .filter(t => t.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const totalEarned = txs.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
  const totalSpent = txs.filter(t => t.amount < 0).reduce((acc, t) => acc + Math.abs(t.amount), 0);

  res.json({
    balance: user?.credits || 0,
    totalEarned,
    totalSpent,
    transactions: txs
  });
});

// POST /api/credits/spend - Spend credits for an open request or bonus perk
router.post('/spend', authRequired, (req, res) => {
  const { amount, description, perkType } = req.body;
  const num = Number(amount);
  const user = db.users.find(u => u.id === req.user.id);

  if (!num || num <= 0) {
    return res.status(400).json({ error: 'Valid amount is required.' });
  }

  if ((user.credits || 0) < num) {
    return res.status(400).json({ error: `Insufficient credits. You have ${user.credits || 0} credits.` });
  }

  user.credits -= num;

  const tx = {
    id: `ctx_${Date.now()}`,
    userId: user.id,
    amount: -num,
    type: perkType || 'session_learned',
    description: description || 'Redeemed skill credits for prioritized mentorship',
    createdAt: new Date().toISOString()
  };

  db.creditTransactions.push(tx);
  db.saveData();

  res.json({
    success: true,
    newBalance: user.credits,
    transaction: tx
  });
});

export default router;
