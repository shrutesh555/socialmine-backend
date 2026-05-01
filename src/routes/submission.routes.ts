import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  submitTaskProof,
  getMySubmissions,
  getSubmissionById,
  getCampaignSubmissions,
  getTaskSubmissions,
  updateSubmission,
  deleteSubmission,
} from '../controllers/submission.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate, submissionCreateSchema, submissionUpdateSchema } from '../utils/validation.util';
import { notifySubmissionApproved, notifySubmissionRejected } from '../services/notification.service';

const router = Router();
const prisma = new PrismaClient();

router.post('/', authenticate, validate(submissionCreateSchema), submitTaskProof);

router.get('/review', authenticate, async (req: any, res) => {
  try {
    const submissions = await prisma.submission.findMany({
      where: {
        task: {
          campaign: {
            ownerId: req.user.userId
          }
        }
      },
      include: {
        task: {
          include: {
            campaign: {
              include: { token: true }
            }
          }
        },
        user: true
      },
      orderBy: { 
        id: 'desc'
      }
    });
    
    res.json({ success: true, data: { submissions } });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: 'Failed to get submissions' } });
  }
});

router.post('/:id/approve', authenticate, async (req: any, res) => {
  try {
    const submissionId = String(req.params.id);

    // Get submission with task details
    const existingSubmission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        task: {
          include: {
            campaign: true
          }
        }
      }
    });

    if (!existingSubmission) {
      return res.status(404).json({
        success: false,
        error: { message: 'Submission not found' }
      });
    }

    // Check if already approved
    if (existingSubmission.status === 'APPROVED') {
      return res.status(400).json({
        success: false,
        error: { message: 'Submission already approved' }
      });
    }

    // Perform all updates in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update submission status
      const submission = await tx.submission.update({
        where: { id: submissionId },
        data: { 
          status: 'APPROVED',
          reviewedAt: new Date()
        }
      });

      // 2. Update miner's profile - XP + tokens + tasks completed
      await tx.userProfile.update({
        where: { userId: existingSubmission.userId },
        data: {
          experiencePoints: {
            increment: existingSubmission.task.experiencePoints,
          },
          totalEarned: {
            increment: parseFloat(existingSubmission.task.reward.toString()),
          },
          tasksCompleted: {
            increment: 1,
          },
        },
      });

      // 3. Update campaign participation progress
      const participation = await tx.campaignParticipation.findUnique({
        where: {
          campaignId_userId: {
            campaignId: existingSubmission.task.campaignId,
            userId: existingSubmission.userId,
          },
        },
      });

      if (participation) {
        const newTasksCompleted = participation.tasksCompleted + 1;
        const isCompleted = newTasksCompleted >= participation.totalTasks;

        await tx.campaignParticipation.update({
          where: {
            campaignId_userId: {
              campaignId: existingSubmission.task.campaignId,
              userId: existingSubmission.userId,
            },
          },
          data: {
            tasksCompleted: newTasksCompleted,
            ...(isCompleted && { completedAt: new Date() }),
          },
        });
      }

      // 4. Create review record
      await tx.review.create({
        data: {
          submissionId,
          reviewerId: req.user.userId,
          approved: true,
          feedback: req.body.feedback || null,
        },
      });

      return submission;
    });

    // Send notification to miner (outside transaction)
    await notifySubmissionApproved(
      existingSubmission.userId,
      existingSubmission.task.title,
      parseFloat(existingSubmission.task.reward.toString()),
      existingSubmission.task.experiencePoints
    );

    console.log(`✅ Approved submission ${submissionId} — awarded ${existingSubmission.task.experiencePoints} XP + ${existingSubmission.task.reward} tokens to user ${existingSubmission.userId}`);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Approve submission error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to approve' } });
  }
});

router.post('/:id/reject', authenticate, async (req: any, res) => {
  try {
    const submissionId = String(req.params.id);

    // Get submission with task details
    const existingSubmission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        task: true
      }
    });

    if (!existingSubmission) {
      return res.status(404).json({
        success: false,
        error: { message: 'Submission not found' }
      });
    }

    // Check if already reviewed
    if (existingSubmission.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: { message: 'Submission already reviewed' }
      });
    }

    // Update submission and create review in transaction
    const result = await prisma.$transaction(async (tx) => {
      const submission = await tx.submission.update({
        where: { id: submissionId },
        data: { 
          status: 'REJECTED',
          reviewedAt: new Date()
        }
      });

      await tx.review.create({
        data: {
          submissionId,
          reviewerId: req.user.userId,
          approved: false,
          feedback: req.body.feedback || null,
        },
      });

      return submission;
    });

    // Send notification to miner
    await notifySubmissionRejected(existingSubmission.userId, existingSubmission.task.title);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Reject submission error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to reject' } });
  }
});

router.get('/', authenticate, getMySubmissions);
router.get('/:id', authenticate, getSubmissionById);
router.get('/campaign/:campaignId', authenticate, getCampaignSubmissions);
router.get('/task/:taskId', getTaskSubmissions);
router.patch('/:id', authenticate, validate(submissionUpdateSchema), updateSubmission);
router.delete('/:id', authenticate, deleteSubmission);

export default router;