import { Request, Response } from 'express';
import prisma from '../config/database';

// ============================================
// GET GLOBAL LEADERBOARD
// ============================================
export const getGlobalLeaderboard = async (req: Request, res: Response) => {
  try {
    const { 
      sortBy = 'experiencePoints', 
      period = 'all', 
      limit = '50' 
    } = req.query;

    const limitNum = parseInt(limit as string);

    // Determine sort field
    let orderBy: any = {};
    switch (sortBy) {
      case 'experiencePoints':
        orderBy = { experiencePoints: 'desc' };
        break;
      case 'trustScore':
        orderBy = { trustScore: 'desc' };
        break;
      case 'totalEarned':
        orderBy = { totalEarned: 'desc' };
        break;
      case 'tasksCompleted':
        orderBy = { tasksCompleted: 'desc' };
        break;
      default:
        orderBy = { experiencePoints: 'desc' };
    }

    // Get top users
    const leaderboard = await prisma.userProfile.findMany({
      where: {
        user: {
          status: 'ACTIVE',
        },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            userType: true,
            createdAt: true,
          },
        },
      },
      orderBy,
      take: limitNum,
    });

    // Add rank to each user
    const rankedLeaderboard = leaderboard.map((profile, index) => ({
      rank: index + 1,
      userId: profile.user.id,
      username: profile.user.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      experiencePoints: profile.experiencePoints,
      level: profile.level,
      trustScore: profile.trustScore,
      totalEarned: Number(profile.totalEarned),
      tasksCompleted: profile.tasksCompleted,
      campaignsParticipated: profile.campaignsParticipated,
      approvalRate: profile.approvalRate,
      joinedAt: profile.user.createdAt,
    }));

    return res.status(200).json({
      success: true,
      data: {
        leaderboard: rankedLeaderboard,
        sortBy,
        period,
      },
    });
  } catch (error) {
    console.error('Get global leaderboard error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch leaderboard',
      },
    });
  }
};

// ============================================
// GET CAMPAIGN LEADERBOARD
// ============================================
export const getCampaignLeaderboard = async (req: Request, res: Response) => {
  try {
    const campaignId = req.params.campaignId as string;
    const { limit = '20' } = req.query;

    // Verify campaign exists
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Campaign not found',
        },
      });
    }

    // Get participants with their stats
    const participants = await prisma.campaignParticipation.findMany({
      where: {
        campaignId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
                level: true,
                trustScore: true,
              },
            },
          },
        },
      },
      orderBy: {
        tasksCompleted: 'desc',
      },
      take: parseInt(limit as string),
    });

    // Get submission counts and rewards for each participant
    const leaderboard = await Promise.all(
      participants.map(async (participant, index) => {
        const approvedSubmissions = await prisma.submission.count({
          where: {
            userId: participant.userId,
            task: {
              campaignId,
            },
            status: 'APPROVED',
          },
        });

        const totalRewards = await prisma.submission.findMany({
          where: {
            userId: participant.userId,
            task: {
              campaignId,
            },
            status: 'APPROVED',
          },
          include: {
            task: {
              select: {
                reward: true,
                experiencePoints: true,
              },
            },
          },
        });

        const totalTokens = totalRewards.reduce(
          (sum, sub) => sum + Number(sub.task.reward),
          0
        );
        const totalXP = totalRewards.reduce(
          (sum, sub) => sum + sub.task.experiencePoints,
          0
        );

        return {
          rank: index + 1,
          userId: participant.user.id,
          username: participant.user.username,
          displayName: participant.user.profile?.displayName,
          avatarUrl: participant.user.profile?.avatarUrl,
          level: participant.user.profile?.level || 1,
          trustScore: participant.user.profile?.trustScore || 500,
          tasksCompleted: participant.tasksCompleted,
          totalTasks: participant.totalTasks,
          completionRate: participant.totalTasks > 0
            ? ((participant.tasksCompleted / participant.totalTasks) * 100).toFixed(1)
            : '0.0',
          totalTokensEarned: totalTokens,
          totalXPEarned: totalXP,
          joinedAt: participant.joinedAt,
          completedAt: participant.completedAt,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        campaignId,
        campaignName: campaign.name,
        leaderboard,
      },
    });
  } catch (error) {
    console.error('Get campaign leaderboard error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch campaign leaderboard',
      },
    });
  }
};

// ============================================
// GET USER RANK
// ============================================
export const getUserRank = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { sortBy = 'experiencePoints' } = req.query;

    // Get user profile
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            username: true,
          },
        },
      },
    });

    if (!userProfile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User profile not found',
        },
      });
    }

    // Calculate rank based on sortBy
    let rank = 0;
    switch (sortBy) {
      case 'experiencePoints':
        rank = await prisma.userProfile.count({
          where: {
            experiencePoints: {
              gt: userProfile.experiencePoints,
            },
          },
        }) + 1;
        break;
      case 'trustScore':
        rank = await prisma.userProfile.count({
          where: {
            trustScore: {
              gt: userProfile.trustScore,
            },
          },
        }) + 1;
        break;
      case 'totalEarned':
        rank = await prisma.userProfile.count({
          where: {
            totalEarned: {
              gt: userProfile.totalEarned,
            },
          },
        }) + 1;
        break;
      case 'tasksCompleted':
        rank = await prisma.userProfile.count({
          where: {
            tasksCompleted: {
              gt: userProfile.tasksCompleted,
            },
          },
        }) + 1;
        break;
      default:
        rank = await prisma.userProfile.count({
          where: {
            experiencePoints: {
              gt: userProfile.experiencePoints,
            },
          },
        }) + 1;
    }

    // Get total users
    const totalUsers = await prisma.userProfile.count();

    // Calculate percentile
    const percentile = totalUsers > 0
      ? (((totalUsers - rank + 1) / totalUsers) * 100).toFixed(1)
      : '0.0';

    return res.status(200).json({
      success: true,
      data: {
        rank,
        totalUsers,
        percentile: parseFloat(percentile),
        username: userProfile.user.username,
        experiencePoints: userProfile.experiencePoints,
        level: userProfile.level,
        trustScore: userProfile.trustScore,
        totalEarned: Number(userProfile.totalEarned),
        tasksCompleted: userProfile.tasksCompleted,
        campaignsParticipated: userProfile.campaignsParticipated,
      },
    });
  } catch (error) {
    console.error('Get user rank error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch user rank',
      },
    });
  }
};

// ============================================
// GET TOP EARNERS
// ============================================
export const getTopEarners = async (req: Request, res: Response) => {
  try {
    const { period = 'all', limit = '10' } = req.query;
    const limitNum = parseInt(limit as string);

    // For now, we'll get all-time top earners
    const topEarners = await prisma.userProfile.findMany({
      where: {
        totalEarned: {
          gt: 0,
        },
      },
      include: {
        user: {
          select: {
            username: true,
          },
        },
      },
      orderBy: {
        totalEarned: 'desc',
      },
      take: limitNum,
    });

    const rankedEarners = topEarners.map((profile, index) => ({
      rank: index + 1,
      username: profile.user.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      totalEarned: Number(profile.totalEarned),
      tasksCompleted: profile.tasksCompleted,
      campaignsParticipated: profile.campaignsParticipated,
      level: profile.level,
    }));

    return res.status(200).json({
      success: true,
      data: {
        topEarners: rankedEarners,
        period,
      },
    });
  } catch (error) {
    console.error('Get top earners error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch top earners',
      },
    });
  }
};

// ============================================
// GET LEADERBOARD STATS
// ============================================
export const getLeaderboardStats = async (req: Request, res: Response) => {
  try {
    const [
      totalMiners,
      totalXPDistributed,
      totalTokensDistributed,
      totalTasksCompleted,
      averageTrustScore,
    ] = await Promise.all([
      prisma.userProfile.count(),
      prisma.userProfile.aggregate({
        _sum: {
          experiencePoints: true,
        },
      }),
      prisma.userProfile.aggregate({
        _sum: {
          totalEarned: true,
        },
      }),
      prisma.userProfile.aggregate({
        _sum: {
          tasksCompleted: true,
        },
      }),
      prisma.userProfile.aggregate({
        _avg: {
          trustScore: true,
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalMiners,
        totalXPDistributed: totalXPDistributed._sum.experiencePoints || 0,
        totalTokensDistributed: Number(totalTokensDistributed._sum.totalEarned) || 0,
        totalTasksCompleted: totalTasksCompleted._sum.tasksCompleted || 0,
        averageTrustScore: Math.round(averageTrustScore._avg.trustScore || 500),
      },
    });
  } catch (error) {
    console.error('Get leaderboard stats error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch leaderboard stats',
      },
    });
  }
};