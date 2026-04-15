import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/v1/messages/conversations
 * @desc    Get all conversations for current user
 * @access  Private
 */
router.get('/conversations', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;

    // Get conversations where user is either participant
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { participant1Id: userId },
          { participant2Id: userId }
        ]
      },
      include: {
        participant1: {
          select: {
            id: true,
            username: true,
            email: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true
              }
            }
          }
        },
        participant2: {
          select: {
            id: true,
            username: true,
            email: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                username: true
              }
            }
          }
        }
      },
      orderBy: { lastMessageAt: 'desc' }
    });

    // Calculate unread count for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conv.id,
            senderId: { not: userId },
            isRead: false
          }
        });

        // Determine the other participant
        const otherParticipant = conv.participant1Id === userId 
          ? conv.participant2 
          : conv.participant1;

        return {
          ...conv,
          unreadCount,
          otherParticipant
        };
      })
    );

    res.json({
      success: true,
      data: { conversations: conversationsWithUnread }
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to load conversations' }
    });
  }
});

/**
 * @route   GET /api/v1/messages/conversation/:userId
 * @desc    Get or create conversation with another user
 * @access  Private
 */
router.get('/conversation/:userId', authenticate, async (req: any, res) => {
  try {
    const currentUserId = req.user.userId;
    const otherUserId = req.params.userId;

    if (currentUserId === otherUserId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot create conversation with yourself' }
      });
    }

    // Check if conversation already exists
    let conversation = await prisma.conversation.findFirst({
      where: {
        OR: [
          { participant1Id: currentUserId, participant2Id: otherUserId },
          { participant1Id: otherUserId, participant2Id: currentUserId }
        ]
      },
      include: {
        participant1: {
          select: {
            id: true,
            username: true,
            email: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true
              }
            }
          }
        },
        participant2: {
          select: {
            id: true,
            username: true,
            email: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                profile: {
                  select: {
                    displayName: true,
                    avatarUrl: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // Create conversation if it doesn't exist
    if (!conversation) {
      const newConversation = await prisma.conversation.create({
        data: {
          participant1Id: currentUserId,
          participant2Id: otherUserId
        }
      });

      // Fetch the newly created conversation with all relations
      conversation = await prisma.conversation.findUnique({
        where: { id: newConversation.id },
        include: {
          participant1: {
            select: {
              id: true,
              username: true,
              email: true,
              profile: {
                select: {
                  displayName: true,
                  avatarUrl: true
                }
              }
            }
          },
          participant2: {
            select: {
              id: true,
              username: true,
              email: true,
              profile: {
                select: {
                  displayName: true,
                  avatarUrl: true
                }
              }
            }
          },
          messages: {
            orderBy: { createdAt: 'asc' },
            include: {
              sender: {
                select: {
                  id: true,
                  username: true,
                  profile: {
                    select: {
                      displayName: true,
                      avatarUrl: true
                    }
                  }
                }
              }
            }
          }
        }
      });
    }

    if (!conversation) {
      return res.status(500).json({
        success: false,
        error: { message: 'Failed to create conversation' }
      });
    }

    // Determine the other participant
    const otherParticipant = conversation.participant1Id === currentUserId 
      ? conversation.participant2 
      : conversation.participant1;

    res.json({
      success: true,
      data: { 
        conversation: {
          ...conversation,
          otherParticipant
        }
      }
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to load conversation' }
    });
  }
});

/**
 * @route   POST /api/v1/messages/send
 * @desc    Send a message
 * @access  Private
 */
router.post('/send', authenticate, async (req: any, res) => {
  try {
    const senderId = req.user.userId;
    const { recipientId, content } = req.body;

    if (!recipientId || !content) {
      return res.status(400).json({
        success: false,
        error: { message: 'Recipient and content are required' }
      });
    }

    if (senderId === recipientId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot send message to yourself' }
      });
    }

    // Find or create conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        OR: [
          { participant1Id: senderId, participant2Id: recipientId },
          { participant1Id: recipientId, participant2Id: senderId }
        ]
      }
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          participant1Id: senderId,
          participant2Id: recipientId
        }
      });
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId,
        content
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    });

    // Update conversation's lastMessageAt
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() }
    });

    res.json({
      success: true,
      data: { message }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to send message' }
    });
  }
});

/**
 * @route   POST /api/v1/messages/mark-read/:conversationId
 * @desc    Mark all messages in conversation as read
 * @access  Private
 */
router.post('/mark-read/:conversationId', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const { conversationId } = req.params;

    // Mark all messages from the other user as read
    await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false
      },
      data: {
        isRead: true
      }
    });

    res.json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to mark messages as read' }
    });
  }
});

/**
 * @route   GET /api/v1/messages/unread-count
 * @desc    Get total unread message count
 * @access  Private
 */
router.get('/unread-count', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;

    const count = await prisma.message.count({
      where: {
        conversation: {
          OR: [
            { participant1Id: userId },
            { participant2Id: userId }
          ]
        },
        senderId: { not: userId },
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
      error: { message: 'Failed to get unread count' }
    });
  }
});

export default router;