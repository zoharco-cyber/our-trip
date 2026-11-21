import { ChangeEvent, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useTable } from '../lib/useTable';
import { uploadPhotos, usePhotoUrls } from '../lib/photos';
import { promptFor } from '../data/daily';
import type { Photo } from '../lib/types';
import { todayISO } from '../lib/util';
import { confetti } from '../lib/fx';

/** אתגר הצילום של היום, לדף הבית */
export default function PhotoPrompt() {
  const { me } = useAuth();
  const day = todayISO();
  const photos = useTable<Photo>('photos', { order: 'created_at', filter: (q) => q.eq('prompt_day', day) }, [day]);
  const urls = usePhotoUrls(photos.rows);
  const [busy, setBusy] = useState(false);
  const mineDone = photos.rows.some((p) => p.created_by === me?.id);

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []); e.target.value = '';
    if (!files.length || !me) return;
    setBusy(true);
    const { failed } = await uploadPhotos(files.slice(0, 1), { isPublic: false, userId: me.id, promptDay: day });
    setBusy(false);
    if (!failed) confetti(undefined, undefined, 80, ['📸', '✨']);
    photos.reload();
  }
  return (
    <section className="photo-prompt">
      <span className="pp-kicker">📷 אתגר הצילום של היום</span>
      <b className="pp-text">{promptFor(day)}</b>
      {photos.rows.length > 0 && (
        <div className="pp-thumbs">{photos.rows.map((p) => urls[p.path] && <img key={p.id} src={urls[p.path]} alt="" loading="lazy" />)}</div>
      )}
      {me?.is_traveler && (
        <label className={'btn btn-small upload-btn' + (mineDone ? '' : ' btn-primary')}>
          {busy ? 'מעלה…' : mineDone ? '✓ צילמת! להוסיף עוד' : 'לצלם ולהעלות'}
          <input type="file" accept="image/*" capture="environment" hidden onChange={pick} disabled={busy} />
        </label>
      )}
    </section>
  );
}
