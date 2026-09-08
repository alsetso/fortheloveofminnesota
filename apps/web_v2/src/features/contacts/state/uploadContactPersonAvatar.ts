/**
 * Upload a contact person photo to Supabase storage, return public URL.
 * Reuses profile-images bucket under {userId}/contacts/{personId}/…
 */
import { createClient } from '@/lib/supabase/client';

export async function uploadContactPersonAvatar(
  personId: string,
  file: File,
): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Image must be under 5MB.');

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const ext =
    (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${user.id}/contacts/${personId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage.from('profile-images').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data: urlData } = supabase.storage.from('profile-images').getPublicUrl(path);
  if (!urlData?.publicUrl) throw new Error('Could not get image URL.');
  return urlData.publicUrl;
}
