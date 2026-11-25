import { supabase } from './supabase';

/** חיתוך ריבועי מהמרכז + הקטנה ל-400px, ואז העלאה לתיקייה של המשתמשת */
async function squareJpeg(file: File, size = 400): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height);
  const c = document.createElement('canvas'); c.width = c.height = size;
  c.getContext('2d')!.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  bmp.close?.();
  return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/jpeg', 0.85));
}

/** מעלה תמונת פרופיל ושומרת בפרופיל. מחזיר את הכתובת או null */
export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  try {
    const blob = await squareJpeg(file);
    const path = `${userId}/${Date.now()}.jpg`;
    const up = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (up.error) return null;
    const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
    if (error) return null;
    try { const c = JSON.parse(localStorage.getItem('cache:profiles') || '[]'); localStorage.setItem('cache:profiles', JSON.stringify(c.map((p: any) => (p.id === userId ? { ...p, avatar_url: url } : p)))); } catch { /* ignore */ }
    return url;
  } catch { return null; }
}
