import { Router } from 'express';
import { uploadProfileImage, uploadPostImages, uploadProofImage, deleteImage } from '../controllers/upload.controller';
import { authenticate } from '../middleware/auth.middleware';
import { uploadSingle, uploadMultiple } from '../middleware/upload.middleware';

const router = Router();

router.use(authenticate);

router.post('/profile', uploadSingle, uploadProfileImage);
router.post('/post', uploadMultiple, uploadPostImages);
router.post('/proof', uploadSingle, uploadProofImage);

router.delete('/image', deleteImage);

export default router;
