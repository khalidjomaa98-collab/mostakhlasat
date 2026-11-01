import { useParams, Link } from 'react-router-dom';
import { sb, q } from '../supabase';
import { lookups } from '../lookups';
import { CERT, exportExcel, money, pct } from '../lib';
import { Loading, useLoad } from '../ui';
import { FOLLOWUP_COLS } from './Followup';

// نسخة مُصدرة من كشف المتابعة: بتتفتح بنفس أرقامها (م-705)، وبتتطبع PDF بترويسة الشركة (م-704)
export default function Issue() {
  const { id } = useParams();
  const { data, error } = useLoad(async () => {
    const [L, iss] = await Promise.all([lookups(), q(sb.from('followup_issues').select('*').eq('id', Number(id)).single())]);
    const people = (await q(sb.from('profiles').select('id, full_name'))) as any[];
    return { L, iss: iss as any, by: people.find((p) => p.id === (iss as any).issued_by)?.full_name };
  }, [id]);
  if (!data) return <Loading error={error} />;
  const { iss, L } = data;
  const h = iss.header, s = iss.summary, rows: any[] = iss.rows;
  const f = iss.filters || {};
  const title = ['كشف المتابعة', f.agency && L.agency[f.agency]?.name, f.station && L.station[f.station]?.name, f.site && L.site[f.site]?.name].filter(Boolean).join(' · ');
  const issued = new Date(iss.issued_at);
  const dayName = issued.toLocaleDateString('ar-EG', { weekday: 'long', timeZone: 'Africa/Cairo' });
  const dstr = issued.toLocaleDateString('en-GB', { timeZone: 'Africa/Cairo' });
  const logo = h.logo_path ? './' + h.logo_path : null;
  return (
    <div className="stack">
      <div className="row between no-print wrap gap">
        <Link to="/followup">← كشف المتابعة</Link>
        <div className="row gap">
          <button onClick={() => window.print()}>طباعة / PDF</button>
          <button className="ghost" onClick={() => exportExcel(`كشف المتابعة ${h.name} نسخة ${iss.issue_no}.xlsx`, [{ name: 'الكشف', cols: FOLLOWUP_COLS, rows }])}>إكسيل</button>
        </div>
      </div>
      <p className="muted small no-print">نسخة {iss.issue_no} · اتصدرت {issued.toLocaleString('en-GB', { timeZone: 'Africa/Cairo' })}{data.by ? ' · ' + data.by : ''}. الأرقام دي متجمّدة وقت الإصدار، حتى لو البيانات اتغيرت بعدها.</p>
      <article className="paper" style={{ ['--co' as any]: h.color }}>
        <header className="lh">
          {logo ? <img src={logo} alt={h.name} /> : <span />}
          <div className="co"><b>{h.name}</b>{h.header_line && <span>{h.header_line}</span>}</div>
          <div className="dt">{dayName} {dstr}<br />نسخة {iss.issue_no}</div>
        </header>
        <h2 className="paper-title">{title}</h2>
        <div className="paper-sum">
          <span>المشروعات: <b>{s.projects}</b></span><span>المستخلصات: <b>{s.extracts}</b></span>
          <span>الإجمالي: <b className="num">{money(s.total_value, 0)}</b></span><span>اللي ماتصرفش: <b className="num">{money(s.unpaid, 0)}</b></span>
          <span>من غير شهادة تأمينات: <b>{s.without_insurance}</b></span>
        </div>
        <table className="paper-table">
          <thead><tr><th>م</th><th>المشروع</th><th>العقد</th><th>المستخلص</th><th>القيمة</th><th>للبنك</th><th>التنفيذ</th><th>التأمينات</th><th>ق.ع</th><th>المحطة</th><th>الأيام</th><th>آخر ملاحظة</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.extract_id}>
                <td>{i + 1}</td><td>{r.short_name || r.project_name}</td><td>{r.contract_ref || r.contract_no_original || '—'}</td><td>{r.display_name}</td>
                <td className="num">{money(r.value, 0)}</td><td className="num">{money(r.net_to_bank, 0)}</td><td className="num">{pct(r.execution_pct)}</td>
                <td>{CERT[r.insurance_cert] || '—'}</td><td>{CERT[r.labor_cert] || '—'}</td><td>{r.station_name || '—'}</td><td className="num">{r.days_in_station ?? '—'}</td><td>{r.last_note || ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={4}>الإجمالي</td><td className="num">{money(s.total_value, 0)}</td><td className="num">{money(s.total_to_bank, 0)}</td><td colSpan={6}>ج.م</td></tr></tfoot>
        </table>
        {s.by_agency_station?.length > 0 && (
          <table className="paper-table small">
            <thead><tr><th>الجهة</th><th>المحطة</th><th>العدد</th><th>القيمة</th></tr></thead>
            <tbody>{s.by_agency_station.map((x: any, i: number) => <tr key={i}><td>{x.agency}</td><td>{x.station}</td><td>{x.n}</td><td className="num">{money(x.value, 0)}</td></tr>)}</tbody>
          </table>
        )}
      </article>
    </div>
  );
}
