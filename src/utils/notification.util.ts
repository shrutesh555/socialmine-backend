// src/utils/notification.util.ts
import prisma from '../config/database';

interface CreateNotificationParams {
  userId: string;
  type: 'FOLLOW' | 'LIKE_POST' | 'LIKE_COMMENT' | 'COMMENT_POST' | 'REPLY_COMMENT' | 'MENTION' | 'SYSTEM';
  actorId: string;
  postId?: string;
  commentId?: string;
  message: string;
}

export const createNotification = async (params: CreateNotificationParams) => {
  try {
    // Don't create notification if user is notifying themselves
    if (params.userId === params.actorId) {
      return null;
    }

    await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        actorId: params.actorId,
        postId: params.postId,
        commentId: params.commentId,
        message: params.message,
      },
    });
  } catch (error) {
    console.error('Create notification error:', error);
  }
};

export const createFollowNotification = async (followerId: string, followingId: string, followerUsername: string) => {
  await createNotification({
    userId: followingId,
    type: 'FOLLOW',
    actorId: followerId,
    message: `${followerUsername} started following you`,
  });
};

export const createPostLikeNotification = async (
  postId: string,
  postOwnerId: string,
  likerId: string,
  likerUsername: string
) => {
  await createNotification({
    userId: postOwnerId,
    type: 'LIKE_POST',
    actorId: likerId,
    postId,
    message: `${likerUsername} liked your post`,
  });
};

export const createCommentLikeNotification = async (
  commentId: string,
  commentOwnerId: string,
  likerId: string,
  likerUsername: string
) => {
  await createNotification({
    userId: commentOwnerId,
    type: 'LIKE_COMMENT',
    actorId: likerId,
    commentId,
    message: `${likerUsername} liked your comment`,
  });
};

export const createCommentNotification = async (
  postId: string,
  postOwnerId: string,
  commenterId: string,
  commenterUsername: string
) => {
  await createNotification({
    userId: postOwnerId,
    type: 'COMMENT_POST',
    actorId: commenterId,
    postId,
    message: `${commenterUsername} commented on your post`,
  });
};

export const createReplyNotification = async (
  commentId: string,
  parentCommentOwnerId: string,
  replierId: string,
  replierUsername: string
) => {
  await createNotification({
    userId: parentCommentOwnerId,
    type: 'REPLY_COMMENT',
    actorId: replierId,
    commentId,
    message: `${replierUsername} replied to your comment`,
  });
};