import { Request, Response } from 'express';
import prisma from '../config/database';
import { SubmissionStatus } from '@prisma/client';

// ============================================
// SUBMIT TASK PROOF (MINER only)
// ============================================
export const submitTaskProof = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const userType = (req as any).user?.userType;

    // Check if user is MINER or BOTH
    if (userType !== 'MINER' && userType !== 'BOTH') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only miners can submit task proofs',
        },
      });
    }

    const { taskId, proofUrl, proofText, proofFiles } = req.body;

    // Verify task exists
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        campaign: true,
      },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Task not found',
        },
      });
    }

    // Check if campaign is active
    if (task.campaign.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CAMPAIGN_NOT_ACTIVE',
          message: 'Campaign is not active',
        },
      });
    }

    // Check if user has joined the campaign
    const participation = await prisma.campaignParticipation.findUnique({
      where: {
        campaignId_userId: {
          campaignId: task.campaignId,
          userId,
        },
      },
    });

    if (!participation) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NOT_PARTICIPANT',
          message: 'You must join the campaign before submitting tasks',
        },
      });
    }

    // Check if already submitted
    const existingSubmission = await prisma.submission.findFirst({
      where: {
        taskId,
        userId,
      },
    });

    if (existingSubmission) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_SUBMITTED',
          message: 'You have already submitted this task',
        },
      });
    }

    // Create submission
    const submission = await prisma.submission.create({
      data: {
        taskId,
        userId,
        proofUrl,
        proofText,
        proofFiles: proofFiles || [],
        status: 'PENDING',
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            type: true,
            experiencePoints: true,
            reward: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      data: submission,
      message: 'Task proof submitted successfully',
    });
  } catch (error) {
    console.error('Submit task proof error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to submit task proof',
      },
    });
  }
};

// ============================================
// GET MY SUBMISSIONS (MINER)
// ============================================
export const getMySubmissions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { status, campaignId, page = '1', limit = '10' } = req.query;

    // Build filter
    const where: any = {
      userId,
    };

    if (status) {
      where.status = status as SubmissionStatus;
    }

    if (campaignId) {
      where.task = {
        campaignId: campaignId as string,
      };
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        include: {
          task: {
            include: {
              campaign: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                  token: {
                    select: {
                      name: true,
                      symbol: true,
                      logoUrl: true,
                    },
                  },
                },
              },
            },
          },
          review: true,
        },
        orderBy: {
          submittedAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.submission.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        submissions,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('Get my submissions error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch submissions',
      },
    });
  }
};

// ============================================
// GET SUBMISSION BY ID
// ============================================
export const getSubmissionById = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const id = req.params.id as string;

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        task: {
          include: {
            campaign: {
              include: {
                token: {
                  select: {
                    name: true,
                    symbol: true,
                    logoUrl: true,
                  },
                },
              },
            },
          },
        },
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
              },
            },
          },
        },
        review: true,
      },
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Submission not found',
        },
      });
    }

    // Check authorization - user must be submitter or campaign owner
    if (submission.userId !== userId && submission.task.campaign.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this submission',
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: submission,
    });
  } catch (error) {
    console.error('Get submission error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch submission',
      },
    });
  }
};

// ============================================
// GET CAMPAIGN SUBMISSIONS (OWNER)
// ============================================
export const getCampaignSubmissions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const campaignId = req.params.campaignId as string;
    const { status, page = '1', limit = '20' } = req.query;

    // Verify campaign exists and user is owner
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

    if (campaign.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only view submissions for your own campaigns',
        },
      });
    }

    // Build filter
    const where: any = {
      task: {
        campaignId,
      },
    };

    if (status) {
      where.status = status as SubmissionStatus;
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        include: {
          task: {
            select: {
              id: true,
              title: true,
              type: true,
              experiencePoints: true,
              reward: true,
            },
          },
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
                },
              },
            },
          },
          review: true,
        },
        orderBy: {
          submittedAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.submission.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        submissions,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('Get campaign submissions error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch submissions',
      },
    });
  }
};

// ============================================
// GET TASK SUBMISSIONS
// ============================================
export const getTaskSubmissions = async (req: Request, res: Response) => {
  try {
    const taskId = req.params.taskId as string;

    // Verify task exists
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        campaign: true,
      },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Task not found',
        },
      });
    }

    const submissions = await prisma.submission.findMany({
      where: {
        taskId,
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
              },
            },
          },
        },
        review: true,
      },
      orderBy: {
        submittedAt: 'desc',
      },
    });

    return res.status(200).json({
      success: true,
      data: submissions,
    });
  } catch (error) {
    console.error('Get task submissions error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch submissions',
      },
    });
  }
};

// ============================================
// UPDATE SUBMISSION (MINER, if PENDING)
// ============================================
export const updateSubmission = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const id = req.params.id as string;

    const existingSubmission = await prisma.submission.findUnique({
      where: { id },
    });

    if (!existingSubmission) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Submission not found',
        },
      });
    }

    // Only submitter can update
    if (existingSubmission.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only update your own submissions',
        },
      });
    }

    // Can only update if pending
    if (existingSubmission.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'You can only update pending submissions',
        },
      });
    }

    const { proofUrl, proofText, proofFiles } = req.body;

    const submission = await prisma.submission.update({
      where: { id },
      data: {
        ...(proofUrl !== undefined && { proofUrl }),
        ...(proofText !== undefined && { proofText }),
        ...(proofFiles !== undefined && { proofFiles }),
      },
      include: {
        task: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: submission,
      message: 'Submission updated successfully',
    });
  } catch (error) {
    console.error('Update submission error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update submission',
      },
    });
  }
};

// ============================================
// DELETE SUBMISSION (MINER, if PENDING)
// ============================================
export const deleteSubmission = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const id = req.params.id as string;

    const submission = await prisma.submission.findUnique({
      where: { id },
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Submission not found',
        },
      });
    }

    // Only submitter can delete
    if (submission.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only delete your own submissions',
        },
      });
    }

    // Can only delete if pending
    if (submission.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'You can only delete pending submissions',
        },
      });
    }

    await prisma.submission.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Submission deleted successfully',
    });
  } catch (error) {
    console.error('Delete submission error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete submission',
      },
    });
  }
};