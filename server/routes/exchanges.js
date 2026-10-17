import express from 'express';
import { db } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

// GET /api/exchanges - Get current user exchanges
router.get('/', authRequired, (req, res) => {
  const userId = req.user.id;
  const userExchanges = db.exchanges.filter(e => e.senderId === userId || e.receiverId === userId);

  const populated = userExchanges.map(exc => {
    const sender = db.users.find(u => u.id === exc.senderId);
    const receiver = db.users.find(u => u.id === exc.receiverId);
    const isSender = exc.senderId === userId;
    const partner = isSender ? receiver : sender;

    return {
      ...exc,
      isSender,
      partner: sanitizeUser(partner),
      sender: sanitizeUser(sender),
      receiver: sanitizeUser(receiver)
    };
  });

  // Sort newest first
  populated.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  res.json({
    incoming: populated.filter(e => !e.isSender && e.status === 'pending'),
    sent: populated.filter(e => e.isSender && e.status === 'pending'),
    active: populated.filter(e => e.status === 'accepted'),
    completed: populated.filter(e => e.status === 'completed'),
    all: populated
  });
});

// GET /api/exchanges/:id
router.get('/:id', authRequired, (req, res) => {
  const exc = db.exchanges.find(e => e.id === req.params.id);
  if (!exc) return res.status(404).json({ error: 'Exchange not found.' });

  const userId = req.user.id;
  if (exc.senderId !== userId && exc.receiverId !== userId && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied to this exchange.' });
  }

  const sender = db.users.find(u => u.id === exc.senderId);
  const receiver = db.users.find(u => u.id === exc.receiverId);
  const partner = exc.senderId === userId ? receiver : sender;

  // Find linked conversation if exists
  const conv = db.conversations.find(c => c.exchangeId === exc.id);

  // Find linked sessions
  const sessions = db.sessions.filter(s => s.exchangeId === exc.id);

  res.json({
    exchange: {
      ...exc,
      isSender: exc.senderId === userId,
      partner: sanitizeUser(partner),
      sender: sanitizeUser(sender),
      receiver: sanitizeUser(receiver),
      conversationId: conv ? conv.id : null,
      sessions
    }
  });
});

// POST /api/exchanges - Propose a new exchange
router.post('/', authRequired, (req, res) => {
  try {
    const { receiverId, skillOffered, skillRequested, message, proposedSchedule } = req.body;
    const senderId = req.user.id;

    if (!receiverId || !skillOffered || !skillRequested) {
      return res.status(400).json({ error: 'Receiver, skill offered, and skill requested are required.' });
    }

    if (receiverId === senderId) {
      return res.status(400).json({ error: 'You cannot propose an exchange with yourself.' });
    }

    const receiver = db.users.find(u => u.id === receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'Partner not found.' });
    }

    // Check duplicate pending requests
    const existingPending = db.exchanges.find(e =>
      ((e.senderId === senderId && e.receiverId === receiverId) ||
       (e.senderId === receiverId && e.receiverId === senderId)) &&
      e.status === 'pending'
    );
    if (existingPending) {
      return res.status(400).json({ error: 'There is already an active pending request between you two.' });
    }

    const newExchange = {
      id: `exc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderId,
      receiverId,
      skillOffered: skillOffered.trim(),
      skillRequested: skillRequested.trim(),
      message: (message || '').trim() || `Hi! I would love to exchange skills: I will teach you ${skillOffered} in return for ${skillRequested}.`,
      proposedSchedule: (proposedSchedule || '').trim() || 'Flexible time slots',
      status: 'pending',
      workspace: {
        objectives: [
          `Exchange skills: ${req.user.name} teaches ${skillOffered}`,
          `Exchange skills: ${receiver.name} teaches ${skillRequested}`
        ],
        notes: '',
        progressChecklist: [
          { id: 'chk_init_1', text: 'Introductory alignment call and setup', completed: false },
          { id: 'chk_init_2', text: `First session: Focus on ${skillOffered}`, completed: false },
          { id: 'chk_init_3', text: `Second session: Focus on ${skillRequested}`, completed: false }
        ],
        resourceLinks: [],
        senderConfirmed: false,
        receiverConfirmed: false
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.exchanges.push(newExchange);

    // Notify receiver
    db.notifications.push({
      id: `notif_${Date.now()}`,
      userId: receiverId,
      title: 'New Skill Exchange Proposal! 💡',
      message: `${req.user.name} offered to teach you ${skillOffered} in exchange for ${skillRequested}.`,
      type: 'exchange_request',
      link: '/dashboard',
      read: false,
      createdAt: new Date().toISOString()
    });

    db.saveData();

    res.status(201).json({
      success: true,
      exchange: newExchange
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create exchange: ' + err.message });
  }
});

// PUT /api/exchanges/:id/status - Update status: accept, decline, withdraw, cancel
router.put('/:id/status', authRequired, (req, res) => {
  try {
    const { status } = req.body;
    const exc = db.exchanges.find(e => e.id === req.params.id);
    if (!exc) return res.status(404).json({ error: 'Exchange not found.' });

    const userId = req.user.id;
    const isSender = exc.senderId === userId;
    const isReceiver = exc.receiverId === userId;

    if (!isSender && !isReceiver && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to modify this exchange.' });
    }

    if (status === 'accepted') {
      if (!isReceiver) return res.status(403).json({ error: 'Only the recipient can accept this proposal.' });
      exc.status = 'accepted';
      exc.updatedAt = new Date().toISOString();

      // Create conversation if not exists
      let conv = db.conversations.find(c => c.exchangeId === exc.id);
      if (!conv) {
        conv = {
          id: `conv_${exc.senderId}_${exc.receiverId}`,
          exchangeId: exc.id,
          participantIds: [exc.senderId, exc.receiverId],
          messages: [
            {
              id: `msg_${Date.now()}`,
              senderId: userId,
              content: `Hello! I accepted your skill exchange proposal for ${exc.skillRequested} <-> ${exc.skillOffered}. Excited to learn together!`,
              type: 'text',
              createdAt: new Date().toISOString(),
              read: false
            }
          ]
        };
        db.conversations.push(conv);
      }

      // Notify sender
      db.notifications.push({
        id: `notif_${Date.now()}`,
        userId: exc.senderId,
        title: 'Exchange Proposal Accepted! 🎉',
        message: `${req.user.name} accepted your skill exchange for ${exc.skillOffered} & ${exc.skillRequested}!`,
        type: 'exchange_accepted',
        link: `/workspace/${exc.id}`,
        read: false,
        createdAt: new Date().toISOString()
      });

    } else if (status === 'declined') {
      if (!isReceiver) return res.status(403).json({ error: 'Only recipient can decline.' });
      exc.status = 'declined';
      exc.updatedAt = new Date().toISOString();

    } else if (status === 'withdrawn') {
      if (!isSender) return res.status(403).json({ error: 'Only sender can withdraw.' });
      exc.status = 'withdrawn';
      exc.updatedAt = new Date().toISOString();

    } else if (status === 'cancelled') {
      exc.status = 'cancelled';
      exc.updatedAt = new Date().toISOString();
    } else {
      return res.status(400).json({ error: 'Invalid status update.' });
    }

    db.saveData();
    res.json({ success: true, exchange: exc });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update exchange status: ' + err.message });
  }
});

// PUT /api/exchanges/:id/workspace - Update workspace notes, objectives, checklist, links
router.put('/:id/workspace', authRequired, (req, res) => {
  const exc = db.exchanges.find(e => e.id === req.params.id);
  if (!exc) return res.status(404).json({ error: 'Exchange not found.' });

  const userId = req.user.id;
  if (exc.senderId !== userId && exc.receiverId !== userId) {
    return res.status(403).json({ error: 'Unauthorized.' });
  }

  const { objectives, notes, progressChecklist, resourceLinks } = req.body;
  if (!exc.workspace) exc.workspace = {};

  if (objectives !== undefined) exc.workspace.objectives = objectives;
  if (notes !== undefined) exc.workspace.notes = notes;
  if (progressChecklist !== undefined) exc.workspace.progressChecklist = progressChecklist;
  if (resourceLinks !== undefined) exc.workspace.resourceLinks = resourceLinks;

  exc.updatedAt = new Date().toISOString();
  db.saveData();

  res.json({ success: true, workspace: exc.workspace });
});

// POST /api/exchanges/:id/confirm-completion - Confirm completion from one participant
router.post('/:id/confirm-completion', authRequired, (req, res) => {
  const exc = db.exchanges.find(e => e.id === req.params.id);
  if (!exc) return res.status(404).json({ error: 'Exchange not found.' });

  const userId = req.user.id;
  if (exc.senderId !== userId && exc.receiverId !== userId) {
    return res.status(403).json({ error: 'Unauthorized.' });
  }

  if (!exc.workspace) exc.workspace = {};

  if (exc.senderId === userId) {
    exc.workspace.senderConfirmed = true;
  } else {
    exc.workspace.receiverConfirmed = true;
  }

  let bothCompleted = false;
  if (exc.workspace.senderConfirmed && exc.workspace.receiverConfirmed) {
    exc.status = 'completed';
    bothCompleted = true;

    // Award rewards to both users
    const u1 = db.users.find(u => u.id === exc.senderId);
    const u2 = db.users.find(u => u.id === exc.receiverId);

    [u1, u2].forEach(u => {
      if (u) {
        u.completedExchanges = (u.completedExchanges || 0) + 1;
        u.credits = (u.credits || 0) + 25;
        u.xp = (u.xp || 0) + 300;
        u.streak = (u.streak || 0) + 1;

        // Check if First Exchange badge needed
        if (!u.badges.some(b => b.id === 'b_first_exchange')) {
          u.badges.push({
            id: 'b_first_exchange',
            name: 'First Exchange',
            icon: 'Sparkles',
            desc: 'Completed first verified skill exchange',
            unlockedAt: new Date().toISOString()
          });
        }

        // Add credit transaction
        db.creditTransactions.push({
          id: `ctx_${Date.now()}_${u.id}`,
          userId: u.id,
          amount: 25,
          type: 'session_taught',
          description: `Completed verified skill exchange: ${exc.skillOffered} & ${exc.skillRequested}`,
          createdAt: new Date().toISOString()
        });

        // Add notification
        db.notifications.push({
          id: `notif_${Date.now()}_${u.id}`,
          userId: u.id,
          title: 'Skill Exchange Completed! 🎓 +25 Credits, +300 XP',
          message: 'Both partners confirmed completion! Leave a review to help the community.',
          type: 'credit_received',
          link: `/workspace/${exc.id}`,
          read: false,
          createdAt: new Date().toISOString()
        });
      }
    });
  }

  exc.updatedAt = new Date().toISOString();
  db.saveData();

  res.json({
    success: true,
    bothCompleted,
    exchange: exc
  });
});

export default router;
