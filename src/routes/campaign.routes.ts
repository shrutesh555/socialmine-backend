import { Router } from 'express';
import {
  createCampaign,
  getAllCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  joinCampaign,
  getMyCampaigns,
  getCampaignParticipants,
} from '../controllers/campaign.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate, campaignCreateSchema, campaignUpdateSchema } from '../utils/validation.util';

const router = Router();

/**
 * @route   POST /api/v1/campaigns
 * @desc    Create a new campaign (PROJECT_OWNER only)
 * @access  Private
 */
router.post('/', authenticate, validate(campaignCreateSchema), createCampaign);

/**
 * @route   GET /api/v1/campaigns
 * @desc    Get all campaigns (with filters)
 * @access  Public
 */
router.get('/', getAllCampaigns);

/**
 * @route   GET /api/v1/campaigns/my
 * @desc    Get my campaigns (logged in owner)
 * @access  Private
 */
router.get('/my', authenticate, getMyCampaigns);

/**
 * @route   GET /api/v1/campaigns/:id
 * @desc    Get campaign by ID
 * @access  Public
 */
router.get('/:id', getCampaignById);

/**
 * @route   PATCH /api/v1/campaigns/:id
 * @desc    Update campaign (OWNER only)
 * @access  Private
 */
router.patch('/:id', authenticate, validate(campaignUpdateSchema), updateCampaign);

/**
 * @route   DELETE /api/v1/campaigns/:id
 * @desc    Delete campaign (OWNER only)
 * @access  Private
 */
router.delete('/:id', authenticate, deleteCampaign);

/**
 * @route   POST /api/v1/campaigns/:id/join
 * @desc    Join campaign (MINER only)
 * @access  Private
 */
router.post('/:id/join', authenticate, joinCampaign);

/**
 * @route   GET /api/v1/campaigns/:id/participants
 * @desc    Get campaign participants
 * @access  Public
 */
router.get('/:id/participants', getCampaignParticipants);

export default router;