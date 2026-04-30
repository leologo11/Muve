import Package from '../models/Package.js';
import { deletePhoto } from './cloudinary.js';

const RETENTION_DAYS = 30;

export async function runCleanup() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const stale = await Package.find({
    createdAt: { $lt: cutoff },
    $or: [
      { photoPublicId: { $exists: true, $ne: null } },
      { photo2PublicId: { $exists: true, $ne: null } },
      { customerPhone: { $exists: true, $ne: null } }
    ]
  }).select('_id photoPublicId photo2PublicId');

  if (stale.length === 0) return { cleaned: 0 };

  await Promise.all(stale.flatMap(p => [
    p.photoPublicId ? deletePhoto(p.photoPublicId) : null,
    p.photo2PublicId ? deletePhoto(p.photo2PublicId) : null
  ].filter(Boolean)));

  await Package.updateMany(
    { _id: { $in: stale.map(p => p._id) } },
    {
      $unset: {
        photoUrl: '', photoPublicId: '', photoUploadedAt: '',
        photo2Url: '', photo2PublicId: '', photo2UploadedAt: '',
        customerPhone: ''
      }
    }
  );

  console.log(`🧹 Cleanup: cleared photos/phone from ${stale.length} packages older than ${RETENTION_DAYS} days`);
  return { cleaned: stale.length };
}
