import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route   POST /api/v1/referrals/generate
 * @desc    Generate referral code for miner for a specific campaign/task
 * @access  Private (Miner)
 */
router.post('/generate', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const { campaignId, taskId } = req.body;

    if (!campaignId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Campaign ID is required' }
      });
    }

    // Check if referral code already exists for this user/campaign/task
    const existing = await prisma.referralCode.findFirst({
      where: {
        userId,
        campaignId,
        taskId: taskId || null
      }
    });

    if (existing) {
      return res.json({
        success: true,
        data: { referralCode: existing }
      });
    }

    // Generate unique code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();

    // Create referral code
    const referralCode = await prisma.referralCode.create({
      data: {
        code,
        userId,
        campaignId,
        taskId: taskId || null
      }
    });

    res.json({
      success: true,
      data: { referralCode }
    });
  } catch (error) {
    console.error('Generate referral code error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to generate referral code' }
    });
  }
});

/**
 * @route   GET /api/v1/referrals/my-stats
 * @desc    Get miner's referral statistics
 * @access  Private (Miner)
 */
router.get('/my-stats', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;

    // Get all referral codes for this user
    const referralCodes = await prisma.referralCode.findMany({
      where: { userId },
      include: {
        campaign: {
          select: {
            name: true,
            id: true
          }
        },
        task: {
          select: {
            title: true,
            reward: true,
            experiencePoints: true
          }
        }
      }
    });

    // Get all users referred by this user
    const referrals = await prisma.user.findMany({
      where: { referredBy: userId },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        profile: {
          select: {
            totalEarned: true,
            experiencePoints: true
          }
        }
      }
    });

    // Calculate total earnings from referrals
    const totalReferrals = referrals.length;
    const totalEarnings = referralCodes.reduce((sum, code) => {
      return sum + (code.timesUsed * parseFloat(code.task?.reward?.toString() || '0'));
    }, 0);

    const totalXP = referralCodes.reduce((sum, code) => {
      return sum + (code.timesUsed * (code.task?.experiencePoints || 0));
    }, 0);

    res.json({
      success: true,
      data: {
        referralCodes,
        referrals,
        stats: {
          totalReferrals,
          totalEarnings,
          totalXP,
          activeReferralCodes: referralCodes.filter(c => c.isActive).length
        }
      }
    });
  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to load referral stats' }
    });
  }
});

/**
 * @route   GET /api/v1/referrals/campaign/:campaignId/stats
 * @desc    Get referral stats for a campaign (Owner view)
 * @access  Private (Owner)
 */
router.get('/campaign/:campaignId/stats', authenticate, async (req: any, res) => {
  try {
    const { campaignId } = req.params;
    const ownerId = req.user.userId;

    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        ownerId
      }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: { message: 'Campaign not found' }
      });
    }

    // Get all referral codes for this campaign
    const referralCodes = await prisma.referralCode.findMany({
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
                avatarUrl: true
              }
            }
          }
        },
        task: {
          select: {
            title: true,
            reward: true,
            experiencePoints: true
          }
        }
      },
      orderBy: {
        timesUsed: 'desc'
      }
    });

    // Calculate totals
    const totalReferralCodes = referralCodes.length;
    const totalReferrals = referralCodes.reduce((sum, code) => sum + code.timesUsed, 0);
    const activeReferrers = referralCodes.filter(c => c.timesUsed > 0).length;

    // Top referrers
    const topReferrers = referralCodes
      .filter(c => c.timesUsed > 0)
      .slice(0, 10)
      .map(code => ({
        user: code.user,
        referrals: code.timesUsed,
        code: code.code,
        earnings: code.timesUsed * parseFloat(code.task?.reward?.toString() || '0'),
        xp: code.timesUsed * (code.task?.experiencePoints || 0)
      }));

    res.json({
      success: true,
      data: {
        stats: {
          totalReferralCodes,
          totalReferrals,
          activeReferrers
        },
        topReferrers,
        allReferralCodes: referralCodes
      }
    });
  } catch (error) {
    console.error('Get campaign referral stats error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to load campaign referral stats' }
    });
  }
});

/**
 * @route   GET /api/v1/referrals/validate/:code
 * @desc    Validate referral code and return campaign details (for signup page)
 * @access  Public
 */
router.get('/validate/:code', async (req, res) => {
  try {
    const { code } = req.params;

    console.log('🔍 Validating referral code:', code);

    const referralCode = await prisma.referralCode.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            description: true,
            imageUrl: true,
            status: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            reward: true,
            experiencePoints: true,
          },
        },
        user: {
          select: {
            username: true,
          },
        },
      },
    });

    if (!referralCode) {
      return res.status(404).json({ 
        success: false,
        error: { message: 'Referral code not found' }
      });
    }

    if (!referralCode.isActive) {
      return res.status(400).json({ 
        success: false,
        error: { message: 'Referral code is no longer active' }
      });
    }

    if (referralCode.expiresAt && new Date(referralCode.expiresAt) < new Date()) {
      return res.status(400).json({ 
        success: false,
        error: { message: 'Referral code has expired' }
      });
    }

    if (referralCode.maxUses && referralCode.timesUsed >= referralCode.maxUses) {
      return res.status(400).json({ 
        success: false,
        error: { message: 'Referral code has reached maximum usage' }
      });
    }

    if (referralCode.campaign.status !== 'ACTIVE') {
      return res.status(400).json({ 
        success: false,
        error: { message: 'Campaign is not active' }
      });
    }

    console.log('✅ Referral code is valid');

    return res.json({
      success: true,
      data: {
        code: referralCode.code,
        campaign: referralCode.campaign,
        task: referralCode.task,
        referrer: {
          username: referralCode.user.username,
        },
      }
    });
  } catch (error) {
    console.error('❌ Error validating referral code:', error);
    return res.status(500).json({ 
      success: false,
      error: { message: 'Failed to validate referral code' }
    });
  }
});

/**
 * @route   POST /api/v1/referrals/validate
 * @desc    Validate and apply referral code during signup/join
 * @access  Public
 */
router.post('/validate', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: { message: 'Referral code is required' }
      });
    }

    // Find referral code
    const referralCode = await prisma.referralCode.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        },
        campaign: {
          select: {
            id: true,
            name: true
          }
        },
        task: {
          select: {
            id: true,
            title: true,
            reward: true,
            experiencePoints: true
          }
        }
      }
    });

    if (!referralCode) {
      return res.status(404).json({
        success: false,
        error: { message: 'Invalid referral code' }
      });
    }

    // Check if active
    if (!referralCode.isActive) {
      return res.status(400).json({
        success: false,
        error: { message: 'Referral code is inactive' }
      });
    }

    // Check if expired
    if (referralCode.expiresAt && referralCode.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Referral code has expired' }
      });
    }

    // Check max uses
    if (referralCode.maxUses && referralCode.timesUsed >= referralCode.maxUses) {
      return res.status(400).json({
        success: false,
        error: { message: 'Referral code has reached maximum uses' }
      });
    }

    res.json({
      success: true,
      data: { referralCode }
    });
  } catch (error) {
    console.error('Validate referral code error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to validate referral code' }
    });
  }
});

/**
 * @route   POST /api/v1/referrals/apply
 * @desc    Apply referral code (increment usage, link users)
 * @access  Private
 */
router.post('/apply', authenticate, async (req: any, res) => {
  try {
    const newUserId = req.user.userId;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: { message: 'Referral code is required' }
      });
    }

    // Find referral code
    const referralCode = await prisma.referralCode.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (!referralCode || !referralCode.isActive) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid or inactive referral code' }
      });
    }

    // Can't refer yourself
    if (referralCode.userId === newUserId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot use your own referral code' }
      });
    }

    // Check if user already has a referrer
    const user = await prisma.user.findUnique({
      where: { id: newUserId }
    });

    if (user?.referredBy) {
      return res.status(400).json({
        success: false,
        error: { message: 'You already used a referral code' }
      });
    }

    // Apply referral
    await prisma.$transaction([
      // Update user's referredBy
      prisma.user.update({
        where: { id: newUserId },
        data: { referredBy: referralCode.userId }
      }),
      // Increment referral code usage
      prisma.referralCode.update({
        where: { id: referralCode.id },
        data: { timesUsed: { increment: 1 } }
      }),
      // Award rewards to referrer if task exists
      ...(referralCode.taskId ? [
        prisma.userProfile.update({
          where: { userId: referralCode.userId },
          data: {
            totalEarned: { increment: await getReferralReward(referralCode.taskId) },
            experiencePoints: { increment: await getReferralXP(referralCode.taskId) }
          }
        })
      ] : [])
    ]);

    res.json({
      success: true,
      message: 'Referral code applied successfully'
    });
  } catch (error) {
    console.error('Apply referral code error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to apply referral code' }
    });
  }
});

// Helper functions
async function getReferralReward(taskId: string): Promise<number> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { reward: true }
  });
  return parseFloat(task?.reward?.toString() || '0');
}

async function getReferralXP(taskId: string): Promise<number> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { experiencePoints: true }
  });
  return task?.experiencePoints || 0;
}

export default router;