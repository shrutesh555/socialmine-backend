import { Request, Response } from 'express';
import prisma from '../config/database';

// ============================================
// GET CAMPAIGN ANALYTICS (OWNER)
// ============================================
export const getCampaignAnalytics = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const campaignId = req.params.campaignId as string;

    // Verify campaign exists and user is owner
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        token: {
          select: {
            name: true,
            symbol: true,
          },
        },
      },
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

    if (campaign.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only campaign owner can view analytics',
        },
      });
    }

    // Get all analytics data in parallel
    const [
      totalParticipants,
      activeParticipants,
      completedParticipants,
      totalTasks,
      totalSubmissions,
      approvedSubmissions,
      rejectedSubmissions,
      pendingSubmissions,
      totalXPDistributed,
      totalTokensDistributed,
    ] = await Promise.all([
      prisma.campaignParticipation.count({
        where: { campaignId },
      }),
      prisma.campaignParticipation.count({
        where: {
          campaignId,
          completedAt: null,
        },
      }),
      prisma.campaignParticipation.count({
        where: {
          campaignId,
          completedAt: { not: null },
        },
      }),
      prisma.task.count({
        where: { campaignId },
      }),
      prisma.submission.count({
        where: {
          task: { campaignId },
        },
      }),
      prisma.submission.count({
        where: {
          task: { campaignId },
          status: 'APPROVED',
        },
      }),
      prisma.submission.count({
        where: {
          task: { campaignId },
          status: 'REJECTED',
        },
      }),
      prisma.submission.count({
        where: {
          task: { campaignId },
          status: 'PENDING',
        },
      }),
      prisma.submission.findMany({
        where: {
          task: { campaignId },
          status: 'APPROVED',
        },
        include: {
          task: {
            select: {
              experiencePoints: true,
            },
          },
        },
      }),
      prisma.submission.findMany({
        where: {
          task: { campaignId },
          status: 'APPROVED',
        },
        include: {
          task: {
            select: {
              reward: true,
            },
          },
        },
      }),
    ]);

    // Calculate totals
    const totalXP = totalXPDistributed.reduce(
      (sum, sub) => sum + sub.task.experiencePoints,
      0
    );
    const totalTokens = totalTokensDistributed.reduce(
      (sum, sub) => sum + Number(sub.task.reward),
      0
    );

    // Calculate approval rate
    const approvalRate = totalSubmissions > 0
      ? ((approvedSubmissions / totalSubmissions) * 100).toFixed(1)
      : '0.0';

    // Calculate completion rate
    const completionRate = totalParticipants > 0
      ? ((completedParticipants / totalParticipants) * 100).toFixed(1)
      : '0.0';

    // Get top performers
    const topPerformers = await prisma.campaignParticipation.findMany({
      where: { campaignId },
      include: {
        user: {
          select: {
            username: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: {
        tasksCompleted: 'desc',
      },
      take: 5,
    });

    return res.status(200).json({
      success: true,
      data: {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          type: campaign.type,
          tokenSymbol: campaign.token.symbol,
          createdAt: campaign.createdAt,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
        },
        participants: {
          total: totalParticipants,
          active: activeParticipants,
          completed: completedParticipants,
          completionRate: parseFloat(completionRate),
        },
        tasks: {
          total: totalTasks,
        },
        submissions: {
          total: totalSubmissions,
          approved: approvedSubmissions,
          rejected: rejectedSubmissions,
          pending: pendingSubmissions,
          approvalRate: parseFloat(approvalRate),
        },
        rewards: {
          totalXPDistributed: totalXP,
          totalTokensDistributed: totalTokens,
        },
        topPerformers: topPerformers.map((p, index) => ({
          rank: index + 1,
          username: p.user.username,
          displayName: p.user.profile?.displayName,
          avatarUrl: p.user.profile?.avatarUrl,
          tasksCompleted: p.tasksCompleted,
          totalTasks: p.totalTasks,
          completionRate: p.totalTasks > 0
            ? ((p.tasksCompleted / p.totalTasks) * 100).toFixed(1)
            : '0.0',
        })),
      },
    });
  } catch (error) {
    console.error('Get campaign analytics error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch campaign analytics',
      },
    });
  }
};

// ============================================
// GET MINER ANALYTICS (PERSONAL STATS)
// ============================================
export const getMinerAnalytics = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    // Get user profile with detailed stats
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            username: true,
            email: true,
            createdAt: true,
          },
        },
      },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User profile not found',
        },
      });
    }

    // Get campaign participation stats
    const [
      activeCampaigns,
      completedCampaigns,
      totalSubmissions,
      approvedSubmissions,
      rejectedSubmissions,
      pendingSubmissions,
      totalPayments,
      completedPayments,
    ] = await Promise.all([
      prisma.campaignParticipation.count({
        where: {
          userId,
          completedAt: null,
        },
      }),
      prisma.campaignParticipation.count({
        where: {
          userId,
          completedAt: { not: null },
        },
      }),
      prisma.submission.count({
        where: { userId },
      }),
      prisma.submission.count({
        where: {
          userId,
          status: 'APPROVED',
        },
      }),
      prisma.submission.count({
        where: {
          userId,
          status: 'REJECTED',
        },
      }),
      prisma.submission.count({
        where: {
          userId,
          status: 'PENDING',
        },
      }),
      prisma.payment.count({
        where: { recipientId: userId },
      }),
      prisma.payment.count({
        where: {
          recipientId: userId,
          status: 'COMPLETED',
        },
      }),
    ]);

    // Get earnings breakdown by token
    const earnings = await prisma.payment.findMany({
      where: {
        recipientId: userId,
        status: 'COMPLETED',
      },
      select: {
        amount: true,
        tokenSymbol: true,
        blockchain: true,
      },
    });

    const earningsByToken = earnings.reduce((acc: any, payment) => {
      const key = `${payment.tokenSymbol}-${payment.blockchain}`;
      if (!acc[key]) {
        acc[key] = {
          tokenSymbol: payment.tokenSymbol,
          blockchain: payment.blockchain,
          totalAmount: 0,
        };
      }
      acc[key].totalAmount += Number(payment.amount);
      return acc;
    }, {});

    // Calculate approval rate
    const approvalRate = totalSubmissions > 0
      ? ((approvedSubmissions / totalSubmissions) * 100).toFixed(1)
      : '0.0';

    // Get recent activity
    const recentSubmissions = await prisma.submission.findMany({
      where: { userId },
      include: {
        task: {
          include: {
            campaign: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
      take: 5,
    });

    return res.status(200).json({
      success: true,
      data: {
        profile: {
          username: profile.user.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          bio: profile.bio,
          level: profile.level,
          experiencePoints: profile.experiencePoints,
          trustScore: profile.trustScore,
          memberSince: profile.user.createdAt,
        },
        campaigns: {
          active: activeCampaigns,
          completed: completedCampaigns,
          total: profile.campaignsParticipated,
        },
        tasks: {
          completed: profile.tasksCompleted,
        },
        submissions: {
          total: totalSubmissions,
          approved: approvedSubmissions,
          rejected: rejectedSubmissions,
          pending: pendingSubmissions,
          approvalRate: parseFloat(approvalRate),
        },
        earnings: {
          totalEarned: Number(profile.totalEarned),
          byToken: Object.values(earningsByToken),
          totalPayments: totalPayments,
          completedPayments: completedPayments,
          pendingPayments: totalPayments - completedPayments,
        },
        recentActivity: recentSubmissions.map(sub => ({
          id: sub.id,
          taskTitle: sub.task.title,
          campaignName: sub.task.campaign.name,
          status: sub.status,
          submittedAt: sub.submittedAt,
          reviewedAt: sub.reviewedAt,
        })),
      },
    });
  } catch (error) {
    console.error('Get miner analytics error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch miner analytics',
      },
    });
  }
};

// ============================================
// GET PLATFORM ANALYTICS (ADMIN VIEW)
// ============================================
export const getPlatformAnalytics = async (req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      totalOwners,
      totalMiners,
      totalTokens,
      approvedTokens,
      totalCampaigns,
      activeCampaigns,
      totalTasks,
      totalSubmissions,
      approvedSubmissions,
      totalPayments,
      completedPayments,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: { userType: 'PROJECT_OWNER' },
      }),
      prisma.user.count({
        where: { userType: 'MINER' },
      }),
      prisma.token.count(),
      prisma.token.count({
        where: { status: 'APPROVED' },
      }),
      prisma.campaign.count(),
      prisma.campaign.count({
        where: { status: 'ACTIVE' },
      }),
      prisma.task.count(),
      prisma.submission.count(),
      prisma.submission.count({
        where: { status: 'APPROVED' },
      }),
      prisma.payment.count(),
      prisma.payment.count({
        where: { status: 'COMPLETED' },
      }),
    ]);

    // Get total XP and tokens distributed
    const [xpData, tokenData] = await Promise.all([
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
    ]);

    // Calculate approval rate
    const approvalRate = totalSubmissions > 0
      ? ((approvedSubmissions / totalSubmissions) * 100).toFixed(1)
      : '0.0';

    return res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          owners: totalOwners,
          miners: totalMiners,
        },
        tokens: {
          total: totalTokens,
          approved: approvedTokens,
          pending: totalTokens - approvedTokens,
        },
        campaigns: {
          total: totalCampaigns,
          active: activeCampaigns,
          completed: totalCampaigns - activeCampaigns,
        },
        tasks: {
          total: totalTasks,
          averagePerCampaign: totalCampaigns > 0
            ? (totalTasks / totalCampaigns).toFixed(1)
            : '0.0',
        },
        submissions: {
          total: totalSubmissions,
          approved: approvedSubmissions,
          rejected: totalSubmissions - approvedSubmissions,
          approvalRate: parseFloat(approvalRate),
        },
        payments: {
          total: totalPayments,
          completed: completedPayments,
          pending: totalPayments - completedPayments,
        },
        rewards: {
          totalXPDistributed: xpData._sum.experiencePoints || 0,
          totalTokensDistributed: Number(tokenData._sum.totalEarned) || 0,
        },
      },
    });
  } catch (error) {
    console.error('Get platform analytics error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch platform analytics',
      },
    });
  }
};

// ============================================
// GET OWNER DASHBOARD STATS
// ============================================
export const getOwnerDashboard = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    const [
      totalTokens,
      approvedTokens,
      totalCampaigns,
      activeCampaigns,
      totalTasks,
      totalParticipants,
      totalSubmissions,
      pendingReviews,
      totalPayments,
    ] = await Promise.all([
      prisma.token.count({
        where: { ownerId: userId },
      }),
      prisma.token.count({
        where: {
          ownerId: userId,
          status: 'APPROVED',
        },
      }),
      prisma.campaign.count({
        where: { ownerId: userId },
      }),
      prisma.campaign.count({
        where: {
          ownerId: userId,
          status: 'ACTIVE',
        },
      }),
      prisma.task.count({
        where: {
          campaign: {
            ownerId: userId,
          },
        },
      }),
      prisma.campaignParticipation.count({
        where: {
          campaign: {
            ownerId: userId,
          },
        },
      }),
      prisma.submission.count({
        where: {
          task: {
            campaign: {
              ownerId: userId,
            },
          },
        },
      }),
      prisma.submission.count({
        where: {
          task: {
            campaign: {
              ownerId: userId,
            },
          },
          status: 'PENDING',
        },
      }),
      prisma.payment.count({
        where: { senderId: userId },
      }),
    ]);

    // Get recent campaigns
    const recentCampaigns = await prisma.campaign.findMany({
      where: { ownerId: userId },
      include: {
        token: {
          select: {
            name: true,
            symbol: true,
            logoUrl: true,
          },
        },
        _count: {
          select: {
            participations: true,
            tasks: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    return res.status(200).json({
      success: true,
      data: {
        tokens: {
          total: totalTokens,
          approved: approvedTokens,
          pending: totalTokens - approvedTokens,
        },
        campaigns: {
          total: totalCampaigns,
          active: activeCampaigns,
          draft: totalCampaigns - activeCampaigns,
        },
        tasks: {
          total: totalTasks,
        },
        participants: {
          total: totalParticipants,
        },
        submissions: {
          total: totalSubmissions,
          pendingReview: pendingReviews,
        },
        payments: {
          total: totalPayments,
        },
        recentCampaigns: recentCampaigns.map(campaign => ({
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          type: campaign.type,
          token: campaign.token,
          participants: campaign._count.participations,
          tasks: campaign._count.tasks,
          createdAt: campaign.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Get owner dashboard error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch owner dashboard',
      },
    });
  }
};