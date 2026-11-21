import { useAuth } from '../lib/auth';
import { BADGES, useBadges } from '../lib/badges';

export default function Badges() {
  const { travelers, me } = useAuth();
  const { earned } = useBadges();
  const order = [...travelers].sort((a, b) => (a.id === me?.id ? -1 : b.id === me?.id ? 1 : 0));
  return (
    <div className="stack-lg">
      <div>
        <h1>תגים</h1>
        <p className="muted">תגים נפתחים לבד כשעושים דברים באתר ובטיול. כמה תאספו?</p>
      </div>
      {order.map((t) => {
        const e = earned(t.id);
        return (
          <section key={t.id} className="stack">
            <div className="row-between">
              <h2>{t.id === me?.id ? 'התגים שלי' : t.display_name.split(' ')[0]}</h2>
              <span className="tnum small badge-count" style={{ ['--c' as any]: t.color }}>{e.size}/{BADGES.length}</span>
            </div>
            <ul className="badge-grid">
              {BADGES.map((b) => (
                <li key={b.id} className={'badge-tile' + (e.has(b.id) ? ' on' : '')} style={{ ['--c' as any]: t.color }} title={b.how}>
                  <span className="bt-icon" aria-hidden="true">{e.has(b.id) ? b.icon : '🔒'}</span>
                  <b>{b.name}</b>
                  <span className="small">{b.how}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
