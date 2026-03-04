import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { createFollowNotification } from '../utils/notification.util';

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const username = req.params.username as string;
    const currentUserId = req.user?.userId;

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        email: true,
        userType: true,
        createdAt: true,
        profile: {
          select: {
            displayName: true,
            bio: true,
            avatarUrl: true,
            totalEarned: true,
            tasksCompleted: true,
            campaignsParticipated: true,
          },
        },
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    // Check if current user follows this user
    let isFollowing = false;
    if (currentUserId && currentUserId !== user.id) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: user.id,
          },
        },
      });
      isFollowing = !!follow;
    }

    return res.json({
      success: true,
      data: {
        ...user,
        stats: {
          posts: user._count.posts,
          followers: user._count.followers,
          following: user._count.following,
        },
        isFollowing,
        isOwnProfile: currentUserId === user.id,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch profile',
      },
    });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { displayName, bio, avatarUrl } = req.body;

    const updatedProfile = await prisma.userProfile.update({
      where: { userId },
      data: {
        displayName,
        bio,
        avatarUrl,
      },
    });

    return res.json({
      success: true,
      data: updatedProfile,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update profile',
      },
    });
  }
};

export const followUser = async (req: AuthRequest, res: Response) => {
  try {
    const username = req.params.username as string;
    const followerId = req.user!.userId;

    // Find user to follow
    const userToFollow = await prisma.user.findUnique({
      where: { username },
    });

    if (!userToFollow) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    // Can't follow yourself
    if (userToFollow.id === followerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'You cannot follow yourself',
        },
      });
    }

    // Check if already following
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: userToFollow.id,
        },
      },
    });

    if (existingFollow) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_FOLLOWING',
          message: 'You are already following this user',
        },
      });
    }

    await prisma.follow.create({
      data: {
        followerId,
        followingId: userToFollow.id,
      },
    });

    // Create notification
    const currentUser = await prisma.user.findUnique({
      where: { id: followerId },
      select: { username: true },
    });

    if (currentUser) {
      await createFollowNotification(followerId, userToFollow.id, currentUser.username);
    }

    return res.json({
      success: true,
      message: `You are now following ${userToFollow.username}`,
    });
  } catch (error) {
    console.error('Follow user error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to follow user',
      },
    });
  }
};

export const unfollowUser = async (req: AuthRequest, res: Response) => {
  try {
    const username = req.params.username as string;
    const followerId = req.user!.userId;

    // Find user to unfollow
    const userToUnfollow = await prisma.user.findUnique({
      where: { username },
    });

    if (!userToUnfollow) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    // Check if following
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: userToUnfollow.id,
        },
      },
    });

    if (!existingFollow) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NOT_FOLLOWING',
          message: 'You are not following this user',
        },
      });
    }

    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId,
          followingId: userToUnfollow.id,
        },
      },
    });

    return res.json({
      success: true,
      message: `You unfollowed ${userToUnfollow.username}`,
    });
  } catch (error) {
    console.error('Unfollow user error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to unfollow user',
      },
    });
  }
};

export const getFollowers = async (req: AuthRequest, res: Response) => {
  try {
    const username = req.params.username as string;
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Find user
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    const followers = await prisma.follow.findMany({
      where: {
        followingId: user.id,
      },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
                bio: true,
              },
            },
          },
        },
      },
      skip,
      take: Number(limit),
      orderBy: {
        createdAt: 'desc',
      },
    });

    const total = await prisma.follow.count({
      where: {
        followingId: user.id,
      },
    });

    return res.json({
      success: true,
      data: {
        followers: followers.map(f => f.follower),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get followers error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch followers',
      },
    });
  }
};

export const getFollowing = async (req: AuthRequest, res: Response) => {
  try {
    const username = req.params.username as string;
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Find user
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    const following = await prisma.follow.findMany({
      where: {
        followerId: user.id,
      },
      include: {
        following: {
          select: {
            id: true,
            username: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
                bio: true,
              },
            },
          },
        },
      },
      skip,
      take: Number(limit),
      orderBy: {
        createdAt: 'desc',
      },
    });

    const total = await prisma.follow.count({
      where: {
        followerId: user.id,
      },
    });

    return res.json({
      success: true,
      data: {
        following: following.map(f => f.following),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get following error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch following',
      },
    });
  }
};

export const getUserPosts = async (req: AuthRequest, res: Response) => {
  try {
    const username = req.params.username as string;
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Find user
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    const posts = await prisma.post.findMany({
      where: {
        userId: user.id,
        visibility: 'PUBLIC',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: Number(limit),
    });

    const total = await prisma.post.count({
      where: {
        userId: user.id,
        visibility: 'PUBLIC',
      },
    });

    return res.json({
      success: true,
      data: {
        posts,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get user posts error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch user posts',
      },
    });
  }
};