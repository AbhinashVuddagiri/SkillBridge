import express from 'express';
import { dbService } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

// GET /api/connections
// Get all connections for authenticated user with partner details
router.get('/', authRequired, async (req, res) => {
  try {
    const connections = await dbService.getUserConnections(req.user.id);
    res.json({ connections });
  } catch (err) {
    console.error('Error fetching connections:', err);
    res.status(500).json({ error: 'Failed to fetch connections: ' + err.message });
  }
});

// POST /api/connections
// Send connection request from User A to User B
router.post('/', authRequired, async (req, res) => {
  try {
    const { recipientId } = req.body;
    const requesterId = req.user.id;

    if (!recipientId) {
      return res.status(400).json({ error: 'Recipient ID is required.' });
    }

    if (recipientId === requesterId) {
      return res.status(400).json({ error: 'You cannot connect with yourself.' });
    }

    const connection = await dbService.sendConnectionRequest(requesterId, recipientId);
    res.status(201).json({ success: true, connection });
  } catch (err) {
    console.error('Error sending connection request:', err);
    res.status(400).json({ error: err.message || 'Failed to send connection request.' });
  }
});

// PUT /api/connections/:id/accept
// Accept connection request (recipient only)
router.put('/:id/accept', authRequired, async (req, res) => {
  try {
    const connection = await dbService.respondConnectionRequest(req.params.id, req.user.id, 'accepted');
    res.json({ success: true, connection });
  } catch (err) {
    console.error('Error accepting connection request:', err);
    res.status(400).json({ error: err.message || 'Failed to accept connection.' });
  }
});

// PUT /api/connections/:id/reject
// Reject connection request (recipient only)
router.put('/:id/reject', authRequired, async (req, res) => {
  try {
    const connection = await dbService.respondConnectionRequest(req.params.id, req.user.id, 'rejected');
    res.json({ success: true, connection });
  } catch (err) {
    console.error('Error declining connection request:', err);
    res.status(400).json({ error: err.message || 'Failed to decline connection.' });
  }
});

// GET /api/connections/muted
// Get list of muted connection IDs for current user
router.get('/muted', authRequired, async (req, res) => {
  try {
    const mutedIds = await dbService.getMutedConnectionIds(req.user.id);
    res.json({ mutedIds });
  } catch (err) {
    console.error('Error fetching muted connections:', err);
    res.status(500).json({ error: 'Failed to fetch muted connections: ' + err.message });
  }
});

// POST /api/connections/:id/mute
// Toggle mute/unmute notifications for this specific connection
router.post('/:id/mute', authRequired, async (req, res) => {
  try {
    const isMuted = await dbService.toggleConnectionMute(req.params.id, req.user.id);
    res.json({ success: true, isMuted });
  } catch (err) {
    console.error('Error toggling connection mute:', err);
    res.status(400).json({ error: err.message || 'Failed to update mute setting.' });
  }
});

// DELETE /api/connections/:id
// Safely remove connection between User A and User B (authorized participants only)
router.delete('/:id', authRequired, async (req, res) => {
  try {
    await dbService.removeConnection(req.params.id, req.user.id);
    res.json({ success: true, message: 'Connection removed successfully.' });
  } catch (err) {
    console.error('Error removing connection:', err);
    res.status(400).json({ error: err.message || 'Failed to remove connection.' });
  }
});

export default router;
