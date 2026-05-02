import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import cloudinary from '../config/cloudinary';
import { Readable } from 'stream';

// Helper function to upload buffer to Cloudinary
const uploadToCloudinary = (buffer: Buffer, folder: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto' },
          { fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    Readable.from(buffer).pipe(stream);
  });
};

export const uploadProfileImage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE',
          message: 'No image file provided',
        },
      });
    }

    const userId = req.user!.userId;

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, `socialmine/profiles/${userId}`);

    return res.json({
      success: true,
      data: {
        url: result.secure_url,
        publicId: result.public_id,
      },
      message: 'Image uploaded successfully',
    });
  } catch (error) {
    console.error('Upload profile image error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'UPLOAD_FAILED',
        message: 'Failed to upload image',
      },
    });
  }
};

export const uploadPostImages = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILES',
          message: 'No image files provided',
        },
      });
    }

    const userId = req.user!.userId;

    // Upload all images to Cloudinary
    const uploadPromises = req.files.map((file) =>
      uploadToCloudinary(file.buffer, `socialmine/posts/${userId}`)
    );

    const results = await Promise.all(uploadPromises);

    const images = results.map((result) => ({
      url: result.secure_url,
      publicId: result.public_id,
    }));

    return res.json({
      success: true,
      data: {
        images,
      },
      message: 'Images uploaded successfully',
    });
  } catch (error) {
    console.error('Upload post images error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'UPLOAD_FAILED',
        message: 'Failed to upload images',
      },
    });
  }
};

// Upload task proof screenshot
export const uploadProofImage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE',
          message: 'No image file provided',
        },
      });
    }

    const userId = req.user!.userId;

    // Upload to Cloudinary in proof folder
    const result = await uploadToCloudinary(req.file.buffer, `socialmine/proofs/${userId}`);

    return res.json({
      success: true,
      data: {
        url: result.secure_url,
        publicId: result.public_id,
      },
      message: 'Proof image uploaded successfully',
    });
  } catch (error) {
    console.error('Upload proof image error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'UPLOAD_FAILED',
        message: 'Failed to upload proof image',
      },
    });
  }
};

export const deleteImage = async (req: AuthRequest, res: Response) => {
  try {
    const { publicId } = req.body;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Public ID is required',
        },
      });
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(publicId);

    return res.json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error) {
    console.error('Delete image error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_FAILED',
        message: 'Failed to delete image',
      },
    });
  }
};