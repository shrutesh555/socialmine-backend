import { Request, Response } from 'express';
import prisma from '../config/database';

// ============================================
// REVIEW SUBMISSION (CAMPAIGN OWNER only)
// ============================================

export const reviewSubmission = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { submissionId, approved, rating, feedback } = req.body;

    // Get submission with task and campaign details
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        task: {
          include: {
            campaign: {
              include: {
                token: {
                  select: {
                    name: true,
                    symbol: true,
                  },
                },
              },
            },
          },
        },
        user: true,
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

    // Verify user is campaign owner
    if (submission.task.campaign.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only campaign owner can review submissions',
        },
      });
    }

    // Check if already reviewed
    const existingReview = await prisma.review.findUnique({
      where: { submissionId },
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_REVIEWED',
          message: 'This submission has already been reviewed',
        },
      });
    }

    // Validate rating if approved
    if (approved && rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_RATING',
          message: 'Rating must be between 1 and 5',
        },
      });
    }

    // Perform review in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create review
      const review = await tx.review.create({
        data: {
          submissionId,
          reviewerId: userId,
          approved,
          rating: approved ? rating : null,
          feedback,
        },
      });

      // Update submission status
      const updatedSubmission = await tx.submission.update({
        where: { id: submissionId },
        data: {
          status: approved ? 'APPROVED' : 'REJECTED',
          reviewedAt: new Date(),
        },
      });

      if (approved) {
        // Award XP AND tokens to user profile
        await tx.userProfile.update({
          where: { userId: submission.userId },
          data: {
            experiencePoints: {
              increment: submission.task.experiencePoints,
            },
            totalEarned: {
              increment: parseFloat(submission.task.reward.toString()),
            },
            tasksCompleted: {
              increment: 1,
            },
          },
        });

        // Update campaign participation
        const participation = await tx.campaignParticipation.findUnique({
          where: {
            campaignId_userId: {
              campaignId: submission.task.campaignId,
              userId: submission.userId,
            },
          },
        });

        if (participation) {
          const newTasksCompleted = participation.tasksCompleted + 1;
          const isCompleted = newTasksCompleted >= participation.totalTasks;

          await tx.campaignParticipation.update({
            where: {
              campaignId_userId: {
                campaignId: submission.task.campaignId,
                userId: submission.userId,
              },
            },
            data: {
              tasksCompleted: newTasksCompleted,
              ...(isCompleted && { completedAt: new Date() }),
            },
          });
        }

        // Send notification to miner
        await tx.notification.create({
          data: {
            userId: submission.userId,
            type: 'TASK_APPROVED',
            message: `Your submission for "${submission.task.title}" has been approved! You earned ${submission.task.experiencePoints} XP and ${submission.task.reward} ${submission.task.campaign.token?.symbol || 'tokens'}.`,
          },
        });
      } else {
        // Send rejection notification
        await tx.notification.create({
          data: {
            userId: submission.userId,
            type: 'TASK_REJECTED',
            message: `Your submission for "${submission.task.title}" was rejected. ${feedback ? 'Feedback: ' + feedback : ''}`,
          },
        });
      }

      return { review, updatedSubmission };
    });

    return res.status(201).json({
      success: true,
      data: result,
      message: `Submission ${approved ? 'approved' : 'rejected'} successfully`,
    });
  } catch (error) {
    console.error('Review submission error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to review submission',
      },
    });
  }
};

// ============================================
// GET PENDING REVIEWS (OWNER)
// ============================================
export const getPendingReviews = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { campaignId, page = '1', limit = '20' } = req.query;

    // Build filter - get submissions for owner's campaigns that are pending
    const where: any = {
      status: 'PENDING',
      task: {
        campaign: {
          ownerId: userId,
        },
      },
    };

    if (campaignId) {
      where.task.campaign.id = campaignId as string;
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
                  tasksCompleted: true,
                  approvalRate: true,
                },
              },
            },
          },
        },
        orderBy: {
          submittedAt: 'asc',
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
    console.error('Get pending reviews error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch pending reviews',
      },
    });
  }
};

// ============================================
// GET REVIEW BY ID
// ============================================
export const getReviewById = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const id = req.params.id as string;

    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        submission: {
          include: {
            task: {
              include: {
                campaign: true,
              },
            },
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
          },
        },
        reviewer: {
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
      },
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Review not found',
        },
      });
    }

    // Check authorization - user must be reviewer or submission owner
    if (review.reviewerId !== userId && review.submission.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this review',
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: review,
    });
  } catch (error) {
    console.error('Get review error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch review',
      },
    });
  }
};

// ============================================
// BULK REVIEW SUBMISSIONS
// ============================================
export const bulkReviewSubmissions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { reviews } = req.body;

    // Validate all submissions belong to user's campaigns
    const submissionIds = reviews.map((r: any) => r.submissionId);
    const submissions = await prisma.submission.findMany({
      where: {
        id: { in: submissionIds },
      },
      include: {
        task: {
          include: {
            campaign: true,
          },
        },
      },
    });

    // Verify ownership
    const unauthorized = submissions.some(s => s.task.campaign.ownerId !== userId);
    if (unauthorized) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only review submissions for your own campaigns',
        },
      });
    }

    // Check for already reviewed submissions
    const existingReviews = await prisma.review.findMany({
      where: {
        submissionId: { in: submissionIds },
      },
    });

    if (existingReviews.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_REVIEWED',
          message: 'Some submissions have already been reviewed',
        },
      });
    }

    // Process bulk reviews in transaction
    const results = await prisma.$transaction(
      reviews.map((reviewData: any) => {
        const submission = submissions.find(s => s.id === reviewData.submissionId);
        if (!submission) return null;

        return prisma.review.create({
          data: {
            submissionId: reviewData.submissionId,
            reviewerId: userId,
            approved: reviewData.approved,
            rating: reviewData.approved ? reviewData.rating : null,
            feedback: reviewData.feedback,
          },
        });
      })
    );

    // Update submission statuses
    await Promise.all(
      reviews.map(async (reviewData: any) => {
        const submission = submissions.find(s => s.id === reviewData.submissionId);
        if (!submission) return;

        await prisma.submission.update({
          where: { id: reviewData.submissionId },
          data: {
            status: reviewData.approved ? 'APPROVED' : 'REJECTED',
            reviewedAt: new Date(),
          },
        });

        // Award XP AND tokens if approved
        if (reviewData.approved) {
          await prisma.userProfile.update({
            where: { userId: submission.userId },
            data: {
              experiencePoints: {
                increment: submission.task.experiencePoints,
              },
              totalEarned: {
                increment: parseFloat(submission.task.reward.toString()),
              },
              tasksCompleted: {
                increment: 1,
              },
            },
          });

          // Send notification
          await prisma.notification.create({
            data: {
              userId: submission.userId,
              type: 'TASK_APPROVED',
              message: `Your submission for "${submission.task.title}" has been approved!`,
            },
          });
        }
      })
    );

    return res.status(201).json({
      success: true,
      data: results,
      message: `${reviews.length} submissions reviewed successfully`,
    });
  } catch (error) {
    console.error('Bulk review error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process bulk reviews',
      },
    });
  }
};

// ============================================
// GET REVIEW STATISTICS
// ============================================
export const getReviewStatistics = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { campaignId } = req.query;

    const where: any = {
      task: {
        campaign: {
          ownerId: userId,
        },
      },
    };

    if (campaignId) {
      where.task.campaign.id = campaignId as string;
    }

    const [totalSubmissions, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      prisma.submission.count({ where }),
      prisma.submission.count({ where: { ...where, status: 'PENDING' } }),
      prisma.submission.count({ where: { ...where, status: 'APPROVED' } }),
      prisma.submission.count({ where: { ...where, status: 'REJECTED' } }),
    ]);

    const approvalRate = totalSubmissions > 0 
      ? ((approvedCount / totalSubmissions) * 100).toFixed(2) 
      : '0.00';

    return res.status(200).json({
      success: true,
      data: {
        total: totalSubmissions,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        approvalRate: parseFloat(approvalRate),
      },
    });
  } catch (error) {
    console.error('Get review statistics error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch review statistics',
      },
    });
  }
};