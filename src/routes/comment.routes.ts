// src/routes/comment.routes.ts
import { Router } from 'express';
import {
  createComment,
  getComments,
  updateComment,
  deleteComment,
  likeComment,
  unlikeComment,
} from '../controllers/comment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate, createCommentSchema, updateCommentSchema } from '../utils/validation.util';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Comment CRUD
router.post('/', validate(createCommentSchema), createComment);
router.get('/post/:postId', getComments);
router.put('/:id', validate(updateCommentSchema), updateComment);
router.delete('/:id', deleteComment);

// Like/Unlike
router.post('/:id/like', likeComment);
router.delete('/:id/like', unlikeComment);

export default router;