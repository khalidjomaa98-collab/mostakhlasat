import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sb, q } from '../supabase';
import { lookups } from '../lookups';
import { money, pct, PSTATUS } from '../lib';
import { Field, Loading, Modal, Table, useAction, useLoad } from '../ui';

export default function Projects() {
  const [adding, setAdding] = useState(false);
  const [company, setCompany] = useState('');
  const { data, error } = useLoad(async () => {
    const [L, rows] = await Promise.all([lookups(), q(sb.from('project_figures').select('*'))]);
    return {
      L, rows: (rows as any[]).map((r) => ({
        ...r, company: L.company[r.company_id]?.name || 'غير محدد', agency: L.agency[r.agency_id]?.name, site: L.site[r.site_id]?.name,
        pct: r.approved_value ? Number(r.last_cumulative || 0) / Number(r.approved_value) : null,
      })),
    };
  });
  if (!data) return <Loading error={error} />;
  const rows = data.rows.filter((r) => !company || String(r.company_id) === company);
  return (
    <div className="stack">
      <div className="row between"><h1>المشروعات</h1><button onClick={() => setAdding(true)}>مشروع جديد</button></div>
      <div className="filters">
        <select id="projects-company" value={company} onChange={(e) => setCompany(e.target.value)}>
          <option value="">كل الشركات</option>
          {data.L.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <Table excel="المشروعات" rows={rows} link={(r) => '/projects/' + r.id}
        cols={[
          { key: 'contract_ref', label: 'العقد', fmt: (v, r) => v || r.contract_no_original || '—' },
          { key: 'short_name', label: 'المشروع' }, { key: 'site', label: 'الموقع' }, { key: 'agency', label: 'الجهة' },
          { key: 'company', label: 'الشركة' },
          { key: 'approved_value', label: 'قيمة العقد المعتمدة', fmt: (v) => money(v, 0) },
          { key: 'extracts_count', label: 'المستخلصات' },
          { key: 'pct', label: 'آخر نسبة', fmt: pct, xl: (v) => v },
          { key: 'status', label: 'الحالة', fmt: (v) => PSTATUS[v] },
        ]} />
      {adding && <NewProject L={data.L} onClose={() => setAdding(false)} />}
    </div>
  );
}

function NewProject({ L, onClose }: { L: any; onClose: () => void }) {
  const nav = useNavigate();
  const a = useAction();
  const [f, setF] = useState<any>({ status: 'active', contract_stamp: 27 });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value === '' ? null : e.target.value });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    await a.run(async () => {
      const row = await q(sb.from('projects').insert({
        ...f, agency_id: Number(f.agency_id), company_id: f.company_id ? Number(f.company_id) : null, site_id: f.site_id ? Number(f.site_id) : null,
        contract_value: f.contract_value ? Number(f.contract_value) : null, wage_ratio: f.wage_ratio ? Number(f.wage_ratio) / 100 : null,
        advance_participant: f.advance_participant === null || f.advance_participant === undefined ? null : f.advance_participant === 'true',
      }).select('id').single());
      nav('/projects/' + (row as any).id);
    });
  }
  return (
    <Modal title="مشروع جديد" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Field label="اسم المشروع"><input id="np-name" required onChange={set('name')} /></Field>
        <Field label="الاسم المختصر"><input id="np-short" onChange={set('short_name')} /></Field>
        <Field label="رقم العقد" hint="سيبه فاضي لو المشروع تحت التعاقد"><input id="np-contract" onChange={set('contract_no_original')} /></Field>
        <Field label="كود العقد الموحد"><input id="np-unified" onChange={set('unified_code')} /></Field>
        <Field label="الجهة"><select id="np-agency" required onChange={set('agency_id')} defaultValue=""><option value="" disabled>اختار</option>{L.agencies.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
        <Field label="الشركة"><select id="np-company" onChange={set('company_id')} defaultValue=""><option value="">غير محدد</option>{L.companies.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
        <Field label="الموقع"><select id="np-site" onChange={set('site_id')} defaultValue=""><option value="">—</option>{L.sites.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
        <Field label="المقايسة"><input id="np-boq" onChange={set('boq_no')} /></Field>
        <Field label="تاريخ العقد"><input id="np-date" type="date" onChange={set('contract_date')} /></Field>
        <Field label="قيمة العقد"><input id="np-value" inputMode="decimal" onChange={set('contract_value')} /></Field>
        <Field label="نسبة الأجور %" hint="لو فاضية بتتحسب 20%"><input id="np-wage" inputMode="decimal" onChange={set('wage_ratio')} /></Field>
        <Field label="نظام الضريبة"><select id="np-tax" onChange={set('tax_regime')} defaultValue=""><option value="">—</option><option value="14">14%</option><option value="5.04">5.04% (الوعاء)</option><option value="0">معفي</option></select></Field>
        <Field label="مشترك بالدفعات المقدمة؟"><select id="np-adv" onChange={set('advance_participant')} defaultValue=""><option value="">—</option><option value="true">نعم</option><option value="false">لا</option></select></Field>
        <Field label="الحالة"><select id="np-status" onChange={set('status')} defaultValue="active"><option value="under_contract">تحت التعاقد</option><option value="active">جاري</option><option value="finished">منتهي</option></select></Field>
        <div className="form-actions"><button disabled={a.busy}>حفظ</button></div>
        <a.Msg />
      </form>
    </Modal>
  );
}
