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

    // Check if user already exists
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

    // Validate referral code if provided
    let validatedReferralCode = null;
    if (referralCode) {
      console.log('🔍 Validating referral code:', referralCode);
      
      validatedReferralCode = await prisma.referralCode.findUnique({
        where: { code: referralCode.toUpperCase() },
        include: {
          campaign: true,
          task: true,
        },
      });

      if (!validatedReferralCode) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_CODE',
            message: 'Invalid referral code',
          },
        });
      }

      if (!validatedReferralCode.isActive) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INACTIVE_REFERRAL_CODE',
            message: 'Referral code is no longer active',
          },
        });
      }

      if (validatedReferralCode.expiresAt && validatedReferralCode.expiresAt < new Date()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EXPIRED_REFERRAL_CODE',
            message: 'Referral code has expired',
          },
        });
      }

      if (validatedReferralCode.maxUses && validatedReferralCode.timesUsed >= validatedReferralCode.maxUses) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'REFERRAL_CODE_MAXED',
            message: 'Referral code has reached maximum usage',
          },
        });
      }

      console.log('✅ Referral code is valid');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user with profile, referral, and campaign join in a transaction
    const user = await prisma.$transaction(async (tx: any) => {
      // 1. Create user
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

      // 2. Create user profile
      await tx.userProfile.create({
        data: {
          userId: newUser.id,
        },
      });

      console.log('✅ User profile created');

      // 3. Handle referral code if present
      if (validatedReferralCode) {
        // Increment referral code usage
        await tx.referralCode.update({
          where: { id: validatedReferralCode.id },
          data: { timesUsed: { increment: 1 } },
        });

        console.log('✅ Referral code usage incremented');

        // Award rewards to referrer
        // Award rewards to referrer AND new user
if (validatedReferralCode.task) {
  const referrerReward = parseFloat(validatedReferralCode.task.reward?.toString() || '0');
  const referrerXP = validatedReferralCode.task.experiencePoints || 0;

  // Referrer gets full reward
  await tx.userProfile.update({
    where: { userId: validatedReferralCode.userId },
    data: {
      totalEarned: { increment: referrerReward },
      experiencePoints: { increment: referrerXP },
    },
  });

  console.log('✅ Rewards awarded to referrer:', { reward: referrerReward, xp: referrerXP });

  // NEW USER gets welcome bonus (25% of referrer's reward)
  const welcomeBonus = referrerReward * 0.25; // 25% of referrer reward
  const welcomeXP = Math.floor(referrerXP * 0.25); // 25% of referrer XP

  await tx.userProfile.update({
    where: { userId: newUser.id },
    data: {
      totalEarned: { increment: welcomeBonus },
      experiencePoints: { increment: welcomeXP },
    },
  });

  console.log('✅ Welcome bonus awarded to new user:', { bonus: welcomeBonus, xp: welcomeXP });
}

        // 4. Auto-join campaign if campaignId provided or from referral code
        const targetCampaignId = campaignId || validatedReferralCode.campaignId;
        
        if (targetCampaignId) {
          // Check if campaign exists and is active
          const campaign = await tx.campaign.findUnique({
            where: { id: targetCampaignId },
          });

          if (campaign && campaign.status === 'ACTIVE') {
            // Check if user hasn't already joined
            const existingParticipation = await tx.campaignParticipation.findUnique({
              where: {
                campaignId_userId: {
                  campaignId: targetCampaignId,
                  userId: newUser.id,
                },
              },
            });

            if (!existingParticipation) {
              // Count total tasks for this campaign
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

              // Increment campaign participant count
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

    // Generate tokens
    const payload = {
      userId: user.id,
      email: user.email,
      userType: user.userType,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

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
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create account',
      },
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

    // Verify Google token
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

    const { email, name, picture, sub: googleId } = payload;

    // Check if user exists
    let user = await prisma.user.findUnique({ where: { email } });
    let isNewUser = false;

    if (!user) {
      // Create new user
      isNewUser = true;
      const username = email.split('@')[0] + Math.floor(Math.random() * 1000);

      user = await prisma.$transaction(async (tx: any) => {
        const newUser = await tx.user.create({
          data: {
            email,
            passwordHash: '', // No password for Google users
            username,
            userType: userType || 'MINER',
            emailVerified: true, // Google email is already verified
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

    // Check if account is active
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_SUSPENDED', message: 'Your account has been suspended' },
      });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate tokens
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

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    // Check if account is active
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'Your account has been suspended',
        },
      });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate tokens
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
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to login',
      },
    });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Refresh token is required',
        },
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Generate new access token
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
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired refresh token',
      },
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
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