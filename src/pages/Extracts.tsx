import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sb, q } from '../supabase';
import { lookups } from '../lookups';
import { money, PAY, pct, STATUS, TYPES } from '../lib';
import { Loading, Table, useLoad } from '../ui';

export default function Extracts() {
  const [sp] = useSearchParams();
  const term = sp.get('q') || '';
  const [f, setF] = useState<any>({ pay: 'open' });
  const { data, error } = useLoad(async () => {
    const [L, rows] = await Promise.all([lookups(), q(sb.from('followup_rows').select('*'))]);
    return { L, rows: rows as any[] };
  });
  if (!data) return <Loading error={error} />;
  const t = term.trim();
  const rows = data.rows.filter((r) =>
    (!t || [r.contract_ref, r.contract_no_original, r.project_name, r.short_name, r.display_name].some((x) => String(x || '').includes(t))) &&
    (!f.company || String(r.company_id) === f.company) && (!f.agency || String(r.agency_id) === f.agency) &&
    (!f.station || r.station_code === f.station) && (!f.type || r.type === f.type) &&
    (f.pay === 'all' || (f.pay === 'open' ? ['unpaid', 'partially_paid', 'unknown'].includes(r.payment_status) : r.payment_status === f.pay)));
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="stack">
      <h1>المستخلصات{t ? ` · بحث: ${t}` : ''}</h1>
      <div className="filters">
        <select id="ex-company" value={f.company || ''} onChange={set('company')}><option value="">كل الشركات</option>{data.L.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select id="ex-agency" value={f.agency || ''} onChange={set('agency')}><option value="">كل الجهات</option>{data.L.agencies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select id="ex-station" value={f.station || ''} onChange={set('station')}><option value="">كل المحطات</option>{data.L.stations.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select>
        <select id="ex-type" value={f.type || ''} onChange={set('type')}><option value="">كل الأنواع</option>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select id="ex-pay" value={f.pay} onChange={set('pay')}><option value="open">لسه ماتصرفش</option><option value="all">الكل</option>{Object.entries(PAY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <Table excel="المستخلصات" rows={rows} link={(r) => '/extracts/' + r.extract_id} rowClass={(r) => (r.overdue ? 'overdue' : '')}
        cols={[
          { key: 'display_name', label: 'المستخلص', fmt: (v, r) => `${r.contract_ref || r.contract_no_original || '—'} · ${v}` },
          { key: 'short_name', label: 'المشروع' }, { key: 'company_name', label: 'الشركة' }, { key: 'agency_name', label: 'الجهة' },
          { key: 'value', label: 'القيمة', fmt: (v) => money(v, 0) }, { key: 'net_to_bank', label: 'للبنك', fmt: (v) => money(v, 0) },
          { key: 'execution_pct', label: 'التنفيذ', fmt: pct, xl: (v) => v }, { key: 'payment_status', label: 'الصرف', fmt: (v) => PAY[v] },
          { key: 'display_status', label: 'الحالة', fmt: (v) => STATUS[v] || v }, { key: 'station_name', label: 'المحطة' },
          { key: 'days_in_station', label: 'الأيام' }, { key: 'last_note', label: 'آخر ملاحظة' },
        ]} />
    </div>
  );
}
