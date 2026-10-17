import express from 'express';
import { dbService } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

// Helper to determine unread status cleanly
const isUnread = (n) => !n.read && n.read !== true && n.read !== 'true';

// GET /api/notifications
router.get('/', authRequired, async (req, res) => {
  try {
    const notifications = await dbService.getUserNotifications(req.user.id);
    const unreadCount = notifications.filter(isUnread).length;

    res.json({
      notifications,
      unreadCount
    });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications: ' + err.message });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authRequired, async (req, res) => {
  try {
    await dbService.markNotificationRead(req.params.id, req.user.id);
    const notifications = await dbService.getUserNotifications(req.user.id);
    const unreadCount = notifications.filter(isUnread).length;
    res.json({ success: true, unreadCount, notifications });
  } catch (err) {
    console.error('Error marking notification read:', err);
    res.status(500).json({ error: 'Failed to update notification: ' + err.message });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', authRequired, async (req, res) => {
  try {
    await dbService.markAllNotificationsRead(req.user.id);
    const notifications = await dbService.getUserNotifications(req.user.id);
    const unreadCount = notifications.filter(isUnread).length;
    res.json({ success: true, unreadCount, notifications });
  } catch (err) {
    console.error('Error marking all notifications read:', err);
    res.status(500).json({ error: 'Failed to update notifications: ' + err.message });
  }
});

export default router;
