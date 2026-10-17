import express from 'express';
import { dbService } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

// GET /api/messages/:connectionId
// Strictly accessible ONLY by the two participants of an ACCEPTED connection
router.get('/:connectionId', authRequired, async (req, res) => {
  try {
    const { connectionId } = req.params;
    const currentUserId = req.user.id;

    const data = await dbService.getConnectionMessages(connectionId, currentUserId);
    res.json(data);
  } catch (err) {
    console.error('Error fetching chat messages:', err);
    const status = err.message.includes('denied') || err.message.includes('only accessible') ? 403 : 404;
    res.status(status).json({ error: err.message || 'Chat is not accessible.' });
  }
});

// POST /api/messages/:connectionId
// Strictly accessible ONLY by the two participants of an ACCEPTED connection
router.post('/:connectionId', authRequired, async (req, res) => {
  try {
    const { connectionId } = req.params;
    const currentUserId = req.user.id;
    const messageBody = (req.body.messageBody || req.body.content || '').trim();
    const replyToId = req.body.replyToId || null;

    if (!messageBody) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const newMsg = await dbService.sendConnectionMessage(connectionId, currentUserId, messageBody, replyToId);
    res.status(201).json({
      success: true,
      message: newMsg
    });
  } catch (err) {
    console.error('Error sending message:', err);
    const status = err.message.includes('denied') || err.message.includes('only accessible') ? 403 : 400;
    res.status(status).json({ error: err.message || 'Failed to send message.' });
  }
});

// PUT /api/messages/:messageId
// Edit message (sender only)
router.put('/:messageId', authRequired, async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user.id;
    const messageBody = (req.body.messageBody || req.body.content || '').trim();

    if (!messageBody) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const updated = await dbService.editConnectionMessage(messageId, currentUserId, messageBody);
    res.json({
      success: true,
      message: updated
    });
  } catch (err) {
    console.error('Error editing message:', err);
    const status = err.message.includes('denied') ? 403 : 400;
    res.status(status).json({ error: err.message || 'Failed to edit message.' });
  }
});

// POST /api/messages/:messageId/unsend
// Unsend message for both participants (sender only)
router.post('/:messageId/unsend', authRequired, async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user.id;

    await dbService.unsendConnectionMessage(messageId, currentUserId);
    res.json({
      success: true,
      messageId
    });
  } catch (err) {
    console.error('Error unsending message:', err);
    const status = err.message.includes('denied') ? 403 : 400;
    res.status(status).json({ error: err.message || 'Failed to unsend message.' });
  }
});

// POST /api/messages/:messageId/delete-for-me
// Delete message from current user's view only
router.post('/:messageId/delete-for-me', authRequired, async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user.id;

    await dbService.deleteMessageForMe(messageId, currentUserId);
    res.json({
      success: true,
      messageId
    });
  } catch (err) {
    console.error('Error deleting message for me:', err);
    const status = err.message.includes('denied') ? 403 : 400;
    res.status(status).json({ error: err.message || 'Failed to delete message from your view.' });
  }
});

// POST /api/messages/:connectionId/clear
// Clear all messages from current user's view only
router.post('/:connectionId/clear', authRequired, async (req, res) => {
  try {
    const { connectionId } = req.params;
    const currentUserId = req.user.id;

    await dbService.clearConnectionChat(connectionId, currentUserId);
    res.json({
      success: true,
      message: 'Chat cleared from your device.'
    });
  } catch (err) {
    console.error('Error clearing chat:', err);
    const status = err.message.includes('denied') ? 403 : 400;
    res.status(status).json({ error: err.message || 'Failed to clear chat.' });
  }
});

export default router;
