import Package from '../models/Package.js';
import { deletePhoto } from './cloudinary.js';
import { isSupabaseEnabled, qs, supabaseRequest } from './supabase.js';

const RETENTION_DAYS = 30;

export async function runCleanup() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  if (isSupabaseEnabled()) {
    const stale = await supabaseRequest(`/packages${qs({
      created_at: `lt.${cutoff.toISOString()}`,
      select: 'id,photo_public_id,photo2_public_id'
    })}`);
    const withData = stale.filter(p => p.photo_public_id || p.photo2_public_id);
    if (withData.length === 0) return { cleaned: 0 };

    await Promise.all(withData.flatMap(p => [
      p.photo_public_id ? deletePhoto(p.photo_public_id) : null,
      p.photo2_public_id ? deletePhoto(p.photo2_public_id) : null
    ].filter(Boolean)));

    await Promise.all(withData.map(p => supabaseRequest(`/packages${qs({ id: `eq.${p.id}` })}`, {
      method: 'PATCH',
      body: JSON.stringify({
        photo_url: null,
        photo_public_id: null,
        photo_uploaded_at: null,
        photo2_url: null,
        photo2_public_id: null,
        photo2_uploaded_at: null,
        customer_phone: '',
        updated_at: new Date().toISOString(),
      }),
    })));

    console.log(`Cleanup: datos antiguos limpiados en ${withData.length} paquetes`);
    return { cleaned: withData.length };
  }

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
