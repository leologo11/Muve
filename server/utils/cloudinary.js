import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'routiflow/packages',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'heic'],
    transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }],
    // Tag for lifecycle management (30-day cleanup)
    tags: ['routiflow', 'delivery_photo']
  }
});

export const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

export async function deletePhoto(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Cloudinary delete error:', err.message);
  }
}

export { cloudinary };
