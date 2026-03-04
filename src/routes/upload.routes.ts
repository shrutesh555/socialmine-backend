import { Router } from 'express';
import { uploadProfileImage, uploadPostImages, deleteImage } from '../controllers/upload.controller';
import { authenticate } from '../middleware/auth.middleware';
import { uploadSingle, uploadMultiple } from '../middleware/upload.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Upload profile image
router.post('/profile', uploadSingle, uploadProfileImage);

// Upload post images (up to 5)
router.post('/post', uploadMultiple, uploadPostImages);

// Delete image
router.delete('/image', deleteImage);

export default router;