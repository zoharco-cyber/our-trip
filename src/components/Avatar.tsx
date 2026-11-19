import { useAuth } from '../lib/auth';

export function Who({ id }: { id: string | null | undefined }) {
  const { nameOf, colorOf } = useAuth();
  return <span className="who-chip" style={{ ['--c' as any]: colorOf(id) }}><i className="dot" />{nameOf(id)}</span>;
}
export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="empty"><b>{title}</b>{children && <p>{children}</p>}</div>;
}
