import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma from '../config/database';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email.util';

const router = Router();

/**
 * POST /api/v1/email/send-verification
 */
router.post('/send-verification', async (req: any, res: any) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: { message: 'Email is required' },
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists, a verification email has been sent.',
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        error: { message: 'Email is already verified' },
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: token,
        emailVerificationExpiry: expiry,
      },
    });

    await sendVerificationEmail(email, token);

    return res.json({
      success: true,
      message: 'Verification email sent. Check your inbox.',
    });
  } catch (error) {
    console.error('Send verification error:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to send verification email' },
    });
  }
});

/**
 * GET /api/v1/email/verify/:token
 */
router.get('/verify/:token', async (req: any, res: any) => {
  try {
    const token: string = req.params.token;

    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid or expired verification link' },
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
    });

    return res.json({
      success: true,
      message: 'Email verified successfully! You can now log in.',
    });
  } catch (error) {
    console.error('Verify email error:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to verify email' },
    });
  }
});

/**
 * POST /api/v1/email/forgot-password
 */
router.post('/forgot-password', async (req: any, res: any) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: { message: 'Email is required' },
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists, a password reset email has been sent.',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpiry: expiry,
      },
    });

    await sendPasswordResetEmail(email, token);

    return res.json({
      success: true,
      message: 'Password reset email sent. Check your inbox.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to send reset email' },
    });
  }
});

/**
 * POST /api/v1/email/reset-password
 */
router.post('/reset-password', async (req: any, res: any) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: { message: 'Token and new password are required' },
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: { message: 'Password must be at least 6 characters' },
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid or expired reset link' },
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });

    return res.json({
      success: true,
      message: 'Password reset successfully! You can now log in.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to reset password' },
    });
  }
});

export default router;