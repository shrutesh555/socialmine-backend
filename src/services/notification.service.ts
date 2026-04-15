import { PrismaClient, NotificationType } from '@prisma/client';

const prisma = new PrismaClient();

export const createNotification = async (
  userId: string,
  type: NotificationType,
  message: string,
  actorId?: string,
  postId?: string,
  commentId?: string
) => {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        type,
        message,
        actorId,
        postId,
        commentId,
        isRead: false
      }
    });
  } catch (error) {
    console.error('Create notification error:', error);
    return null;
  }
};

// Helper functions for specific notification types
export const notifyTokenApproved = async (ownerId: string, tokenName: string) => {
  return createNotification(
    ownerId,
    'CAMPAIGN_APPROVED',
    `Your token "${tokenName}" has been approved! You can now create campaigns.`
  );
};

export const notifyTokenRejected = async (ownerId: string, tokenName: string) => {
  return createNotification(
    ownerId,
    'CAMPAIGN_REJECTED',
    `Your token "${tokenName}" was rejected. Please contact support for details.`
  );
};

export const notifySubmissionApproved = async (minerId: string, taskTitle: string, rewardTokens: number, rewardXP: number) => {
  return createNotification(
    minerId,
    'TASK_APPROVED',
    `Your submission for "${taskTitle}" was approved! You earned ${rewardTokens} tokens and ${rewardXP} XP.`
  );
};

export const notifySubmissionRejected = async (minerId: string, taskTitle: string) => {
  return createNotification(
    minerId,
    'TASK_REJECTED',
    `Your submission for "${taskTitle}" was rejected. Please review the task requirements and try again.`
  );
};

export const notifyNewCampaign = async (minerId: string, campaignName: string, campaignId: string) => {
  return createNotification(
    minerId,
    'NEW_CAMPAIGN',
    `New campaign available: "${campaignName}". Check it out!`
  );
};