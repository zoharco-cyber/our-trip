import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useTable } from '../lib/useTable';
import type { Photo, Place } from '../lib/types';
import PhotoGrid from '../components/PhotoGrid';
import PhotoUpload from '../components/PhotoUpload';
import { Empty } from '../components/Avatar';

export default function Gallery() {
  const { guest, travelers } = useAuth();
  const photos = useTable<Photo>('photos', { order: 'created_at', ascending: false });
  const places = useTable<Place>('places');
  const [who, setWho] = useState('all');
  const [onlyPublic, setOnlyPublic] = useState(false);
  const list = photos.rows.filter((p) => (who === 'all' || p.created_by === who) && (!onlyPublic || p.is_public));

  return (
    <div className="stack-lg">
      <div className="row-between wrap">
        <div>
          <h1>גלריה</h1>
          <p className="muted">{guest ? 'תמונות שהבנות בחרו לשתף' : 'כדי שתמונה תופיע לאורחים, פותחים אותה ובוחרים "הצגה לאורחים".'}</p>
        </div>
        {!guest && <PhotoUpload onDone={photos.reload} />}
      </div>
      {!guest && (
        <div className="row gap wrap">
          <select id="gal-who" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="all">של כולן</option>
            {travelers.map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}
          </select>
          <label className="check small"><input type="checkbox" checked={onlyPublic} onChange={(e) => setOnlyPublic(e.target.checked)} /><span>רק מה שגלוי לאורחים</span></label>
        </div>
      )}
      {list.length === 0 ? <Empty title="אין תמונות עדיין">{guest ? 'בקרוב יגיעו תמונות מהדרך.' : 'העלי תמונה ראשונה, כאן או מתוך נקודה במפה.'}</Empty>
        : <PhotoGrid photos={list} onChange={photos.reload} placeName={(id) => places.rows.find((p) => p.id === id)?.name} />}
    </div>
  );
}
