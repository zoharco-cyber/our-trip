import { useAuth } from '../lib/auth';

export function Who({ id }: { id: string | null | undefined }) {
  const { nameOf, colorOf, profiles } = useAuth();
  const url = profiles.find((p) => p.id === id)?.avatar_url;
  return <span className="who-chip" style={{ ['--c' as any]: colorOf(id) }}>{url ? <img className="who-av" src={url} alt="" /> : <i className="dot" />}{nameOf(id)}</span>;
}

/** תמונת פרופיל עגולה, ואם אין — האות הראשונה בצבע שלה */
export function Face({ id, size = 40 }: { id: string | null | undefined; size?: number }) {
  const { profiles } = useAuth();
  const p = profiles.find((x) => x.id === id);
  return p?.avatar_url
    ? <img className="face" src={p.avatar_url} alt={p.display_name} style={{ width: size, height: size, ['--c' as any]: p.color }} />
    : <span className="face face-letter" style={{ width: size, height: size, fontSize: size * .45, ['--c' as any]: p?.color || '#888' }}>{p?.display_name[0] || '?'}</span>;
}
export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="empty"><b>{title}</b>{children && <p>{children}</p>}</div>;
}
