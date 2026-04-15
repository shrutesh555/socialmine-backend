import { Request, Response } from 'express';
import prisma from '../config/database';
import { TokenStatus } from '@prisma/client';

// ============================================
// SUBMIT TOKEN (PROJECT_OWNER only)
// ============================================
export const submitToken = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const userType = (req as any).user?.userType;

    // Check if user is PROJECT_OWNER or BOTH
    if (userType !== 'PROJECT_OWNER' && userType !== 'BOTH') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only project owners can submit tokens',
        },
      });
    }

    const {
      name,
      symbol,
      description,
      contractAddress,
      blockchain,
      logoUrl,
      websiteUrl,
      twitterUrl,
      discordUrl,
      telegramUrl,
    } = req.body;

    // Create token
    const token = await prisma.token.create({
      data: {
        ownerId: userId,
        name,
        symbol: symbol.toUpperCase(),
        description,
        contractAddress,
        blockchain,
        logoUrl,
        websiteUrl,
        twitterUrl,
        discordUrl,
        telegramUrl,
        status: 'PENDING_REVIEW',
      },
    });

    return res.status(201).json({
      success: true,
      data: token,
      message: 'Token submitted successfully for review',
    });
  } catch (error) {
    console.error('Submit token error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to submit token',
      },
    });
  }
};

// ============================================
// GET ALL TOKENS (with filters)
// ============================================
export const getAllTokens = async (req: Request, res: Response) => {
  try {
    const { status, ownerId, blockchain, search, page = '1', limit = '10' } = req.query;

    // Build filter conditions
    const where: any = {};

    if (status) {
      where.status = status as TokenStatus;
    }

    if (ownerId) {
      where.ownerId = ownerId as string;
    }

    if (blockchain) {
      where.blockchain = blockchain as string;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { symbol: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Get tokens with owner info
    const [tokens, total] = await Promise.all([
      prisma.token.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          _count: {
            select: {
              campaigns: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.token.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        tokens,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('Get tokens error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch tokens',
      },
    });
  }
};

// ============================================
// GET TOKEN BY ID
// ============================================
export const getTokenById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const token = await prisma.token.findUnique({
      where: { id },
      include: {
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
        campaigns: {
          select: {
            id: true,
            name: true,
            status: true,
            participantCount: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
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

    return res.status(200).json({
      success: true,
      data: token,
    });
  } catch (error) {
    console.error('Get token error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch token',
      },
    });
  }
};

// ============================================
// UPDATE TOKEN (OWNER only)
// ============================================
export const updateToken = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const id = req.params.id as string;

    // Check if token exists and user is owner
    const existingToken = await prisma.token.findUnique({
      where: { id },
    });

    if (!existingToken) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Token not found',
        },
      });
    }

    if (existingToken.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only update your own tokens',
        },
      });
    }

    // Don't allow updating if approved/rejected
    if (existingToken.status === 'APPROVED' || existingToken.status === 'REJECTED') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Cannot update token that has been reviewed',
        },
      });
    }

    const {
      name,
      symbol,
      description,
      contractAddress,
      blockchain,
      logoUrl,
      websiteUrl,
      twitterUrl,
      discordUrl,
      telegramUrl,
    } = req.body;

    // Update token
    const token = await prisma.token.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(symbol && { symbol: symbol.toUpperCase() }),
        ...(description && { description }),
        ...(contractAddress !== undefined && { contractAddress }),
        ...(blockchain && { blockchain }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(websiteUrl !== undefined && { websiteUrl }),
        ...(twitterUrl !== undefined && { twitterUrl }),
        ...(discordUrl !== undefined && { discordUrl }),
        ...(telegramUrl !== undefined && { telegramUrl }),
      },
    });

    return res.status(200).json({
      success: true,
      data: token,
      message: 'Token updated successfully',
    });
  } catch (error) {
    console.error('Update token error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update token',
      },
    });
  }
};

// ============================================
// UPDATE TOKEN STATUS (Admin/Review)
// ============================================
export const updateTokenStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const id = req.params.id as string;
    const { status, rejectionReason } = req.body;

    // In production, you'd check if user is ADMIN
    // For now, only token owner can change status (for testing)
    const token = await prisma.token.findUnique({
      where: { id },
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

    // Update status
    const updatedToken = await prisma.token.update({
      where: { id },
      data: {
        status: status as TokenStatus,
      },
    });

    // If approved, you might want to send notification
    if (status === 'APPROVED') {
      await prisma.notification.create({
        data: {
          userId: token.ownerId,
          type: 'CAMPAIGN_APPROVED',
          message: `Your token "${token.name}" has been approved!`,
        },
      });
    }

    // If rejected, send rejection notification
    if (status === 'REJECTED') {
      await prisma.notification.create({
        data: {
          userId: token.ownerId,
          type: 'CAMPAIGN_REJECTED',
          message: `Your token "${token.name}" was rejected. ${rejectionReason || ''}`,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: updatedToken,
      message: `Token ${status.toLowerCase()} successfully`,
    });
  } catch (error) {
    console.error('Update token status error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update token status',
      },
    });
  }
};

// ============================================
// DELETE TOKEN (OWNER only, if not approved)
// ============================================
export const deleteToken = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const id = req.params.id as string;

    const token = await prisma.token.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            campaigns: true,
          },
        },
      },
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
          message: 'You can only delete your own tokens',
        },
      });
    }

    // Don't allow deletion if there are active campaigns
    if (token._count.campaigns > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'HAS_CAMPAIGNS',
          message: 'Cannot delete token with existing campaigns',
        },
      });
    }

    await prisma.token.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Token deleted successfully',
    });
  } catch (error) {
    console.error('Delete token error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete token',
      },
    });
  }
};

// ============================================
// GET MY TOKENS (for logged-in owner)
// ============================================
export const getMyTokens = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    const tokens = await prisma.token.findMany({
      where: {
        ownerId: userId,
      },
      include: {
        _count: {
          select: {
            campaigns: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.status(200).json({
      success: true,
      data: tokens,
    });
  } catch (error) {
    console.error('Get my tokens error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch your tokens',
      },
    });
  }
};