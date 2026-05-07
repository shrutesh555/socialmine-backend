import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/database';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.util';
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const signup = async (req: Request, res: Response) => {
  try {
    const { email, password, username, userType, referralCode, campaignId } = req.body;

    console.log('🚀 Signup request:', { email, username, userType, referralCode, campaignId });

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: existingUser.email === email
            ? 'Email already registered'
            : 'Username already taken',
        },
      });
    }

    let validatedReferralCode = null;
    if (referralCode) {
      console.log('🔍 Validating referral code:', referralCode);

      validatedReferralCode = await prisma.referralCode.findUnique({
        where: { code: referralCode.toUpperCase() },
        include: { campaign: true, task: true },
      });

      if (!validatedReferralCode) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_REFERRAL_CODE', message: 'Invalid referral code' },
        });
      }

      if (!validatedReferralCode.isActive) {
        return res.status(400).json({
          success: false,
          error: { code: 'INACTIVE_REFERRAL_CODE', message: 'Referral code is no longer active' },
        });
      }

      if (validatedReferralCode.expiresAt && validatedReferralCode.expiresAt < new Date()) {
        return res.status(400).json({
          success: false,
          error: { code: 'EXPIRED_REFERRAL_CODE', message: 'Referral code has expired' },
        });
      }

      if (validatedReferralCode.maxUses && validatedReferralCode.timesUsed >= validatedReferralCode.maxUses) {
        return res.status(400).json({
          success: false,
          error: { code: 'REFERRAL_CODE_MAXED', message: 'Referral code has reached maximum usage' },
        });
      }

      console.log('✅ Referral code is valid');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.$transaction(async (tx: any) => {
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          username,
          userType: userType || 'MINER',
          referredBy: validatedReferralCode ? validatedReferralCode.userId : null,
        },
      });

      console.log('✅ User created:', newUser.id);

      await tx.userProfile.create({
        data: { userId: newUser.id },
      });

      console.log('✅ User profile created');

      if (validatedReferralCode) {
        await tx.referralCode.update({
          where: { id: validatedReferralCode.id },
          data: { timesUsed: { increment: 1 } },
        });

        console.log('✅ Referral code usage incremented');

        if (validatedReferralCode.task) {
          const referrerReward = parseFloat(validatedReferralCode.task.reward?.toString() || '0');
          const referrerXP = validatedReferralCode.task.experiencePoints || 0;

          await tx.userProfile.update({
            where: { userId: validatedReferralCode.userId },
            data: {
              totalEarned: { increment: referrerReward },
              experiencePoints: { increment: referrerXP },
            },
          });

          console.log('✅ Rewards awarded to referrer:', { reward: referrerReward, xp: referrerXP });

          const welcomeBonus = referrerReward * 0.25;
          const welcomeXP = Math.floor(referrerXP * 0.25);

          await tx.userProfile.update({
            where: { userId: newUser.id },
            data: {
              totalEarned: { increment: welcomeBonus },
              experiencePoints: { increment: welcomeXP },
            },
          });

          console.log('✅ Welcome bonus awarded to new user:', { bonus: welcomeBonus, xp: welcomeXP });
        }

        const targetCampaignId = campaignId || validatedReferralCode.campaignId;

        if (targetCampaignId) {
          const campaign = await tx.campaign.findUnique({
            where: { id: targetCampaignId },
          });

          if (campaign && campaign.status === 'ACTIVE') {
            const existingParticipation = await tx.campaignParticipation.findUnique({
              where: {
                campaignId_userId: {
                  campaignId: targetCampaignId,
                  userId: newUser.id,
                },
              },
            });

            if (!existingParticipation) {
              const totalTasks = await tx.task.count({
                where: { campaignId: targetCampaignId },
              });

              await tx.campaignParticipation.create({
                data: {
                  campaignId: targetCampaignId,
                  userId: newUser.id,
                  totalTasks,
                },
              });

              await tx.campaign.update({
                where: { id: targetCampaignId },
                data: { participantCount: { increment: 1 } },
              });

              console.log('✅ User auto-joined campaign:', targetCampaignId);
            }
          }
        }
      }

      return newUser;
    });

    const payload = {
      userId: user.id,
      email: user.email,
      userType: user.userType,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Send verification email
    try {
      const crypto = require('crypto');
      const { sendVerificationEmail } = require('../utils/email.util');
      const verifyToken = crypto.randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationToken: verifyToken,
          emailVerificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      await sendVerificationEmail(email, verifyToken);
      console.log('✅ Verification email sent');
    } catch (emailErr) {
      console.error('⚠️ Failed to send verification email:', emailErr);
    }
    console.log('✅ Signup complete:', user.username);

    return res.status(201).json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        expiresIn: 3600,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          userType: user.userType,
        },
      },
      message: validatedReferralCode
        ? 'Account created and campaign joined successfully!'
        : 'Account created successfully',
    });
  } catch (error) {
    console.error('❌ Signup error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create account' },
    });
  }
};

export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { credential, userType } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_CREDENTIAL', message: 'Google credential is required' },
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid Google token' },
      });
    }

    const { email, name, picture } = payload;

    let user = await prisma.user.findUnique({ where: { email } });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const username = email.split('@')[0] + Math.floor(Math.random() * 1000);

      user = await prisma.$transaction(async (tx: any) => {
        const newUser = await tx.user.create({
          data: {
            email,
            passwordHash: '',
            username,
            userType: userType || 'MINER',
            emailVerified: true,
          },
        });

        await tx.userProfile.create({
          data: {
            userId: newUser.id,
            displayName: name || username,
            avatarUrl: picture || '',
          },
        });

        return newUser;
      });
    }

    if (!user) {
      return res.status(500).json({
        success: false,
        error: { code: 'GOOGLE_AUTH_FAILED', message: 'Failed to create user account' },
      });
    }

    // Check email verification
    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email before logging in. Check your inbox for the verification link.',
        },
      });
    }
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_SUSPENDED', message: 'Your account has been suspended' },
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const jwtPayload = {
      userId: user.id,
      email: user.email,
      userType: user.userType,
    };

    const accessToken = generateAccessToken(jwtPayload);
    const refreshToken = generateRefreshToken(jwtPayload);

    return res.status(200).json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        expiresIn: 3600,
        isNewUser,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          userType: user.userType,
        },
      },
    });
  } catch (error) {
    console.error('Google auth error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'GOOGLE_AUTH_FAILED', message: 'Google authentication failed' },
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_SUSPENDED', message: 'Your account has been suspended' },
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const payload = {
      userId: user.id,
      email: user.email,
      userType: user.userType,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return res.status(200).json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        expiresIn: 3600,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          userType: user.userType,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to login' },
    });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Refresh token is required' },
      });
    }

    const decoded = verifyRefreshToken(refreshToken);

    const accessToken = generateAccessToken({
      userId: decoded.userId,
      email: decoded.email,
      userType: decoded.userType,
    });

    return res.status(200).json({
      success: true,
      data: {
        accessToken,
        expiresIn: 3600,
      },
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' },
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};