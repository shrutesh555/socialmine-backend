import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';
import bcrypt from 'bcryptjs';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/v1/settings/profile
 * @desc    Get user profile settings
 * @access  Private
 */
router.get('/profile', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        userType: true,
        createdAt: true,
        profile: true,
        walletAddresses: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' }
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to load profile' }
    });
  }
});

/**
 * @route   PATCH /api/v1/settings/profile
 * @desc    Update user profile
 * @access  Private
 */
router.patch('/profile', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const { displayName, bio, avatarUrl } = req.body;

    // Update or create profile
    const profile = await prisma.userProfile.upsert({
      where: { userId },
      update: {
        displayName: displayName || undefined,
        bio: bio || undefined,
        avatarUrl: avatarUrl || undefined,
      },
      create: {
        userId,
        displayName: displayName || '',
        bio: bio || '',
        avatarUrl: avatarUrl || '',
      }
    });

    res.json({
      success: true,
      data: profile,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to update profile' }
    });
  }
});

/**
 * @route   POST /api/v1/settings/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: { message: 'Current and new password are required' }
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: { message: 'New password must be at least 6 characters' }
      });
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' }
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: { message: 'Current password is incorrect' }
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash }
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to change password' }
    });
  }
});

/**
 * @route   POST /api/v1/settings/wallet
 * @desc    Add wallet address
 * @access  Private
 */
router.post('/wallet', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const { blockchain, address, isPrimary } = req.body;

    if (!blockchain || !address) {
      return res.status(400).json({
        success: false,
        error: { message: 'Blockchain and address are required' }
      });
    }

    // Check if wallet already exists
    const existing = await prisma.walletAddress.findFirst({
      where: {
        userId,
        blockchain,
        address
      }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: { message: 'Wallet address already exists' }
      });
    }

    // If setting as primary, unset other primary wallets for this blockchain
    if (isPrimary) {
      await prisma.walletAddress.updateMany({
        where: {
          userId,
          blockchain,
          isPrimary: true
        },
        data: { isPrimary: false }
      });
    }

    // Create wallet
    const wallet = await prisma.walletAddress.create({
      data: {
        userId,
        blockchain,
        address,
        isPrimary: isPrimary || false,
        verified: false
      }
    });

    res.json({
      success: true,
      data: wallet,
      message: 'Wallet address added successfully'
    });
  } catch (error) {
    console.error('Add wallet error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to add wallet address' }
    });
  }
});

/**
 * @route   DELETE /api/v1/settings/wallet/:id
 * @desc    Remove wallet address
 * @access  Private
 */
router.delete('/wallet/:id', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    // Verify ownership
    const wallet = await prisma.walletAddress.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: { message: 'Wallet not found' }
      });
    }

    // Delete wallet
    await prisma.walletAddress.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Wallet address removed successfully'
    });
  } catch (error) {
    console.error('Remove wallet error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to remove wallet address' }
    });
  }
});

/**
 * @route   PATCH /api/v1/settings/wallet/:id/primary
 * @desc    Set wallet as primary
 * @access  Private
 */
router.patch('/wallet/:id/primary', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    // Get wallet
    const wallet = await prisma.walletAddress.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: { message: 'Wallet not found' }
      });
    }

    // Unset other primary wallets for this blockchain
    await prisma.walletAddress.updateMany({
      where: {
        userId,
        blockchain: wallet.blockchain,
        isPrimary: true
      },
      data: { isPrimary: false }
    });

    // Set this wallet as primary
    const updated = await prisma.walletAddress.update({
      where: { id },
      data: { isPrimary: true }
    });

    res.json({
      success: true,
      data: updated,
      message: 'Primary wallet updated'
    });
  } catch (error) {
    console.error('Set primary wallet error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to set primary wallet' }
    });
  }
});

export default router;