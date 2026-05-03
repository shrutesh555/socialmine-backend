import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/v1/roles/campaign/:campaignId/participants
 * @desc    Get all participants with their roles for a campaign (owner only)
 * @access  Private (Campaign Owner)
 */
router.get('/campaign/:campaignId/participants', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const { campaignId } = req.params;

    // Verify ownership
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, ownerId: userId },
    });

    if (!campaign) {
      return res.status(403).json({
        success: false,
        error: { message: 'Not authorized - you must be the campaign owner' },
      });
    }

    const participants = await prisma.campaignParticipation.findMany({
      where: { campaignId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
                experiencePoints: true,
                level: true,
                trustScore: true,
                tasksCompleted: true,
                approvalRate: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    // Get submission stats per participant
    const participantsWithStats = await Promise.all(
      participants.map(async (p) => {
        const submissions = await prisma.submission.findMany({
          where: {
            userId: p.userId,
            task: { campaignId },
          },
          select: { status: true },
        });

        const approved = submissions.filter((s) => s.status === 'APPROVED').length;
        const total = submissions.length;
        const pending = submissions.filter((s) => s.status === 'PENDING').length;

        // Count reviews done by this user (if reviewer)
        const reviewsDone = await prisma.review.count({
          where: {
            reviewerId: p.userId,
            submission: { task: { campaignId } },
          },
        });

        return {
          ...p,
          stats: {
            totalSubmissions: total,
            approved,
            pending,
            approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
            reviewsDone,
          },
        };
      })
    );

    res.json({
      success: true,
      data: { participants: participantsWithStats },
    });
  } catch (error) {
    console.error('Get participants error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to load participants' },
    });
  }
});

/**
 * @route   PATCH /api/v1/roles/campaign/:campaignId/promote
 * @desc    Promote a miner to a role (REVIEWER, EDITOR, ADMIN)
 * @access  Private (Campaign Owner)
 */
router.patch('/campaign/:campaignId/promote', authenticate, async (req: any, res) => {
  try {
    const ownerId = req.user.userId;
    const { campaignId } = req.params;
    const { userId, role } = req.body;

    if (!userId || !role) {
      return res.status(400).json({
        success: false,
        error: { message: 'userId and role are required' },
      });
    }

    const validRoles = ['MINER', 'REVIEWER', 'EDITOR', 'ADMIN'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: { message: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
      });
    }

    // Verify ownership
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, ownerId },
    });

    if (!campaign) {
      return res.status(403).json({
        success: false,
        error: { message: 'Not authorized - you must be the campaign owner' },
      });
    }

    // Cannot promote yourself
    if (userId === ownerId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot change your own role' },
      });
    }

    // Find participation
    const participation = await prisma.campaignParticipation.findUnique({
      where: { campaignId_userId: { campaignId, userId } },
    });

    if (!participation) {
      return res.status(404).json({
        success: false,
        error: { message: 'User is not a participant of this campaign' },
      });
    }

    // Update role
    const updated = await prisma.campaignParticipation.update({
      where: { id: participation.id },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            profile: { select: { displayName: true } },
          },
        },
      },
    });

    res.json({
      success: true,
      data: updated,
      message: `User promoted to ${role} successfully`,
    });
  } catch (error) {
    console.error('Promote user error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to promote user' },
    });
  }
});

/**
 * @route   GET /api/v1/roles/reviewer/submissions
 * @desc    Get submissions available for reviewer to review (excludes own submissions)
 * @access  Private (Reviewer role in at least one campaign)
 */
router.get('/reviewer/submissions', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;

    // Find campaigns where user is a REVIEWER, EDITOR, or ADMIN
    const reviewerParticipations = await prisma.campaignParticipation.findMany({
      where: {
        userId,
        role: { in: ['REVIEWER', 'EDITOR', 'ADMIN'] },
      },
      select: { campaignId: true, role: true },
    });

    if (reviewerParticipations.length === 0) {
      return res.json({
        success: true,
        data: { submissions: [], campaigns: [] },
      });
    }

    const campaignIds = reviewerParticipations.map((p) => p.campaignId);

    // Get pending submissions from these campaigns, excluding reviewer's own
    const submissions = await prisma.submission.findMany({
      where: {
        task: { campaignId: { in: campaignIds } },
        userId: { not: userId }, // Cannot review own submissions
        status: 'PENDING',
      },
      include: {
        task: {
          include: {
            campaign: {
              select: {
                id: true,
                name: true,
                token: { select: { name: true, symbol: true, logoUrl: true } },
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    // Get campaign details
    const campaigns = await prisma.campaign.findMany({
      where: { id: { in: campaignIds } },
      select: {
        id: true,
        name: true,
        token: { select: { name: true, symbol: true, logoUrl: true } },
        _count: { select: { tasks: true } },
      },
    });

    res.json({
      success: true,
      data: {
        submissions,
        campaigns,
        reviewerRoles: reviewerParticipations,
      },
    });
  } catch (error) {
    console.error('Get reviewer submissions error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to load reviewer submissions' },
    });
  }
});

/**
 * @route   POST /api/v1/roles/reviewer/review/:submissionId
 * @desc    Review a submission as a reviewer
 * @access  Private (Reviewer role in the submission's campaign)
 */
router.post('/reviewer/review/:submissionId', authenticate, async (req: any, res) => {
  try {
    const reviewerId = req.user.userId;
    const { submissionId } = req.params;
    const { approved, feedback } = req.body;

    if (typeof approved !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: { message: 'approved (boolean) is required' },
      });
    }

    // Get submission with campaign info
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        task: {
          include: {
            campaign: { select: { id: true, ownerId: true } },
          },
        },
      },
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: { message: 'Submission not found' },
      });
    }

    // Cannot review own submission
    if (submission.userId === reviewerId) {
      return res.status(403).json({
        success: false,
        error: { message: 'Cannot review your own submission' },
      });
    }

    // Verify reviewer has role in this campaign
    const campaignId = submission.task.campaign.id;
    const participation = await prisma.campaignParticipation.findUnique({
      where: { campaignId_userId: { campaignId, userId: reviewerId } },
    });

    if (!participation || !['REVIEWER', 'EDITOR', 'ADMIN'].includes(participation.role)) {
      return res.status(403).json({
        success: false,
        error: { message: 'You do not have reviewer access to this campaign' },
      });
    }

    // Only review PENDING submissions
    if (submission.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: { message: 'Submission has already been reviewed' },
      });
    }

    const newStatus = approved ? 'APPROVED' : 'REJECTED';

    // Update submission status
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: newStatus,
        reviewedAt: new Date(),
      },
    });

    // Create review record
    const review = await prisma.review.create({
      data: {
        submissionId,
        reviewerId,
        approved,
        feedback: feedback || null,
        reviewedAt: new Date(),
      },
    });

    // If approved, update user stats
    if (approved) {
      await prisma.userProfile.updateMany({
        where: { userId: submission.userId },
        data: {
          experiencePoints: { increment: submission.task.experiencePoints },
          totalEarned: { increment: submission.task.reward },
          tasksCompleted: { increment: 1 },
        },
      });

      // Update campaign participation
      await prisma.campaignParticipation.updateMany({
        where: {
          campaignId,
          userId: submission.userId,
        },
        data: {
          tasksCompleted: { increment: 1 },
        },
      });
    }

    res.json({
      success: true,
      data: { review, status: newStatus },
      message: `Submission ${approved ? 'approved' : 'rejected'} successfully`,
    });
  } catch (error) {
    console.error('Reviewer review error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to review submission' },
    });
  }
});

/**
 * @route   GET /api/v1/roles/my-roles
 * @desc    Get current user's roles across all campaigns
 * @access  Private
 */
router.get('/my-roles', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;

    const roles = await prisma.campaignParticipation.findMany({
      where: {
        userId,
        role: { not: 'MINER' }, // Only show non-default roles
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            status: true,
            token: { select: { name: true, symbol: true, logoUrl: true } },
          },
        },
      },
    });

    // Count pending submissions for reviewer
    const pendingReviewCount = await prisma.submission.count({
      where: {
        task: {
          campaignId: {
            in: roles.map((r) => r.campaignId),
          },
        },
        userId: { not: userId },
        status: 'PENDING',
      },
    });

    res.json({
      success: true,
      data: {
        roles,
        pendingReviewCount,
      },
    });
  } catch (error) {
    console.error('Get my roles error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to load roles' },
    });
  }
});

export default router;