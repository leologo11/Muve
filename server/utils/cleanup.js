import { deletePhoto } from './cloudinary.js';
import { qs, supabaseRequest, isSupabaseEnabled } from './supabase.js';

const RETENTION_DAYS = 30;

export async function runCleanup() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  if (isSupabaseEnabled()) {
    const stale = await supabaseRequest(`/packages${qs({ created_at: `lt.${cutoff.toISOString()}`, select: 'id,photo_public_id,photo2_public_id' })}`);
    const withData = (stale || []).filter(p => p.photo_public_id || p.photo2_public_id);
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
  return { cleaned: 0 };
}
