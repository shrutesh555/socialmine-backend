import { Request, Response } from 'express';
import prisma from '../config/database';
import { TaskType, VerificationType } from '@prisma/client';

// ============================================
// CREATE TASK (CAMPAIGN OWNER only)
// ============================================
export const createTask = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    const {
      campaignId,
      title,
      description,
      type,
      verificationType,
      requirements,
      experiencePoints,
      reward,
      order,
      isRequired,
      estimatedTime,
    } = req.body;

    // Verify campaign exists and user is owner
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Campaign not found',
        },
      });
    }

    if (campaign.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only add tasks to your own campaigns',
        },
      });
    }

    // Don't allow adding tasks to completed/cancelled campaigns
    if (campaign.status === 'COMPLETED' || campaign.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Cannot add tasks to completed or cancelled campaigns',
        },
      });
    }

    // Create task
    const task = await prisma.task.create({
      data: {
        campaignId,
        title,
        description,
        type: type as TaskType,
        verificationType: verificationType as VerificationType,
        requirements: requirements || {},
        experiencePoints: experiencePoints || 0,
        reward: reward || 0,
        order: order || 0,
        isRequired: isRequired !== undefined ? isRequired : true,
        estimatedTime,
      },
    });

    return res.status(201).json({
      success: true,
      data: task,
      message: 'Task created successfully',
    });
  } catch (error) {
    console.error('Create task error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create task',
      },
    });
  }
};

// ============================================
// GET TASK BY ID
// ============================================
export const getTaskById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            status: true,
            token: {
              select: {
                name: true,
                symbol: true,
                logoUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            submissions: true,
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Task not found',
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error('Get task error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch task',
      },
    });
  }
};

// ============================================
// GET CAMPAIGN TASKS
// ============================================
export const getCampaignTasks = async (req: Request, res: Response) => {
  try {
    const campaignId = req.params.campaignId as string;

    // Verify campaign exists
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Campaign not found',
        },
      });
    }

    const tasks = await prisma.task.findMany({
      where: {
        campaignId,
      },
      include: {
        _count: {
          select: {
            submissions: true,
          },
        },
      },
      orderBy: {
        order: 'asc',
      },
    });

    return res.status(200).json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    console.error('Get campaign tasks error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch tasks',
      },
    });
  }
};

// ============================================
// UPDATE TASK (CAMPAIGN OWNER only)
// ============================================
export const updateTask = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const id = req.params.id as string;

    // Check if task exists and user is campaign owner
    const existingTask = await prisma.task.findUnique({
      where: { id },
      include: {
        campaign: true,
      },
    });

    if (!existingTask) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Task not found',
        },
      });
    }

    if (existingTask.campaign.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only update tasks in your own campaigns',
        },
      });
    }

    const {
      title,
      description,
      type,
      verificationType,
      requirements,
      experiencePoints,
      reward,
      order,
      isRequired,
      estimatedTime,
    } = req.body;

    // Update task
    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(type && { type: type as TaskType }),
        ...(verificationType && { verificationType: verificationType as VerificationType }),
        ...(requirements !== undefined && { requirements }),
        ...(experiencePoints !== undefined && { experiencePoints }),
        ...(reward !== undefined && { reward }),
        ...(order !== undefined && { order }),
        ...(isRequired !== undefined && { isRequired }),
        ...(estimatedTime !== undefined && { estimatedTime }),
      },
    });

    return res.status(200).json({
      success: true,
      data: task,
      message: 'Task updated successfully',
    });
  } catch (error) {
    console.error('Update task error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update task',
      },
    });
  }
};

// ============================================
// DELETE TASK (CAMPAIGN OWNER only)
// ============================================
export const deleteTask = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const id = req.params.id as string;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        campaign: true,
        _count: {
          select: {
            submissions: true,
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Task not found',
        },
      });
    }

    if (task.campaign.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only delete tasks from your own campaigns',
        },
      });
    }

    // Don't allow deletion if there are submissions
    if (task._count.submissions > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'HAS_SUBMISSIONS',
          message: 'Cannot delete task with existing submissions',
        },
      });
    }

    await prisma.task.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    console.error('Delete task error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete task',
      },
    });
  }
};

// ============================================
// REORDER TASKS (CAMPAIGN OWNER only)
// ============================================
export const reorderTasks = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { campaignId, taskOrders } = req.body;

    // Verify campaign exists and user is owner
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Campaign not found',
        },
      });
    }

    if (campaign.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only reorder tasks in your own campaigns',
        },
      });
    }

    // Update task orders in transaction
    await prisma.$transaction(
      taskOrders.map((item: { taskId: string; order: number }) =>
        prisma.task.update({
          where: { id: item.taskId },
          data: { order: item.order },
        })
      )
    );

    // Get updated tasks
    const tasks = await prisma.task.findMany({
      where: { campaignId },
      orderBy: { order: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: tasks,
      message: 'Tasks reordered successfully',
    });
  } catch (error) {
    console.error('Reorder tasks error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to reorder tasks',
      },
    });
  }
};