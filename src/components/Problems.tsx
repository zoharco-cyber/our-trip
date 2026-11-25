import { Component, ReactNode, useState } from 'react';
import { autoReport, reloadIfStale, sendReport } from '../lib/health';

/** "משהו לא עובד?" — שולח למנהל דיווח עם כל הפרטים הטכניים, בלי צילומי מסך */
export function ReportProblem({ compact, preset }: { compact?: boolean; preset?: string }) {
  const [open, setOpen] = useState(!!preset);
  const [text, setText] = useState(preset || '');
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'queued' | 'error'>('idle');
  async function send() {
    if (!text.trim()) return;
    setState('busy');
    const r = await sendReport(text);
    setState(r === 'ok' ? 'ok' : r === 'queued' ? 'queued' : 'error');
    if (r !== 'error') setText('');
  }
  if (state === 'ok' || state === 'queued') return (
    <div className={'report-box' + (compact ? '' : ' card')}>
      <p><b>{state === 'ok' ? '📩 נשלח לזוהר. תודה!' : '📩 נשמר, ויישלח לזוהר כשתחזור קליטה.'}</b></p>
      <p className="small muted">הוא מקבל את כל הפרטים הטכניים, אז לא צריך לשלוח צילומי מסך.</p>
      <button className="btn btn-small" onClick={() => { setState('idle'); setOpen(false); }}>סגירה</button>
    </div>
  );
  return (
    <div className={'report-box' + (compact ? '' : ' card')}>
      {!open ? (
        <button className="btn" onClick={() => setOpen(true)}>🛠️ משהו לא עובד?</button>
      ) : (
        <div className="stack">
          <b>🛠️ מה לא עובד?</b>
          <textarea id="report-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="למשל: לחצתי על 'שמירה' ביומן ושום דבר לא קרה" />
          <p className="small muted">יחד עם ההודעה נשלחים אוטומטית: סוג הטלפון, הגרסה, העמוד והשגיאות האחרונות.</p>
          <div className="row gap">
            <button className="btn btn-primary" disabled={!text.trim() || state === 'busy'} onClick={send}>{state === 'busy' ? 'שולחת…' : 'שליחה לזוהר'}</button>
            <button className="btn" onClick={() => setOpen(false)}>ביטול</button>
          </div>
          {state === 'error' && <p className="small bad">לא נשלח. נסי שוב בעוד רגע.</p>}
        </div>
      )}
    </div>
  );
}

/** במקום מסך לבן: הודעה נעימה, דיווח אוטומטי לזוהר ואפשרות לנסות שוב */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    if (reloadIfStale(error.message)) return;
    autoReport(error.message || String(error), { stack: String(error.stack || '').slice(0, 1200), component: String(info.componentStack || '').slice(0, 800), boundary: true });
  }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash card stack">
        <div className="crash-ico" aria-hidden="true">🙈</div>
        <h2>אופס, משהו השתבש בעמוד הזה</h2>
        <p>זוהר כבר קיבל הודעה על זה. בינתיים אפשר לנסות שוב או לעבור לעמוד אחר. שום דבר ממה ששמרת לא נמחק.</p>
        <div className="row gap wrap">
          <button className="btn btn-primary" onClick={() => this.setState({ error: null })}>לנסות שוב</button>
          <button className="btn" onClick={() => location.reload()}>טעינה מחדש</button>
          <a className="btn" href="#/">לדף הבית</a>
        </div>
        <ReportProblem compact />
      </div>
    );
  }
}
