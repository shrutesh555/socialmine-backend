import { Router } from 'express';
import {
  createPayment,
  getPaymentHistory,
  getPendingPayments,
  processPayment,
  getPaymentById,
  getUserEarnings,
  distributeCampaignRewards,
} from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate, paymentCreateSchema, paymentProcessSchema } from '../utils/validation.util';

const router = Router();

/**
 * @route   POST /api/v1/payments
 * @desc    Create a payment (CAMPAIGN OWNER)
 * @access  Private
 */
router.post('/', authenticate, validate(paymentCreateSchema), createPayment);

/**
 * @route   POST /api/v1/payments/distribute
 * @desc    Distribute campaign rewards (bulk payment)
 * @access  Private
 */
router.post('/distribute', authenticate, distributeCampaignRewards);

/**
 * @route   GET /api/v1/payments/pending
 * @desc    Get pending payments (OWNER)
 * @access  Private
 */
router.get('/pending', authenticate, getPendingPayments);

/**
 * @route   GET /api/v1/payments/earnings
 * @desc    Get user earnings summary
 * @access  Private
 */
router.get('/earnings', authenticate, getUserEarnings);

/**
 * @route   GET /api/v1/payments/history
 * @desc    Get payment history (sent or received)
 * @access  Private
 */
router.get('/history', authenticate, getPaymentHistory);

/**
 * @route   GET /api/v1/payments/:id
 * @desc    Get payment by ID
 * @access  Private
 */
router.get('/:id', authenticate, getPaymentById);

/**
 * @route   PATCH /api/v1/payments/:id/process
 * @desc    Process payment (mark as completed/failed)
 * @access  Private
 */
router.patch('/:id/process', authenticate, validate(paymentProcessSchema), processPayment);

export default router;