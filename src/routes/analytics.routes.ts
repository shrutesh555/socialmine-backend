import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/v1/analytics/owner/:ownerId
 * @desc    Get owner analytics
 * @access  Private
 */
router.get('/owner/:ownerId', authenticate, async (req: any, res) => {
  try {
    const { ownerId } = req.params;

    // Campaign stats
    const campaigns = await prisma.campaign.findMany({
      where: { ownerId },
      include: {
        tasks: true,
        participations: true,
        _count: {
          select: {
            tasks: true,
            participations: true,
          }
        }
      }
    });

    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE').length;
    const completedCampaigns = campaigns.filter(c => c.status === 'COMPLETED').length;

    // Task stats
    const allTasks = campaigns.flatMap(c => c.tasks);
    const totalTasks = allTasks.length;

    // Participation stats
    const totalParticipants = campaigns.reduce((sum, c) => sum + c.participantCount, 0);

    // Submissions for owner's campaigns
    const taskIds = allTasks.map(t => t.id);
    const submissions = await prisma.submission.findMany({
      where: {
        taskId: { in: taskIds }
      }
    });

    const totalSubmissions = submissions.length;
    const approvedSubmissions = submissions.filter(s => s.status === 'APPROVED').length;
    const pendingSubmissions = submissions.filter(s => s.status === 'PENDING').length;

    // Campaign performance over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentCampaigns = await prisma.campaign.findMany({
      where: {
        ownerId,
        createdAt: { gte: thirtyDaysAgo }
      },
      orderBy: { createdAt: 'asc' }
    });

    const campaignsByDate = recentCampaigns.reduce((acc: any, campaign) => {
      const date = campaign.createdAt.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    const campaignTrend = Object.entries(campaignsByDate).map(([date, count]) => ({
      date,
      campaigns: count
    }));

    // Submissions over time (last 30 days)
    const recentSubmissions = await prisma.submission.findMany({
      where: {
        taskId: { in: taskIds },
        submittedAt: { gte: thirtyDaysAgo }
      },
      orderBy: { submittedAt: 'asc' }
    });

    const submissionsByDate = recentSubmissions.reduce((acc: any, submission) => {
      const date = submission.submittedAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { date, approved: 0, pending: 0, rejected: 0 };
      }
      if (submission.status === 'APPROVED') acc[date].approved++;
      if (submission.status === 'PENDING') acc[date].pending++;
      if (submission.status === 'REJECTED') acc[date].rejected++;
      return acc;
    }, {});

    const submissionTrend = Object.values(submissionsByDate);

    // Campaign status breakdown
    const campaignsByStatus = {
      DRAFT: campaigns.filter(c => c.status === 'DRAFT').length,
      ACTIVE: campaigns.filter(c => c.status === 'ACTIVE').length,
      PAUSED: campaigns.filter(c => c.status === 'PAUSED').length,
      COMPLETED: campaigns.filter(c => c.status === 'COMPLETED').length,
      CANCELLED: campaigns.filter(c => c.status === 'CANCELLED').length,
    };

    res.json({
      success: true,
      data: {
        overview: {
          totalCampaigns,
          activeCampaigns,
          completedCampaigns,
          totalTasks,
          totalParticipants,
          totalSubmissions,
          approvedSubmissions,
          pendingSubmissions,
          approvalRate: totalSubmissions > 0 ? ((approvedSubmissions / totalSubmissions) * 100).toFixed(1) : 0
        },
        campaignTrend,
        submissionTrend,
        campaignsByStatus
      }
    });
  } catch (error) {
    console.error('Owner analytics error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to load analytics' }
    });
  }
});

/**
 * @route   GET /api/v1/analytics/miner/:minerId
 * @desc    Get miner analytics
 * @access  Private
 */
router.get('/miner/:minerId', authenticate, async (req: any, res) => {
  try {
    const { minerId } = req.params;

    // Get user profile
    const profile = await prisma.userProfile.findUnique({
      where: { userId: minerId }
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: { message: 'Profile not found' }
      });
    }

    // Submissions stats
    const submissions = await prisma.submission.findMany({
      where: { userId: minerId },
      include: {
        task: {
          include: {
            campaign: true
          }
        }
      }
    });

    const totalSubmissions = submissions.length;
    const approvedSubmissions = submissions.filter(s => s.status === 'APPROVED').length;
    const rejectedSubmissions = submissions.filter(s => s.status === 'REJECTED').length;
    const pendingSubmissions = submissions.filter(s => s.status === 'PENDING').length;

    // Earnings over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentApproved = submissions.filter(s => 
      s.status === 'APPROVED' && 
      s.reviewedAt && 
      s.reviewedAt >= thirtyDaysAgo
    );

    const earningsByDate = recentApproved.reduce((acc: any, submission) => {
      const date = submission.reviewedAt!.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { date, tokens: 0, xp: 0 };
      }
      acc[date].tokens += parseFloat(submission.task.reward.toString());
      acc[date].xp += submission.task.experiencePoints;
      return acc;
    }, {});

    const earningsTrend = Object.values(earningsByDate);

    // Task completion over time
    const submissionsByDate = submissions.reduce((acc: any, submission) => {
      const date = submission.submittedAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { date, completed: 0, pending: 0 };
      }
      if (submission.status === 'APPROVED') acc[date].completed++;
      else acc[date].pending++;
      return acc;
    }, {});

    const activityTrend = Object.values(submissionsByDate).slice(-30);

    // Campaign participation
    const campaignIds = [...new Set(submissions.map(s => s.task.campaign.id))];
    const uniqueCampaigns = campaignIds.length;

    res.json({
      success: true,
      data: {
        overview: {
          totalEarnings: parseFloat(profile.totalEarned.toString()),
          experiencePoints: profile.experiencePoints,
          level: profile.level,
          tasksCompleted: profile.tasksCompleted,
          campaignsParticipated: profile.campaignsParticipated,
          totalSubmissions,
          approvedSubmissions,
          rejectedSubmissions,
          pendingSubmissions,
          approvalRate: totalSubmissions > 0 ? ((approvedSubmissions / totalSubmissions) * 100).toFixed(1) : 0
        },
        earningsTrend,
        activityTrend,
        submissionStats: {
          approved: approvedSubmissions,
          rejected: rejectedSubmissions,
          pending: pendingSubmissions
        }
      }
    });
  } catch (error) {
    console.error('Miner analytics error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to load analytics' }
    });
  }
});

export default router;