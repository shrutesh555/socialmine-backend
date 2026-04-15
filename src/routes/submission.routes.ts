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
        task: true
      }
    });

    if (!existingSubmission) {
      return res.status(404).json({
        success: false,
        error: { message: 'Submission not found' }
      });
    }

    // Update submission
    const submission = await prisma.submission.update({
      where: { id: submissionId },
      data: { 
        status: 'APPROVED',
        reviewedAt: new Date()
      }
    });

    // ✅ Send notification to miner
    await notifySubmissionApproved(
      existingSubmission.userId,
      existingSubmission.task.title,
      parseFloat(existingSubmission.task.reward.toString()),
      existingSubmission.task.experiencePoints
    );

    res.json({ success: true, data: submission });
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

    // Update submission
    const submission = await prisma.submission.update({
      where: { id: submissionId },
      data: { 
        status: 'REJECTED',
        reviewedAt: new Date()
      }
    });

    // ✅ Send notification to miner
    await notifySubmissionRejected(existingSubmission.userId, existingSubmission.task.title);

    res.json({ success: true, data: submission });
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