import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/v1/leaderboard
 * @desc    Get leaderboard rankings
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const { timeframe = 'all', limit = 100 } = req.query;

    // Get all user profiles with stats, sorted by XP
    const profiles = await prisma.userProfile.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            userType: true,
            createdAt: true,
          }
        }
      },
      where: {
        user: {
          userType: 'MINER'
        }
      },
      orderBy: [
        { experiencePoints: 'desc' },
        { totalEarned: 'desc' }
      ],
      take: parseInt(limit as string)
    });

    // Add rank to each profile
    const leaderboard = profiles.map((profile, index) => ({
      rank: index + 1,
      userId: profile.user.id,
      username: profile.user.username,
      displayName: profile.displayName || profile.user.username,
      avatarUrl: profile.avatarUrl,
      experiencePoints: profile.experiencePoints,
      level: profile.level,
      totalEarned: parseFloat(profile.totalEarned.toString()),
      tasksCompleted: profile.tasksCompleted,
      campaignsParticipated: profile.campaignsParticipated,
      trustScore: profile.trustScore,
      approvalRate: parseFloat(profile.approvalRate.toString()),
      memberSince: profile.user.createdAt,
    }));

    res.json({
      success: true,
      data: { leaderboard }
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to load leaderboard' }
    });
  }
});

/**
 * @route   GET /api/v1/leaderboard/user/:userId
 * @desc    Get user's rank and stats
 * @access  Private
 */
router.get('/user/:userId', authenticate, async (req: any, res) => {
  try {
    const { userId } = req.params;

    // Get user's profile
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            username: true,
            createdAt: true,
          }
        }
      }
    });

    if (!userProfile) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' }
      });
    }

    // Get user's rank by counting users with higher XP
    const rank = await prisma.userProfile.count({
      where: {
        experiencePoints: {
          gt: userProfile.experiencePoints
        },
        user: {
          userType: 'MINER'
        }
      }
    }) + 1;

    // Get total miners count
    const totalMiners = await prisma.userProfile.count({
      where: {
        user: {
          userType: 'MINER'
        }
      }
    });

    res.json({
      success: true,
      data: {
        rank,
        totalMiners,
        profile: {
          username: userProfile.user.username,
          displayName: userProfile.displayName,
          experiencePoints: userProfile.experiencePoints,
          level: userProfile.level,
          totalEarned: parseFloat(userProfile.totalEarned.toString()),
          tasksCompleted: userProfile.tasksCompleted,
          campaignsParticipated: userProfile.campaignsParticipated,
          trustScore: userProfile.trustScore,
          approvalRate: parseFloat(userProfile.approvalRate.toString()),
        }
      }
    });
  } catch (error) {
    console.error('User rank error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get user rank' }
    });
  }
});

export default router;