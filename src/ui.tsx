import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { type Col, exportExcel } from './lib';

export function useLoad<T>(fn: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setError(null);
    fn().then((d) => live && setData(d)).catch((e) => live && setError(e.message));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, reload: () => setTick((t) => t + 1) };
}

export function Loading({ error }: { error?: string | null }) {
  return error ? <div className="msg err">{error}</div> : <div className="muted pad">جاري التحميل…</div>;
}

export function Pill({ tone = 'gray', children }: { tone?: string; children: ReactNode }) {
  return <span className={'pill ' + tone}>{children}</span>;
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className={'stat ' + (tone || '')}>
      <span className="stat-label">{label}</span>
      <b className="num">{value}</b>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

// جدول عام: بحث، ترتيب بالضغط على العنوان، وتصدير لإكسيل (م-905)
export function Table({ cols, rows, link, excel, empty = 'مفيش بيانات', search = true, rowClass }:
  { cols: Col[]; rows: any[]; link?: (r: any) => string; excel?: string; empty?: string; search?: boolean; rowClass?: (r: any) => string }) {
  const [s, setS] = useState('');
  const [sort, setSort] = useState<{ k: string; d: 1 | -1 } | null>(null);
  const view = useMemo(() => {
    let v = rows;
    if (s.trim()) {
      const t = s.trim();
      v = v.filter((r) => cols.some((c) => String(r[c.key] ?? '').includes(t)));
    }
    if (sort) {
      v = [...v].sort((a, b) => {
        const x = a[sort.k], y = b[sort.k];
        if (x === y) return 0; if (x === null || x === undefined) return 1; if (y === null || y === undefined) return -1;
        return (typeof x === 'number' || !isNaN(Number(x)) && !isNaN(Number(y)) ? Number(x) - Number(y) : String(x).localeCompare(String(y), 'ar')) * sort.d;
      });
    }
    return v;
  }, [rows, s, sort, cols]);
  return (
    <div className="table-wrap">
      {(search || excel) && (
        <div className="table-tools">
          {search && <input id={'search-' + (excel || 'table')} className="search" placeholder="دوّر في الجدول…" value={s} onChange={(e) => setS(e.target.value)} />}
          <span className="muted small">{view.length} صف</span>
          {excel && <button className="ghost" onClick={() => exportExcel(excel + '.xlsx', [{ name: excel, cols, rows: view }])}>إكسيل</button>}
        </div>
      )}
      <div className="tbl">
        <table>
          <thead><tr>{cols.map((c) => (
            <th key={c.key} onClick={() => setSort((o) => ({ k: c.key, d: o && o.k === c.key && o.d === 1 ? -1 : 1 }))}>
              {c.label}{sort?.k === c.key ? (sort.d === 1 ? ' ▲' : ' ▼') : ''}
            </th>))}</tr></thead>
          <tbody>
            {view.length === 0 && <tr><td colSpan={cols.length} className="muted center">{empty}</td></tr>}
            {view.map((r, i) => (
              <tr key={r.id ?? r.extract_id ?? i} className={rowClass ? rowClass(r) : ''}>
                {cols.map((c, j) => (
                  <td key={c.key} className={typeof r[c.key] === 'number' ? 'num' : ''}>
                    {j === 0 && link ? <Link to={link(r)}>{c.fmt ? c.fmt(r[c.key], r) : r[c.key] ?? '—'}</Link> : c.fmt ? c.fmt(r[c.key], r) : r[c.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="modal-head"><h3>{title}</h3><button className="ghost" onClick={onClose}>إغلاق</button></div>
        {children}
      </div>
    </div>
  );
}

// زرار بيعمل عملية ويعرض الخطأ اللي القاعدة رجعته
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  async function run(fn: () => Promise<any>, success?: string) {
    setBusy(true); setErr(null); setOk(null);
    try { await fn(); if (success) setOk(success); return true; }
    catch (e: any) { setErr(e.message); return false; }
    finally { setBusy(false); }
  }
  const Msg = () => <>{err && <div className="msg err">{err}</div>}{ok && <div className="msg ok">{ok}</div>}</>;
  return { busy, err, ok, run, Msg, setErr };
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small className="muted">{hint}</small>}</label>;
}
