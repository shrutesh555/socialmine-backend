import { Request, Response } from 'express';
import prisma from '../config/database';
import { CampaignType, CampaignStatus } from '@prisma/client';

// ============================================
// CREATE CAMPAIGN (PROJECT_OWNER only)
// ============================================
export const createCampaign = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const userType = (req as any).user?.userType;

    // Check if user is PROJECT_OWNER or BOTH
    if (userType !== 'PROJECT_OWNER' && userType !== 'BOTH') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only project owners can create campaigns',
        },
      });
    }

    const {
      tokenId,
      name,
      description,
      imageUrl,
      type,
      startDate,
      endDate,
      totalRewardPool,
      participantLimit,
    } = req.body;

    // Verify token exists and belongs to user
    const token = await prisma.token.findUnique({
      where: { id: tokenId },
    });

    if (!token) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Token not found',
        },
      });
    }

    if (token.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only create campaigns for your own tokens',
        },
      });
    }

    if (token.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOKEN_NOT_APPROVED',
          message: 'Token must be approved before creating campaigns',
        },
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DATES',
          message: 'End date must be after start date',
        },
      });
    }

    // Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        tokenId,
        ownerId: userId,
        name,
        description,
        imageUrl,
        type: type as CampaignType,
        status: 'DRAFT',
        startDate: start,
        endDate: end,
        totalRewardPool,
        participantLimit,
      },
      include: {
        token: {
          select: {
            id: true,
            name: true,
            symbol: true,
            logoUrl: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      data: campaign,
      message: 'Campaign created successfully',
    });
  } catch (error) {
    console.error('Create campaign error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create campaign',
      },
    });
  }
};

// ============================================
// GET ALL CAMPAIGNS (with filters)
// ============================================
export const getAllCampaigns = async (req: Request, res: Response) => {
  try {
    const { 
      status, 
      type, 
      tokenId, 
      ownerId, 
      search, 
      page = '1', 
      limit = '10' 
    } = req.query;

    // Build filter conditions
    const where: any = {};

    if (status) {
      where.status = status as CampaignStatus;
    }

    if (type) {
      where.type = type as CampaignType;
    }

    if (tokenId) {
      where.tokenId = tokenId as string;
    }

    if (ownerId) {
      where.ownerId = ownerId as string;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Get campaigns with related data
    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        include: {
          token: {
            select: {
              id: true,
              name: true,
              symbol: true,
              logoUrl: true,
            },
          },
          owner: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          _count: {
            select: {
              tasks: true,
              participations: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.campaign.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        campaigns,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('Get campaigns error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch campaigns',
      },
    });
  }
};

// ============================================
// GET CAMPAIGN BY ID
// ============================================
export const getCampaignById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        token: {
          select: {
            id: true,
            name: true,
            symbol: true,
            logoUrl: true,
            blockchain: true,
            websiteUrl: true,
            twitterUrl: true,
            discordUrl: true,
            telegramUrl: true,
          },
        },
        owner: {
          select: {
            id: true,
            username: true,
            email: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        tasks: {
          orderBy: {
            order: 'asc',
          },
        },
        _count: {
          select: {
            participations: true,
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

    // Increment view count
    await prisma.campaign.update({
      where: { id },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    console.error('Get campaign error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch campaign',
      },
    });
  }
};

// ============================================
// UPDATE CAMPAIGN (OWNER only)
// ============================================
export const updateCampaign = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const id = req.params.id as string;

    // Check if campaign exists and user is owner
    const existingCampaign = await prisma.campaign.findUnique({
      where: { id },
    });

    if (!existingCampaign) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Campaign not found',
        },
      });
    }

    if (existingCampaign.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only update your own campaigns',
        },
      });
    }

    // Don't allow updating if campaign is completed or cancelled
    if (existingCampaign.status === 'COMPLETED' || existingCampaign.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Cannot update completed or cancelled campaigns',
        },
      });
    }

    const {
      name,
      description,
      imageUrl,
      type,
      status,
      startDate,
      endDate,
      totalRewardPool,
      participantLimit,
    } = req.body;

    // Validate dates if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end <= start) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DATES',
            message: 'End date must be after start date',
          },
        });
      }
    }

    // Update campaign
    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(type && { type: type as CampaignType }),
        ...(status && { status: status as CampaignStatus }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(totalRewardPool && { totalRewardPool }),
        ...(participantLimit !== undefined && { participantLimit }),
      },
      include: {
        token: true,
        _count: {
          select: {
            tasks: true,
            participations: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: campaign,
      message: 'Campaign updated successfully',
    });
  } catch (error) {
    console.error('Update campaign error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update campaign',
      },
    });
  }
};

// ============================================
// DELETE CAMPAIGN (OWNER only)
// ============================================
export const deleteCampaign = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const id = req.params.id as string;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            participations: true,
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
          message: 'You can only delete your own campaigns',
        },
      });
    }

    // Don't allow deletion if there are participants
    if (campaign._count.participations > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'HAS_PARTICIPANTS',
          message: 'Cannot delete campaign with existing participants',
        },
      });
    }

    await prisma.campaign.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Campaign deleted successfully',
    });
  } catch (error) {
    console.error('Delete campaign error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete campaign',
      },
    });
  }
};

// ============================================
// JOIN CAMPAIGN (MINER only)
// ============================================
export const joinCampaign = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const userType = (req as any).user?.userType;
    const id = req.params.id as string;

    // Check if user is MINER or BOTH
    if (userType !== 'MINER' && userType !== 'BOTH') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only miners can join campaigns',
        },
      });
    }

    // Check if campaign exists
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        tasks: true,
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

    // Check if campaign is active
    if (campaign.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CAMPAIGN_NOT_ACTIVE',
          message: 'Campaign is not active',
        },
      });
    }

    // Check if already joined
    const existing = await prisma.campaignParticipation.findUnique({
      where: {
        campaignId_userId: {
          campaignId: id,
          userId,
        },
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_JOINED',
          message: 'You have already joined this campaign',
        },
      });
    }

    // Check participant limit
    if (campaign.participantLimit && campaign.participantCount >= campaign.participantLimit) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CAMPAIGN_FULL',
          message: 'Campaign has reached participant limit',
        },
      });
    }

    // Check if campaign has REFERRAL tasks
    const referralTask = campaign.tasks.find(task => task.type === 'REFERRAL');

    // Create participation and update campaign count
    const [participation] = await prisma.$transaction(async (tx) => {
      const newParticipation = await tx.campaignParticipation.create({
        data: {
          campaignId: id,
          userId,
          totalTasks: campaign.tasks.length,
        },
      });

      await tx.campaign.update({
        where: { id },
        data: {
          participantCount: {
            increment: 1,
          },
        },
      });

      await tx.userProfile.update({
        where: { userId },
        data: {
          campaignsParticipated: {
            increment: 1,
          },
        },
      });

      // 🎯 AUTO-GENERATE REFERRAL CODE IF CAMPAIGN HAS REFERRAL TASK
      if (referralTask) {
        const crypto = require('crypto');
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();

        await tx.referralCode.create({
          data: {
            code,
            userId,
            campaignId: id,
            taskId: referralTask.id,
          },
        });

        console.log(`✅ Auto-generated referral code ${code} for user ${userId} in campaign ${id}`);
      }

      return [newParticipation];
    });

    return res.status(201).json({
      success: true,
      data: participation,
      message: 'Successfully joined campaign',
    });
  } catch (error) {
    console.error('Join campaign error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to join campaign',
      },
    });
  }
};

// ============================================
// GET MY CAMPAIGNS (for owner)
// ============================================
export const getMyCampaigns = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    const campaigns = await prisma.campaign.findMany({
      where: {
        ownerId: userId,
      },
      include: {
        token: {
          select: {
            id: true,
            name: true,
            symbol: true,
            logoUrl: true,
          },
        },
        _count: {
          select: {
            tasks: true,
            participations: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.status(200).json({
      success: true,
      data: campaigns,
    });
  } catch (error) {
    console.error('Get my campaigns error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch your campaigns',
      },
    });
  }
};

// ============================================
// GET CAMPAIGN PARTICIPANTS
// ============================================
export const getCampaignParticipants = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const participants = await prisma.campaignParticipation.findMany({
      where: {
        campaignId: id,
      },
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
              },
            },
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    return res.status(200).json({
      success: true,
      data: participants,
    });
  } catch (error) {
    console.error('Get participants error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch participants',
      },
    });
  }
};