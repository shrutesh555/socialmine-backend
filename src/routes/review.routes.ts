import { Router } from 'express';
import {
  reviewSubmission,
  getPendingReviews,
  getReviewById,
  bulkReviewSubmissions,
  getReviewStatistics,
} from '../controllers/review.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate, reviewCreateSchema, bulkReviewSchema } from '../utils/validation.util';

const router = Router();

/**
 * IMPORTANT: Specific routes MUST come BEFORE parameterized routes!
 * Otherwise /:id will catch everything
 */

/**
 * @route   POST /api/v1/reviews
 * @desc    Review a submission (CAMPAIGN OWNER only)
 * @access  Private
 */
router.post('/', authenticate, validate(reviewCreateSchema), reviewSubmission);

/**
 * @route   POST /api/v1/reviews/bulk
 * @desc    Bulk review submissions (CAMPAIGN OWNER only)
 * @access  Private
 */
router.post('/bulk', authenticate, validate(bulkReviewSchema), bulkReviewSubmissions);

/**
 * @route   GET /api/v1/reviews/pending
 * @desc    Get pending reviews (OWNER)
 * @access  Private
 */
router.get('/pending', authenticate, getPendingReviews);

/**
 * @route   GET /api/v1/reviews/stats
 * @desc    Get review statistics (OWNER)
 * @access  Private
 */
router.get('/stats', authenticate, getReviewStatistics);

/**
 * @route   GET /api/v1/reviews/:id
 * @desc    Get review by ID
 * @access  Private
 * NOTE: This MUST be last among GET routes!
 */
router.get('/:id', authenticate, getReviewById);

export default router;