import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { createCommentNotification, createReplyNotification, createCommentLikeNotification } from '../utils/notification.util';

export const createComment = async (req: AuthRequest, res: Response) => {
  try {
    const { postId, content, parentCommentId } = req.body;
    const userId = req.user!.userId;

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
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

    let parentComment = null;
    // If replying to a comment, check if parent comment exists
    if (parentCommentId) {
      parentComment = await prisma.comment.findUnique({
        where: { id: parentCommentId },
      });

      if (!parentComment) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Parent comment not found',
          },
        });
      }

      // Ensure parent comment belongs to the same post
      if (parentComment.postId !== postId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Parent comment does not belong to this post',
          },
        });
      }
    }

    const comment = await prisma.$transaction(async (tx) => {
      const newComment = await tx.comment.create({
        data: {
          postId,
          userId,
          content,
          parentCommentId,
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

      // Increment post comments count
      await tx.post.update({
        where: { id: postId },
        data: {
          commentsCount: {
            increment: 1,
          },
        },
      });

      return newComment;
    });

    // Create notifications
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    if (currentUser) {
      if (parentCommentId && parentComment) {
        // Reply notification
        await createReplyNotification(parentCommentId, parentComment.userId, userId, currentUser.username);
      } else {
        // Comment notification
        await createCommentNotification(postId, post.userId, userId, currentUser.username);
      }
    }

    return res.status(201).json({
      success: true,
      data: comment,
      message: parentCommentId ? 'Reply added successfully' : 'Comment added successfully',
    });
  } catch (error) {
    console.error('Create comment error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create comment',
      },
    });
  }
};

export const getComments = async (req: AuthRequest, res: Response) => {
  try {
    const postId = req.params.postId as string;
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
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

    // Get top-level comments (no parent)
    const comments = await prisma.comment.findMany({
      where: {
        postId,
        parentCommentId: null,
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
        replies: {
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
                replies: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        _count: {
          select: {
            likes: true,
            replies: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: Number(limit),
    });

    const total = await prisma.comment.count({
      where: {
        postId,
        parentCommentId: null,
      },
    });

    return res.json({
      success: true,
      data: {
        comments,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get comments error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch comments',
      },
    });
  }
};

export const updateComment = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { content } = req.body;
    const userId = req.user!.userId;

    const comment = await prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Comment not found',
        },
      });
    }

    if (comment.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only edit your own comments',
        },
      });
    }

    const updatedComment = await prisma.comment.update({
      where: { id },
      data: {
        content,
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
      data: updatedComment,
      message: 'Comment updated successfully',
    });
  } catch (error) {
    console.error('Update comment error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update comment',
      },
    });
  }
};

export const deleteComment = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    const comment = await prisma.comment.findUnique({
      where: { id },
      include: {
        post: true,
      },
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Comment not found',
        },
      });
    }

    if (comment.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only delete your own comments',
        },
      });
    }

    await prisma.$transaction(async (tx) => {
      // Delete comment (cascade will delete replies and likes)
      await tx.comment.delete({
        where: { id },
      });

      // Decrement post comments count
      await tx.post.update({
        where: { id: comment.postId },
        data: {
          commentsCount: {
            decrement: 1,
          },
        },
      });
    });

    return res.json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete comment',
      },
    });
  }
};

export const likeComment = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    const comment = await prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Comment not found',
        },
      });
    }

    const existingLike = await prisma.commentLike.findUnique({
      where: {
        commentId_userId: {
          commentId: id,
          userId,
        },
      },
    });

    if (existingLike) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_LIKED',
          message: 'You already liked this comment',
        },
      });
    }

    await prisma.$transaction([
      prisma.commentLike.create({
        data: {
          commentId: id,
          userId,
        },
      }),
      prisma.comment.update({
        where: { id },
        data: {
          likesCount: {
            increment: 1,
          },
        },
      }),
    ]);

    // Create notification
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    if (currentUser) {
      await createCommentLikeNotification(id, comment.userId, userId, currentUser.username);
    }

    return res.json({
      success: true,
      message: 'Comment liked successfully',
    });
  } catch (error) {
    console.error('Like comment error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to like comment',
      },
    });
  }
};

export const unlikeComment = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    const existingLike = await prisma.commentLike.findUnique({
      where: {
        commentId_userId: {
          commentId: id,
          userId,
        },
      },
    });

    if (!existingLike) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NOT_LIKED',
          message: 'You have not liked this comment',
        },
      });
    }

    await prisma.$transaction([
      prisma.commentLike.delete({
        where: {
          commentId_userId: {
            commentId: id,
            userId,
          },
        },
      }),
      prisma.comment.update({
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
      message: 'Comment unliked successfully',
    });
  } catch (error) {
    console.error('Unlike comment error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to unlike comment',
      },
    });
  }
};