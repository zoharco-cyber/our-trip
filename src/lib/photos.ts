import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Photo } from './types';
import { safeFileName } from './util';
import { IMG, shrinkImage } from './image';
import { distanceKm, readGps } from './exif';
import type { Place } from './types';

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

export async function uploadPhotos(files: File[], opts: { placeId?: string | null; isPublic: boolean; userId: string; promptDay?: string }) {
  let failed = 0, linked = 0;
  // בלי נקודה שנבחרה: מנסים לשייך כל תמונה לנקודה הקרובה במפה לפי המיקום שבקובץ
  let places: Place[] = [];
  if (!opts.placeId) {
    const { data } = await supabase.from('places').select('*');
    places = (data || []) as Place[];
  }
  for (const f of files) {
    let placeId = opts.placeId || null;
    if (!placeId && places.length) {
      const gps = await readGps(f);
      if (gps) {
        const near = places.map((p) => ({ p, d: distanceKm(gps, p) })).sort((a, b) => a.d - b.d)[0];
        if (near && near.d <= 30) { placeId = near.p.id; linked++; }
      }
    }
    const blob = await shrinkImage(f, IMG.photo);
    const path = `${opts.userId}/${Date.now()}-${safeFileName(f.name.replace(/\.\w+$/, '.jpg'))}`;
    const up = await supabase.storage.from('photos').upload(path, blob, { contentType: blob.type || 'image/jpeg' });
    if (up.error) { failed++; continue; }
    await supabase.from('photos').insert({ path, place_id: placeId, is_public: opts.isPublic, prompt_day: opts.promptDay || null });
  }
  return { failed, linked };
}

export async function deletePhoto(p: Photo) {
  await supabase.storage.from('photos').remove([p.path]);
  await supabase.from('photos').delete().eq('id', p.id);
}
