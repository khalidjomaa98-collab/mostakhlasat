import { useState } from 'react';
import { sb, q } from '../supabase';
import { lookups } from '../lookups';
import { date, money, PAY, today } from '../lib';
import { Loading, Table, useLoad } from '../ui';

// التقارير (م-706): الموقف المالي، المحتجز، التأخير والاستيفاء، الدفعات في فترة، القوة العاملة
export default function Reports() {
  const [tab, setTab] = useState('position');
  const [by, setBy] = useState<'project' | 'company' | 'agency'>('project');
  const [from, setFrom] = useState(today().slice(0, 8) + '01');
  const [to, setTo] = useState(today());
  const { data, error } = useLoad(async () => {
    const [L, pf, ef, held, labor, pays, fr] = await Promise.all([
      lookups(), q(sb.from('project_figures').select('*')), q(sb.from('extract_finance').select('id, project_id, type, gross, net_to_bank, paid_total, payment_status')),
      q(sb.from('contract_withheld').select('*')), q(sb.from('extract_labor').select('*')),
      q(sb.from('payments').select('*').is('cancelled_at', null)), q(sb.from('followup_rows').select('*')),
    ]);
    return { L, pf: pf as any[], ef: ef as any[], held: held as any[], labor: labor as any[], pays: pays as any[], fr: fr as any[] };
  });
  if (!data) return <Loading error={error} />;
  const { L } = data;
  const pj = Object.fromEntries(data.pf.map((p) => [p.id, p]));
  const name = (p: any) => (p ? `${p.contract_ref || p.contract_no_original || '—'} · ${p.short_name || p.name}` : '—');

  // الموقف المالي
  const pos = data.pf.map((p) => {
    const ex = data.ef.filter((e) => e.project_id === p.id && e.payment_status !== 'cancelled');
    const net = ex.reduce((s, e) => s + Number(e.gross || 0), 0);
    const paid = ex.filter((e) => ['paid', 'paid_no_data'].includes(e.payment_status)).reduce((s, e) => s + Number(e.gross || 0), 0);
    const h = data.held.find((x) => x.project_id === p.id);
    return { id: p.id, project: name(p), company: L.company[p.company_id]?.name || 'غير محدد', agency: L.agency[p.agency_id]?.name,
      approved: Number(p.approved_value || 0), executed: Number(p.last_cumulative || 0), net, paid, unpaid: net - paid, held: Number(h?.total_held || 0),
      remaining: Number(p.approved_value || 0) - Number(p.last_cumulative || 0) };
  });
  const group = (k: 'company' | 'agency') => Object.values(pos.reduce((m: any, r: any) => {
    const g = m[r[k]] || (m[r[k]] = { id: r[k], project: r[k], approved: 0, executed: 0, net: 0, paid: 0, unpaid: 0, held: 0, remaining: 0 });
    ['approved', 'executed', 'net', 'paid', 'unpaid', 'held', 'remaining'].forEach((f) => (g[f] += r[f]));
    return m;
  }, {}));
  const posRows = by === 'project' ? pos : group(by);
  const posCols = [
    { key: 'project', label: by === 'project' ? 'المشروع' : by === 'company' ? 'الشركة' : 'الجهة' },
    ...(by === 'project' ? [{ key: 'company', label: 'الشركة' }] : []),
    { key: 'approved', label: 'قيمة العقود', fmt: (v: any) => money(v, 0) }, { key: 'executed', label: 'المنفذ (تراكمي)', fmt: (v: any) => money(v, 0) },
    { key: 'net', label: 'المستخلص', fmt: (v: any) => money(v, 0) }, { key: 'paid', label: 'المصروف', fmt: (v: any) => money(v, 0) },
    { key: 'unpaid', label: 'لم يُصرف', fmt: (v: any) => money(v, 0) }, { key: 'held', label: 'المحتجز', fmt: (v: any) => money(v, 0) },
    { key: 'remaining', label: 'المتبقي من العقود', fmt: (v: any) => money(v, 0) },
  ];
  const payRows = data.pays.filter((p) => p.paid_on >= from && p.paid_on <= to).map((p) => {
    const e = data.fr.find((x) => x.extract_id === p.extract_id);
    return { ...p, project: e ? `${e.contract_ref || '—'} · ${e.short_name}` : '—', extract: e?.display_name, company: e?.company_name };
  });
  const tabs = [['position', 'الموقف المالي'], ['held', 'المحتجز'], ['delay', 'التأخير والاستيفاء'], ['payments', 'الدفعات في فترة'], ['labor', 'القوة العاملة']];
  return (
    <div className="stack">
      <h1>التقارير</h1>
      <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'position' && <>
        <div className="filters"><select id="rep-by" value={by} onChange={(e) => setBy(e.target.value as any)}><option value="project">حسب المشروع</option><option value="company">حسب الشركة</option><option value="agency">حسب الجهة</option></select></div>
        <Table excel="الموقف المالي" rows={posRows} link={by === 'project' ? (r) => '/projects/' + r.id : undefined} cols={posCols} />
      </>}
      {tab === 'held' && <Table excel="المحتجز" rows={data.held.filter((h) => Number(h.total_held) || Number(h.total_returned)).map((h) => ({ ...h, id: h.project_id, project: name(pj[h.project_id]) }))} link={(r) => '/projects/' + r.id}
        cols={[{ key: 'project', label: 'المشروع' }, { key: 'retention_held', label: 'ضمان 5%', fmt: (v) => money(v, 0) }, { key: 'final_insurance_held', label: 'تأمين نهائي', fmt: (v) => money(v, 0) },
          { key: 'taaliya_held', label: 'تعلية', fmt: (v) => money(v, 0) }, { key: 'total_held', label: 'الإجمالي', fmt: (v) => money(v, 0) }, { key: 'total_returned', label: 'اترد', fmt: (v) => money(v, 0) }]} />}
      {tab === 'delay' && <Table excel="التأخير والاستيفاء" rows={data.fr.filter((r) => (r.overdue || r.istifaa_kind) && ['unpaid', 'partially_paid'].includes(r.payment_status))} link={(r) => '/extracts/' + r.extract_id}
        cols={[{ key: 'display_name', label: 'المستخلص', fmt: (v, r) => `${r.contract_ref || '—'} · ${v}` }, { key: 'short_name', label: 'المشروع' }, { key: 'company_name', label: 'الشركة' },
          { key: 'station_name', label: 'المحطة' }, { key: 'days_in_station', label: 'الأيام' }, { key: 'istifaa_kind', label: 'استيفاء', fmt: (v, r) => (v ? `${v === 'lattat' ? 'لطات' : 'نواقص'} · ${r.istifaa_days} يوم` : '—') },
          { key: 'value', label: 'القيمة', fmt: (v) => money(v, 0) }]} />}
      {tab === 'payments' && <>
        <div className="filters"><label>من <input id="rep-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label>لحد <input id="rep-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <b className="num">الإجمالي {money(payRows.reduce((s, p) => s + Number(p.amount), 0))}</b></div>
        <p className="muted small">المستخلصات اللي اتصرفت قبل المنظومة من غير بيانات مش داخلة هنا (م-505).</p>
        <Table excel="الدفعات" rows={payRows} link={(r) => '/extracts/' + r.extract_id}
          cols={[{ key: 'project', label: 'المشروع' }, { key: 'extract', label: 'المستخلص' }, { key: 'company', label: 'الشركة' }, { key: 'paid_on', label: 'التاريخ', fmt: date },
            { key: 'amount', label: 'المبلغ', fmt: (v) => money(v) }, { key: 'transfer_no', label: 'رقم التحويل' }, { key: 'bank', label: 'البنك' }]} />
      </>}
      {tab === 'labor' && <Table excel="القوة العاملة" rows={data.labor.map((l) => ({ ...l, id: l.extract_id, project: name(pj[l.project_id]), ex: data.fr.find((x) => x.extract_id === l.extract_id) }))} link={(r) => '/extracts/' + r.id}
        cols={[{ key: 'project', label: 'المشروع' }, { key: 'ex', label: 'المستخلص', fmt: (v) => v?.display_name || '—', xl: (v) => v?.display_name }, { key: 'expected', label: 'المتوقع', fmt: (v) => money(v) },
          { key: 'actual', label: 'تقدير المكتب', fmt: (v) => money(v) }, { key: 'approved', label: 'المعتمد', fmt: (v) => money(v) }, { key: 'paid_before', label: 'اتسدد', fmt: (v) => money(v) },
          { key: 'labor_cert', label: 'الشهادة', fmt: (v) => ({ done: 'تم', not_done: 'لم يتم', na: 'لا حاجة' } as any)[v] || '—' }, { key: 'note', label: 'ملاحظة' }]} />}
      <p className="muted small">«الصرف»: {Object.values(PAY).join(' · ')}</p>
    </div>
  );
}
