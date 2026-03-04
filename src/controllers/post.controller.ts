import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { createPostLikeNotification } from '../utils/notification.util';

export const createPost = async (req: AuthRequest, res: Response) => {
  try {
    const { content, visibility = 'PUBLIC' } = req.body;
    const userId = req.user!.userId;

    const post = await prisma.post.create({
      data: {
        userId,
        content,
        visibility,
        mediaUrls: [],
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
      },
    });

    return res.status(201).json({
      success: true,
      data: post,
      message: 'Post created successfully',
    });
  } catch (error) {
    console.error('Create post error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create post',
      },
    });
  }
};

export const getPosts = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const posts = await prisma.post.findMany({
      where: {
        OR: [
          { visibility: 'PUBLIC' },
          { userId: req.user!.userId },
        ],
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
        OR: [
          { visibility: 'PUBLIC' },
          { userId: req.user!.userId },
        ],
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
    console.error('Get posts error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch posts',
      },
    });
  }
};

export const getPost = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const post = await prisma.post.findUnique({
      where: { id },
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
        comments: {
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
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Post not found',
        },
      });
    }

    return res.json({
      success: true,
      data: post,
    });
  } catch (error) {
    console.error('Get post error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch post',
      },
    });
  }
};

export const updatePost = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { content, visibility } = req.body;
    const userId = req.user!.userId;

    const post = await prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Post not found',
        },
      });
    }

    if (post.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only edit your own posts',
        },
      });
    }

    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        content,
        visibility,
        isEdited: true,
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
      },
    });

    return res.json({
      success: true,
      data: updatedPost,
      message: 'Post updated successfully',
    });
  } catch (error) {
    console.error('Update post error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update post',
      },
    });
  }
};

export const deletePost = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    const post = await prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Post not found',
        },
      });
    }

    if (post.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only delete your own posts',
        },
      });
    }

    await prisma.post.delete({
      where: { id },
    });

    return res.json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error) {
    console.error('Delete post error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete post',
      },
    });
  }
};

export const likePost = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    const post = await prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Post not found',
        },
      });
    }

    const existingLike = await prisma.postLike.findUnique({
      where: {
        postId_userId: {
          postId: id,
          userId,
        },
      },
    });

    if (existingLike) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_LIKED',
          message: 'You already liked this post',
        },
      });
    }

    await prisma.$transaction([
      prisma.postLike.create({
        data: {
          postId: id,
          userId,
        },
      }),
      prisma.post.update({
        where: { id },
        data: {
          likesCount: {
            increment: 1,
          },
        },
      }),
    ]);

    // ADD THIS BLOCK - Create notification
     const currentUser = await prisma.user.findUnique({
     where: { id: userId },
     select: { username: true },
    });

if (currentUser) {
  await createPostLikeNotification(id, post.userId, userId, currentUser.username);
}

    return res.json({
      success: true,
      message: 'Post liked successfully',
    });
  } catch (error) {
    console.error('Like post error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to like post',
      },
    });
  }
};

export const unlikePost = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    const existingLike = await prisma.postLike.findUnique({
      where: {
        postId_userId: {
          postId: id,
          userId,
        },
      },
    });

    if (!existingLike) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NOT_LIKED',
          message: 'You have not liked this post',
        },
      });
    }

    await prisma.$transaction([
      prisma.postLike.delete({
        where: {
          postId_userId: {
            postId: id,
            userId,
          },
        },
      }),
      prisma.post.update({
        where: { id },
        data: {
          likesCount: {
            decrement: 1,
          },
        },
      }),
    ]);

    return res.json({
      success: true,
      message: 'Post unliked successfully',
    });
  } catch (error) {
    console.error('Unlike post error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to unlike post',
      },
    });
  }
};