export const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDateTime = (d: string | Date) =>
  new Date(d).toLocaleString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const todayISO = () => new Date().toLocaleDateString('en-CA');

/** יום ראשון של השבוע של התאריך */
export function weekStart(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay());
  return x.toLocaleDateString('en-CA');
}
export function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const x = new Date(y, m - 1, d + n);
  return x.toLocaleDateString('en-CA');
}
export const safeFileName = (n: string) => n.replace(/[^\w.\-]+/g, '_').slice(-80) || 'file';
export const fmtSize = (b: number | null) =>
  !b ? '' : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`;
