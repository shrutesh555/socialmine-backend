import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';
import { notifyTokenApproved, notifyTokenRejected } from '../services/notification.service';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/v1/tokens
 * @desc    Get all tokens (with filters)
 * @access  Private
 */
router.get('/', authenticate, async (req: any, res) => {
  try {
    const { status, ownerId } = req.query;
    
    const where: any = {};
    if (status) where.status = status;
    if (ownerId) where.ownerId = ownerId;

    const tokens = await prisma.token.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            username: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: { tokens }
    });
  } catch (error) {
    console.error('Get tokens error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get tokens' }
    });
  }
});

/**
 * @route   POST /api/v1/tokens
 * @desc    Submit token for review
 * @access  Private (PROJECT_OWNER)
 */
router.post('/', authenticate, async (req: any, res) => {
  try {
    const { name, symbol, description, contractAddress, blockchain, logoUrl, website } = req.body;

    const token = await prisma.token.create({
      data: {
        ownerId: req.user.userId,
        name,
        symbol,
        description: description || '',
        contractAddress: contractAddress || '',
        blockchain,
        logoUrl,
        websiteUrl: website,
        status: 'PENDING_REVIEW'
      }
    });

    res.json({ success: true, data: token });
  } catch (error) {
    console.error('Create token error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to create token' }
    });
  }
});

/**
 * @route   POST /api/v1/tokens/:id/approve
 * @desc    Approve token (ADMIN only)
 * @access  Private
 */
router.post('/:id/approve', authenticate, async (req: any, res) => {
  try {
    console.log('🔍 Approval attempt - User:', req.user);
    
    if (req.user.userType !== 'ADMIN') {
      console.log('❌ Access denied - userType:', req.user.userType);
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' }
      });
    }

    const tokenId = String(req.params.id);
    
    const token = await prisma.token.update({
      where: { id: tokenId },
      data: { status: 'APPROVED' }
    });

    // ✅ Send notification to token owner
    await notifyTokenApproved(token.ownerId, token.name);

    console.log('✅ Token approved:', tokenId);
    res.json({ success: true, data: token });
  } catch (error) {
    console.error('Approve token error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to approve token' }
    });
  }
});

/**
 * @route   POST /api/v1/tokens/:id/reject
 * @desc    Reject token (ADMIN only)
 * @access  Private
 */
router.post('/:id/reject', authenticate, async (req: any, res) => {
  try {
    if (req.user.userType !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' }
      });
    }

    const tokenId = String(req.params.id);
    
    const token = await prisma.token.update({
      where: { id: tokenId },
      data: { status: 'REJECTED' }
    });

    // ✅ Send notification to token owner
    await notifyTokenRejected(token.ownerId, token.name);

    res.json({ success: true, data: token });
  } catch (error) {
    console.error('Reject token error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to reject token' }
    });
  }
});

export default router;