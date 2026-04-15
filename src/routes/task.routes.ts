import { Router } from 'express';
import {
  createTask,
  getTaskById,
  getCampaignTasks,
  updateTask,
  deleteTask,
  reorderTasks,
} from '../controllers/task.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate, taskCreateSchema, taskUpdateSchema, taskReorderSchema } from '../utils/validation.util';

const router = Router();

/**
 * @route   POST /api/v1/tasks
 * @desc    Create a new task (CAMPAIGN OWNER only)
 * @access  Private
 */
router.post('/', authenticate, validate(taskCreateSchema), createTask);

/**
 * @route   GET /api/v1/tasks/:id
 * @desc    Get task by ID
 * @access  Public
 */
router.get('/:id', getTaskById);

/**
 * @route   GET /api/v1/tasks/campaign/:campaignId
 * @desc    Get all tasks for a campaign
 * @access  Public
 */
router.get('/campaign/:campaignId', getCampaignTasks);

/**
 * @route   PATCH /api/v1/tasks/:id
 * @desc    Update task (CAMPAIGN OWNER only)
 * @access  Private
 */
router.patch('/:id', authenticate, validate(taskUpdateSchema), updateTask);

/**
 * @route   DELETE /api/v1/tasks/:id
 * @desc    Delete task (CAMPAIGN OWNER only)
 * @access  Private
 */
router.delete('/:id', authenticate, deleteTask);

/**
 * @route   POST /api/v1/tasks/reorder
 * @desc    Reorder tasks in a campaign (CAMPAIGN OWNER only)
 * @access  Private
 */
router.post('/reorder', authenticate, validate(taskReorderSchema), reorderTasks);

export default router;