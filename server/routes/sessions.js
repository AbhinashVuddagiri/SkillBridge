import express from 'express';
import { db } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

// GET /api/sessions - User sessions
router.get('/', authRequired, (req, res) => {
  const userId = req.user.id;
  const userSessions = db.sessions.filter(s => s.hostId === userId || s.participantId === userId);

  const populated = userSessions.map(ses => {
    const host = db.users.find(u => u.id === ses.hostId);
    const participant = db.users.find(u => u.id === ses.participantId);
    const isHost = ses.hostId === userId;
    const partner = isHost ? participant : host;
    const exchange = ses.exchangeId ? db.exchanges.find(e => e.id === ses.exchangeId) : null;

    return {
      ...ses,
      isHost,
      host: sanitizeUser(host),
      participant: sanitizeUser(participant),
      partner: sanitizeUser(partner),
      exchange
    };
  });

  populated.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

  res.json({
    upcoming: populated.filter(s => s.status === 'scheduled' && new Date(s.scheduledAt) >= new Date()),
    past: populated.filter(s => s.status === 'completed' || new Date(s.scheduledAt) < new Date()),
    all: populated
  });
});

// POST /api/sessions - Schedule session
router.post('/', authRequired, (req, res) => {
  try {
    const { exchangeId, participantId, title, skillTaught, scheduledAt, durationMinutes, meetingLink } = req.body;
    const hostId = req.user.id;

    if (!title || !scheduledAt) {
      return res.status(400).json({ error: 'Title and scheduled time are required.' });
    }

    let targetParticipantId = participantId;
    if (exchangeId) {
      const exc = db.exchanges.find(e => e.id === exchangeId);
      if (exc) {
        targetParticipantId = exc.senderId === hostId ? exc.receiverId : exc.senderId;
      }
    }

    if (!targetParticipantId) {
      return res.status(400).json({ error: 'Participant ID is required.' });
    }

    const newSession = {
      id: `ses_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      exchangeId: exchangeId || null,
      hostId,
      participantId: targetParticipantId,
      title: title.trim(),
      skillTaught: (skillTaught || 'Peer Learning').trim(),
      scheduledAt: new Date(scheduledAt).toISOString(),
      durationMinutes: Number(durationMinutes) || 60,
      status: 'scheduled',
      meetingLink: meetingLink || `https://meet.jit.si/skillbridge-${Date.now()}`
    };

    db.sessions.push(newSession);

    // Notify participant
    db.notifications.push({
      id: `notif_${Date.now()}`,
      userId: targetParticipantId,
      title: 'New Session Scheduled 📅',
      message: `${req.user.name} scheduled '${title}' on ${new Date(scheduledAt).toLocaleDateString()} at ${new Date(scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
      type: 'session_reminder',
      link: '/sessions',
      read: false,
      createdAt: new Date().toISOString()
    });

    db.saveData();
    res.status(201).json({ session: newSession });
  } catch (err) {
    res.status(500).json({ error: 'Failed to schedule session: ' + err.message });
  }
});

// PUT /api/sessions/:id - Update session
router.put('/:id', authRequired, (req, res) => {
  const ses = db.sessions.find(s => s.id === req.params.id);
  if (!ses) return res.status(404).json({ error: 'Session not found.' });

  const userId = req.user.id;
  if (ses.hostId !== userId && ses.participantId !== userId && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized.' });
  }

  const { status, scheduledAt, meetingLink, title } = req.body;
  if (status) ses.status = status;
  if (scheduledAt) ses.scheduledAt = new Date(scheduledAt).toISOString();
  if (meetingLink) ses.meetingLink = meetingLink;
  if (title) ses.title = title.trim();

  // If marked completed, award XP
  if (status === 'completed') {
    const host = db.users.find(u => u.id === ses.hostId);
    const participant = db.users.find(u => u.id === ses.participantId);
    if (host) host.xp = (host.xp || 0) + 150;
    if (participant) participant.xp = (participant.xp || 0) + 150;
  }

  db.saveData();
  res.json({ success: true, session: ses });
});

export default router;
