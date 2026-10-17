import express from 'express';
import { db } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

// POST /api/moderation/report - Submit safety report
router.post('/report', authRequired, (req, res) => {
  const { reportedUserId, reason, details } = req.body;
  const reporterId = req.user.id;

  if (!reportedUserId || !reason) {
    return res.status(400).json({ error: 'Reported user ID and reason are required.' });
  }

  const reportedUser = db.users.find(u => u.id === reportedUserId);
  if (!reportedUser) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const newReport = {
    id: `rep_${Date.now()}`,
    reporterId,
    reportedUserId,
    reason,
    details: details || '',
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  db.reports.push(newReport);
  db.saveData();

  res.status(201).json({
    success: true,
    message: 'Report submitted safely to SkillBridge moderation team for review.'
  });
});

// POST /api/moderation/block - Block a user
router.post('/block', authRequired, (req, res) => {
  const { userIdToBlock } = req.body;
  const currentUser = db.users.find(u => u.id === req.user.id);

  if (!userIdToBlock) {
    return res.status(400).json({ error: 'User ID to block is required.' });
  }

  if (!currentUser.blockedUsers) currentUser.blockedUsers = [];
  if (!currentUser.blockedUsers.includes(userIdToBlock)) {
    currentUser.blockedUsers.push(userIdToBlock);
    db.saveData();
  }

  res.json({
    success: true,
    message: 'User blocked. They will no longer appear in your searches or be able to send proposals.'
  });
});

// GET /api/moderation/reports - Admin only view reports
router.get('/reports', authRequired, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const enriched = db.reports.map(r => {
    const reporter = db.users.find(u => u.id === r.reporterId);
    const reported = db.users.find(u => u.id === r.reportedUserId);
    return {
      ...r,
      reporterName: reporter?.name || 'Anonymous',
      reportedName: reported?.name || 'Unknown'
    };
  });

  res.json({ reports: enriched });
});

// PUT /api/moderation/reports/:id/resolve - Admin resolve
router.put('/reports/:id/resolve', authRequired, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const report = db.reports.find(r => r.id === req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  report.status = req.body.status || 'resolved';
  db.saveData();

  res.json({ success: true, report });
});

export default router;
