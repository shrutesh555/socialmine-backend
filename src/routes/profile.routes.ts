// src/routes/profile.routes.ts
import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getUserPosts,
} from '../controllers/profile.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate, updateProfileSchema } from '../utils/validation.util';

const router = Router();

// Public routes (no auth required)
router.get('/:username', authenticate, getProfile);
router.get('/:username/posts', getUserPosts);
router.get('/:username/followers', getFollowers);
router.get('/:username/following', getFollowing);

// Protected routes (auth required)
router.put('/me', authenticate, validate(updateProfileSchema), updateProfile);
router.post('/:username/follow', authenticate, followUser);
router.delete('/:username/follow', authenticate, unfollowUser);

export default router;