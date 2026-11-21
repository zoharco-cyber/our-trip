import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { BADGES, useBadges, type Badge } from '../lib/badges';
import { confetti } from '../lib/fx';

/** כשנפתח תג חדש: אנימציה גדולה במסך */
export default function BadgeWatcher() {
  const { me } = useAuth();
  const { earned, loading } = useBadges();
  const [show, setShow] = useState<Badge | null>(null);
  const mine = me?.is_traveler ? [...earned(me.id)].sort().join(',') : '';
  useEffect(() => {
    if (!me?.is_traveler || loading) return;
    const key = `trip:badgesSeen:${me.id}`;
    let seen: string[] | null = null;
    try { seen = JSON.parse(localStorage.getItem(key) || 'null'); } catch { /* ignore */ }
    const now = mine ? mine.split(',') : [];
    try { localStorage.setItem(key, JSON.stringify(now)); } catch { /* ignore */ }
    if (!seen) return;  // פעם ראשונה במכשיר: בלי הצפה של תגים ישנים
    const fresh = now.filter((b) => !seen!.includes(b));
    if (fresh.length) {
      setShow(BADGES.find((b) => b.id === fresh[fresh.length - 1]) || null);
      setTimeout(() => confetti(undefined, undefined, 160, ['🏅', '✨', '⭐']), 300);
    }
  }, [mine, loading]);
  if (!show) return null;
  return (
    <div className="badge-pop" role="dialog" aria-modal="true" onClick={() => setShow(null)}>
      <div className="bp-card" onClick={(e) => e.stopPropagation()}>
        <span className="bp-kicker">🏅 תג חדש!</span>
        <span className="bp-icon">{show.icon}</span>
        <b className="bp-name">{show.name}</b>
        <span className="bp-how">{show.how}</span>
        <div className="row gap">
          <a className="btn btn-primary" href="#/badges" onClick={() => setShow(null)}>לכל התגים</a>
          <button className="btn" onClick={() => setShow(null)}>יש!</button>
        </div>
      </div>
    </div>
  );
}
