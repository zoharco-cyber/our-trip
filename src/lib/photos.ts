import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Photo } from './types';
import { safeFileName } from './util';

/** כתובות זמניות לתמונות (התיקייה פרטית) */
export function usePhotoUrls(photos: Photo[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const paths = photos.map((p) => p.path).filter((p) => !urls[p]);
  const key = paths.join('|');
  useEffect(() => {
    if (!paths.length) return;
    supabase.storage.from('photos').createSignedUrls(paths, 60 * 60 * 6).then(({ data }) => {
      if (!data) return;
      setUrls((u) => {
        const n = { ...u };
        data.forEach((d) => { if (d.signedUrl && d.path) n[d.path] = d.signedUrl; });
        return n;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}

/** מקטין תמונה לפני העלאה כדי לחסוך מקום ונתונים */
async function shrink(file: File, max = 2000): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', 0.85));
  } catch { return file; }
}

export async function uploadPhotos(files: File[], opts: { placeId?: string | null; isPublic: boolean; userId: string }) {
  let failed = 0;
  for (const f of files) {
    const blob = await shrink(f);
    const path = `${opts.userId}/${Date.now()}-${safeFileName(f.name.replace(/\.\w+$/, '.jpg'))}`;
    const up = await supabase.storage.from('photos').upload(path, blob, { contentType: blob.type || 'image/jpeg' });
    if (up.error) { failed++; continue; }
    await supabase.from('photos').insert({ path, place_id: opts.placeId || null, is_public: opts.isPublic });
  }
  return failed;
}

export async function deletePhoto(p: Photo) {
  await supabase.storage.from('photos').remove([p.path]);
  await supabase.from('photos').delete().eq('id', p.id);
}
