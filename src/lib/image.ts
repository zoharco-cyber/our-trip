/** כיווץ תמונה לפני העלאה: חוסך גלישה בחו"ל ואת מקום האחסון החינמי. */
export const IMG = {
  photo: { max: 1600, q: 0.8 },     // גלריה ויומן: חד במסך של טלפון ומחשב
  receipt: { max: 1400, q: 0.72 },  // קבלות: מספיק כדי לקרוא סכומים
  doc: { max: 2400, q: 0.85 },      // סריקות של דרכון/ויזה: נשאר קריא גם בהגדלה
} as const;

export async function shrinkImage(file: File, opt: { max: number; q: number } = IMG.photo): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, opt.max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); // PNG שקוף לא יהפוך לשחור
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    const out: Blob | null = await new Promise((res) => c.toBlob(res, 'image/jpeg', opt.q));
    // אם במקרה יצא גדול יותר (תמונה שכבר כווצה), שומרים את המקורית
    return out && out.size < file.size ? out : file;
  } catch { return file; }
}

/** שם קובץ מתאים אחרי כיווץ (סיומת jpg אם הפך ל-JPEG) */
export const shrunkName = (name: string, blob: Blob, orig: File) => (blob !== orig ? name.replace(/\.\w+$/, '') + '.jpg' : name);
