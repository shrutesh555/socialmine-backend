import { Request, Response } from 'express';
import prisma from '../config/database';
import { PaymentStatus } from '@prisma/client';

// ============================================
// CREATE PAYMENT (CAMPAIGN OWNER)
// ============================================
export const createPayment = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const {
      campaignId,
      recipientId,
      amount,
      tokenSymbol,
      blockchain,
      txHash,
    } = req.body;

    // Verify campaign exists and user is owner
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        token: true,
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
          message: 'Only campaign owner can create payments',
        },
      });
    }

    // Verify recipient is a campaign participant
    const participation = await prisma.campaignParticipation.findUnique({
      where: {
        campaignId_userId: {
          campaignId,
          userId: recipientId,
        },
      },
    });

    if (!participation) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NOT_PARTICIPANT',
          message: 'Recipient is not a participant in this campaign',
        },
      });
    }

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        campaignId,
        senderId: userId,
        recipientId,
        amount,
        tokenSymbol: tokenSymbol || campaign.token.symbol,
        blockchain: blockchain || campaign.token.blockchain,
        txHash,
        status: txHash ? 'COMPLETED' : 'PENDING',
        ...(txHash && { completedAt: new Date() }),
      },
      include: {
        campaign: {
          select: {
            name: true,
            token: {
              select: {
                name: true,
                symbol: true,
              },
            },
          },
        },
        recipient: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    // Update user's total earned if payment is completed
    if (txHash) {
      await prisma.userProfile.update({
        where: { userId: recipientId },
        data: {
          totalEarned: {
            increment: amount,
          },
        },
      });

      // Send notification
      await prisma.notification.create({
        data: {
          userId: recipientId,
          type: 'PAYMENT_RECEIVED',
          message: `You received ${amount} ${tokenSymbol} from ${campaign.name}!`,
        },
      });
    }

    return res.status(201).json({
      success: true,
      data: payment,
      message: 'Payment created successfully',
    });
  } catch (error) {
    console.error('Create payment error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create payment',
      },
    });
  }
};

// ============================================
// GET PAYMENT HISTORY
// ============================================
export const getPaymentHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { 
      campaignId, 
      status, 
      type = 'received', 
      page = '1', 
      limit = '20' 
    } = req.query;

    // Build filter
    const where: any = type === 'sent' 
      ? { senderId: userId }
      : { recipientId: userId };

    if (campaignId) {
      where.campaignId = campaignId as string;
    }

    if (status) {
      where.status = status as PaymentStatus;
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
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
          sender: {
            select: {
              username: true,
            },
          },
          recipient: {
            select: {
              username: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.payment.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch payment history',
      },
    });
  }
};

// ============================================
// GET PENDING PAYMENTS (OWNER)
// ============================================
export const getPendingPayments = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { campaignId } = req.query;

    const where: any = {
      senderId: userId,
      status: 'PENDING',
    };

    if (campaignId) {
      where.campaignId = campaignId as string;
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        campaign: {
          select: {
            name: true,
            token: {
              select: {
                name: true,
                symbol: true,
              },
            },
          },
        },
        recipient: {
          select: {
            username: true,
            email: true,
            walletAddresses: {
              where: {
                isPrimary: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error) {
    console.error('Get pending payments error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch pending payments',
      },
    });
  }
};

// ============================================
// PROCESS PAYMENT (Mark as completed)
// ============================================
export const processPayment = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const id = req.params.id as string;
    const { txHash, status } = req.body;

    // Get payment
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        campaign: true,
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Payment not found',
        },
      });
    }

    // Verify user is sender
    if (payment.senderId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only payment sender can process this payment',
        },
      });
    }

    // Update payment
    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: {
        status: status as PaymentStatus,
        ...(txHash && { txHash }),
        ...(status === 'COMPLETED' && { completedAt: new Date() }),
        ...(status === 'FAILED' && { failureReason: req.body.failureReason }),
      },
    });

    // Update user's total earned if completed
    if (status === 'COMPLETED') {
      await prisma.userProfile.update({
        where: { userId: payment.recipientId },
        data: {
          totalEarned: {
            increment: payment.amount,
          },
        },
      });

      // Send notification
      await prisma.notification.create({
        data: {
          userId: payment.recipientId,
          type: 'PAYMENT_RECEIVED',
          message: `Payment of ${payment.amount} ${payment.tokenSymbol} has been processed!`,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: updatedPayment,
      message: 'Payment processed successfully',
    });
  } catch (error) {
    console.error('Process payment error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process payment',
      },
    });
  }
};

// ============================================
// GET PAYMENT BY ID
// ============================================
export const getPaymentById = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const id = req.params.id as string;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        campaign: {
          include: {
            token: true,
          },
        },
        sender: {
          select: {
            username: true,
          },
        },
        recipient: {
          select: {
            username: true,
            walletAddresses: true,
          },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Payment not found',
        },
      });
    }

    // Check authorization
    if (payment.senderId !== userId && payment.recipientId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this payment',
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error('Get payment error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch payment',
      },
    });
  }
};

// ============================================
// GET USER EARNINGS SUMMARY
// ============================================
export const getUserEarnings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    // Get total earnings by token
    const payments = await prisma.payment.findMany({
      where: {
        recipientId: userId,
        status: 'COMPLETED',
      },
      select: {
        amount: true,
        tokenSymbol: true,
        blockchain: true,
        completedAt: true,
      },
    });

    // Group by token
    const earningsByToken = payments.reduce((acc: any, payment) => {
      const key = `${payment.tokenSymbol}-${payment.blockchain}`;
      if (!acc[key]) {
        acc[key] = {
          tokenSymbol: payment.tokenSymbol,
          blockchain: payment.blockchain,
          totalAmount: 0,
          transactionCount: 0,
        };
      }
      acc[key].totalAmount += Number(payment.amount);
      acc[key].transactionCount += 1;
      return acc;
    }, {});

    // Get user profile for total earned
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    return res.status(200).json({
      success: true,
      data: {
        totalEarned: profile?.totalEarned || 0,
        earningsByToken: Object.values(earningsByToken),
        totalTransactions: payments.length,
      },
    });
  } catch (error) {
    console.error('Get user earnings error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch user earnings',
      },
    });
  }
};

// ============================================
// DISTRIBUTE CAMPAIGN REWARDS (Bulk payment)
// ============================================
export const distributeCampaignRewards = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { campaignId } = req.body;

    // Verify campaign and ownership
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        token: true,
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
          message: 'Only campaign owner can distribute rewards',
        },
      });
    }

    // Get all approved submissions with rewards
    const approvedSubmissions = await prisma.submission.findMany({
      where: {
        task: {
          campaignId,
        },
        status: 'APPROVED',
      },
      include: {
        task: true,
        user: true,
      },
    });

    if (approvedSubmissions.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_APPROVED_SUBMISSIONS',
          message: 'No approved submissions to pay',
        },
      });
    }

    // Calculate rewards per user
    const rewardsByUser = approvedSubmissions.reduce((acc: any, submission) => {
      const userId = submission.userId;
      if (!acc[userId]) {
        acc[userId] = {
          userId,
          username: submission.user.username,
          totalTokens: 0,
        };
      }
      acc[userId].totalTokens += Number(submission.task.reward);
      return acc;
    }, {});

    // Create payments for each user
    const payments = await Promise.all(
      Object.values(rewardsByUser).map((reward: any) =>
        prisma.payment.create({
          data: {
            campaignId,
            senderId: userId,
            recipientId: reward.userId,
            amount: reward.totalTokens,
            tokenSymbol: campaign.token.symbol,
            blockchain: campaign.token.blockchain,
            status: 'PENDING',
          },
        })
      )
    );

    return res.status(201).json({
      success: true,
      data: {
        paymentsCreated: payments.length,
        totalAmount: Object.values(rewardsByUser).reduce(
          (sum: number, r: any) => sum + r.totalTokens,
          0
        ),
        payments,
      },
      message: `${payments.length} payments created successfully`,
    });
  } catch (error) {
    console.error('Distribute rewards error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to distribute rewards',
      },
    });
  }
};