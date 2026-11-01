import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sb, q } from '../supabase';
import { lookups } from '../lookups';
import { CERT, date, money, PAY, pct, TYPES } from '../lib';
import { Loading, Stat, Table, useAction, useLoad } from '../ui';

export const FOLLOWUP_COLS = [
  { key: 'contract_ref', label: 'العقد', fmt: (v: any, r: any) => v || r.contract_no_original || '—' },
  { key: 'short_name', label: 'المشروع' }, { key: 'site_name', label: 'الموقع' }, { key: 'agency_name', label: 'الجهة' },
  { key: 'boq_no', label: 'المقايسة' }, { key: 'display_name', label: 'المستخلص' },
  { key: 'value', label: 'القيمة', fmt: (v: any) => money(v, 0) }, { key: 'net_to_bank', label: 'للبنك', fmt: (v: any) => money(v, 0) },
  { key: 'execution_pct', label: 'التنفيذ', fmt: pct, xl: (v: any) => v }, { key: 'payment_status', label: 'الصرف', fmt: (v: any) => PAY[v] },
  { key: 'insurance_cert', label: 'التأمينات', fmt: (v: any) => CERT[v] || '—' }, { key: 'labor_cert', label: 'القوة العاملة', fmt: (v: any) => CERT[v] || '—' },
  { key: 'station_name', label: 'المحطة' }, { key: 'days_in_station', label: 'الأيام' }, { key: 'last_note', label: 'آخر ملاحظة' },
];

// كشف المتابعة (م-701 → م-705)
export default function Followup() {
  const nav = useNavigate();
  const [f, setF] = useState<any>({ company: '1' });
  const a = useAction();
  const { data, error } = useLoad(async () => {
    const L = await lookups();
    const rows = await q(sb.rpc('followup', {
      p_company: Number(f.company), p_agency: f.agency ? Number(f.agency) : null, p_station: f.station || null,
      p_type: f.type || null, p_site: f.site ? Number(f.site) : null,
    }));
    const issues = await q(sb.from('followup_issues').select('id, issue_no, company_id, filters, summary, issued_at').order('issued_at', { ascending: false }).limit(30));
    return { L, rows: rows as any[], issues: issues as any[] };
  }, [f.company, f.agency, f.station, f.type, f.site]);
  if (!data) return <Loading error={error} />;
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const rows = data.rows.map((r) => ({ ...r, short_name: f.full ? r.project_name : r.short_name || r.project_name }));
  const total = rows.reduce((s, r) => s + Number(r.value || 0), 0);
  const unpaid = rows.filter((r) => ['unpaid', 'partially_paid'].includes(r.payment_status)).reduce((s, r) => s + Number(r.value || 0), 0);
  const noIns = rows.filter((r) => r.insurance_cert === 'not_done').length;
  const projects = new Set(rows.map((r) => r.project_id)).size;
  const matrix: Record<string, Record<string, number>> = {};
  rows.forEach((r) => { const ag = r.agency_name, st = r.station_name || '—'; matrix[ag] = matrix[ag] || {}; matrix[ag][st] = (matrix[ag][st] || 0) + Number(r.value || 0); });
  const stations = [...data.L.stations.map((s) => s.name), '—'].filter((s) => Object.values(matrix).some((m) => m[s]));
  return (
    <div className="stack">
      <div className="row between wrap">
        <h1>كشف المتابعة</h1>
        <button disabled={a.busy} onClick={() => a.run(async () => {
          const id = await q(sb.rpc('issue_followup', { p_company: Number(f.company), p_agency: f.agency ? Number(f.agency) : null, p_station: f.station || null, p_type: f.type || null, p_site: f.site ? Number(f.site) : null }));
          nav('/issues/' + id);
        })}>إصدار</button>
      </div>
      <a.Msg />
      <div className="filters">
        <select id="fu-company" value={f.company} onChange={set('company')}>{data.L.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select id="fu-agency" value={f.agency || ''} onChange={set('agency')}><option value="">كل الجهات</option>{data.L.agencies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select id="fu-station" value={f.station || ''} onChange={set('station')}><option value="">كل المحطات</option>{data.L.stations.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select>
        <select id="fu-type" value={f.type || ''} onChange={set('type')}><option value="">كل الأنواع</option>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select id="fu-site" value={f.site || ''} onChange={set('site')}><option value="">كل المواقع</option>{data.L.sites.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <label className="check"><input id="fu-full" type="checkbox" checked={!!f.full} onChange={(e) => setF({ ...f, full: e.target.checked })} /> الاسم كامل</label>
      </div>
      <div className="stats">
        <Stat label="المشروعات" value={projects} />
        <Stat label="إجمالي القيمة" value={money(total, 0)} sub={`${rows.length} مستخلص`} />
        <Stat label="اللي ماتصرفش" value={money(unpaid, 0)} />
        <Stat label="من غير شهادة تأمينات" value={noIns} tone={noIns ? 'warn' : ''} />
      </div>
      {Object.keys(matrix).length > 0 && (
        <div className="tbl"><table>
          <thead><tr><th>الجهة × المحطة</th>{stations.map((s) => <th key={s}>{s}</th>)}</tr></thead>
          <tbody>{Object.entries(matrix).map(([ag, m]) => <tr key={ag}><td>{ag}</td>{stations.map((s) => <td key={s} className="num">{m[s] ? money(m[s], 0) : ''}</td>)}</tr>)}</tbody>
        </table></div>
      )}
      <Table excel={'كشف المتابعة ' + data.L.company[Number(f.company)]?.name} rows={rows} link={(r) => '/extracts/' + r.extract_id}
        rowClass={(r) => (r.overdue ? 'overdue' : '')} cols={FOLLOWUP_COLS} />
      <p className="muted small">اللي ماتصرفش بيظهر لوحده. المدير يقدر يشيل أو يضيف أي مستخلص من «تعديل» في ملف المستخلص (م-702).</p>
      <section className="card">
        <h2>النسخ المُصدرة</h2>
        <Table rows={data.issues.map((i) => ({ ...i, company: data.L.company[i.company_id]?.name, n: i.summary?.extracts, total: i.summary?.total_value }))} search={false}
          link={(r) => '/issues/' + r.id}
          cols={[{ key: 'issue_no', label: 'رقم', fmt: (v) => 'نسخة ' + v }, { key: 'company', label: 'الشركة' }, { key: 'issued_at', label: 'التاريخ', fmt: date }, { key: 'n', label: 'المستخلصات' }, { key: 'total', label: 'القيمة', fmt: (v) => money(v, 0) }]} />
      </section>
      <p className="no-print"><Link to="/reports">التقارير التانية</Link></p>
    </div>
  );
}
