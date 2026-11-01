import { Link } from 'react-router-dom';
import { sb, q } from '../supabase';
import { money } from '../lib';
import { Loading, Stat, Table, useLoad } from '../ui';
import { useMe } from '../App';

// الرئيسية (م-801)
export default function Home() {
  const me = useMe();
  const { data, error } = useLoad(async () => {
    const [home, alerts, missing, backup] = await Promise.all([
      q(sb.from('home_summary').select('*').single()),
      q(sb.from('alerts').select('*')),
      q(sb.from('missing_data').select('issue')),
      me.role === 'manager' ? q(sb.from('backup_status').select('*').maybeSingle()) : Promise.resolve(null),
    ]);
    const ids = [...new Set((alerts as any[]).map((a) => a.extract_id))];
    const names = ids.length ? await q(sb.from('followup_rows').select('extract_id, contract_ref, short_name, display_name, company_name').in('extract_id', ids)) : [];
    const byId = Object.fromEntries((names as any[]).map((n) => [n.extract_id, n]));
    return { home, alerts: (alerts as any[]).map((a) => ({ ...a, ...byId[a.extract_id] })), missing, backup };
  });
  if (!data) return <Loading error={error} />;
  const h: any = data.home;
  const stations: any[] = h.by_station;
  const maxV = Math.max(1, ...stations.map((s) => Number(s.value)));
  const b: any = data.backup;
  return (
    <div className="stack">
      <h1>الرئيسية</h1>
      {b?.reminder && <div className="msg warn">آخر نسخة احتياطية {b.last_taken_at ? `من ${b.days_since} يوم` : 'لسه ما اتعملتش'}. <Link to="/settings">نزّل نسخة دلوقتي</Link> وحطها على الفلاشة.</div>}
      <div className="stats">
        <Stat label="لم يُصرف" value={money(h.unpaid_total, 0)} sub={`${h.unpaid_count} مستخلص`} />
        <Stat label="المحتجز" value={money(h.withheld_total, 0)} sub="ضمان + تأمين نهائي + تعلية" />
        <Stat label="عدّوا حد التأخير" value={h.overdue_count} tone={h.overdue_count ? 'bad' : ''} />
        <Stat label="في استيفاء" value={h.istifaa_count} tone={h.istifaa_count ? 'warn' : ''} />
        <Stat label="بيانات ناقصة" value={(data.missing as any[]).length} sub={<Link to="/missing">افتح القايمة</Link>} />
      </div>
      <section className="card">
        <h2>اللي ماتصرفش حسب المحطة</h2>
        <div className="bars">
          {stations.map((s) => (
            <div className="bar-row" key={s.code}>
              <span>{s.name}</span>
              <div className="bar"><i style={{ width: (Number(s.value) / maxV) * 100 + '%' }} /></div>
              <span className="num">{money(s.value, 0)}</span>
              <span className="muted small">{s.n}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="card">
        <h2>محتاج تتصرف ({data.alerts.length})</h2>
        <Table excel="التنبيهات" rows={data.alerts} link={(r) => '/extracts/' + r.extract_id}
          cols={[
            { key: 'display_name', label: 'المستخلص', fmt: (v, r) => `${r.contract_ref || '—'} · ${v}` },
            { key: 'short_name', label: 'المشروع' },
            { key: 'company_name', label: 'الشركة' },
            { key: 'message', label: 'التنبيه' },
          ]} />
      </section>
    </div>
  );
}
