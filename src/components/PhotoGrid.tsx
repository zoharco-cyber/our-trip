import { useState } from 'react';
import type { Photo } from '../lib/types';
import { usePhotoUrls, deletePhoto } from '../lib/photos';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Who } from './Avatar';

export default function PhotoGrid({ photos, onChange, placeName }: { photos: Photo[]; onChange: () => void; placeName?: (id: string | null) => string | undefined }) {
  const { guest } = useAuth();
  const urls = usePhotoUrls(photos);
  const [idx, setIdx] = useState<number | null>(null);
  const cur = idx !== null ? photos[idx] : null;

  async function togglePublic(p: Photo) {
    await supabase.from('photos').update({ is_public: !p.is_public }).eq('id', p.id); onChange();
  }

  return (
    <>
      <div className="photo-grid">
        {photos.map((p, i) => (
          <button key={p.id} className="photo" onClick={() => setIdx(i)}>
            {urls[p.path] ? <img src={urls[p.path]} alt={p.caption || ''} loading="lazy" /> : <span className="ph" />}
            {!guest && p.is_public && <span className="badge">גלוי לאורחים</span>}
          </button>
        ))}
      </div>
      {cur && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setIdx(null)}>
          <div className="lb-inner" onClick={(e) => e.stopPropagation()}>
            {urls[cur.path] && <img src={urls[cur.path]} alt={cur.caption || ''} />}
            <div className="lb-bar">
              <span className="small">
                {placeName?.(cur.place_id) && <b>{placeName(cur.place_id)} · </b>}
                {!guest && <Who id={cur.created_by} />}
              </span>
              <span className="row gap">
                <button className="btn btn-small" onClick={() => setIdx((idx! - 1 + photos.length) % photos.length)}>הקודמת</button>
                <button className="btn btn-small" onClick={() => setIdx((idx! + 1) % photos.length)}>הבאה</button>
                {!guest && <>
                  <button className="btn btn-small" onClick={() => togglePublic(cur)}>{cur.is_public ? 'הסתרה מאורחים' : 'הצגה לאורחים'}</button>
                  <button className="btn btn-small danger" onClick={async () => { await deletePhoto(cur); setIdx(null); onChange(); }}>מחיקה</button>
                </>}
                <button className="btn btn-small" onClick={() => setIdx(null)}>סגירה</button>
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
