import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/v1/notifications
 * @desc    Get user's notifications
 * @access  Private
 */
router.get('/', authenticate, async (req: any, res) => {
  try {
    const { limit = 50, unreadOnly = 'false' } = req.query;

    const where: any = {
      userId: req.user.userId
    };

    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            email: true,
          }
        }
      }
    });

    // Get unread count
    const unreadCount = await prisma.notification.count({
      where: {
        userId: req.user.userId,
        isRead: false
      }
    });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to load notifications' }
    });
  }
});

/**
 * @route   GET /api/v1/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Private
 */
router.get('/unread-count', authenticate, async (req: any, res) => {
  try {
    const count = await prisma.notification.count({
      where: {
        userId: req.user.userId,
        isRead: false
      }
    });

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get count' }
    });
  }
});

/**
 * @route   POST /api/v1/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.post('/:id/read', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.update({
      where: {
        id,
        userId: req.user.userId // Ensure user owns this notification
      },
      data: {
        isRead: true
      }
    });

    res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to mark as read' }
    });
  }
});

/**
 * @route   POST /api/v1/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.post('/mark-all-read', authenticate, async (req: any, res) => {
  try {
    await prisma.notification.updateMany({
      where: {
        userId: req.user.userId,
        isRead: false
      },
      data: {
        isRead: true
      }
    });

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to mark all as read' }
    });
  }
});

/**
 * @route   DELETE /api/v1/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
router.delete('/:id', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;

    await prisma.notification.delete({
      where: {
        id,
        userId: req.user.userId
      }
    });

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to delete notification' }
    });
  }
});

export default router;