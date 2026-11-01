import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { sb, q } from '../supabase';
import { lookups } from '../lookups';
import { date, money, PAY, pct, PSTATUS, TAX, TYPES, today } from '../lib';
import { Field, Loading, Modal, Pill, Stat, Table, useAction, useLoad } from '../ui';
import { useMe } from '../App';

// ملف المشروع (م-105): البيانات، المستخلصات، الموقف المالي، مذكرات الخفض، القوة العاملة، السجل
export default function Project() {
  const { id } = useParams();
  const me = useMe();
  const [tab, setTab] = useState('extracts');
  const { data, error, reload } = useLoad(async () => {
    const pid = Number(id);
    const [L, p, pf, ex, memos, held, labor, lpay] = await Promise.all([
      lookups(),
      q(sb.from('projects').select('*').eq('id', pid).single()),
      q(sb.from('project_figures').select('*').eq('id', pid).single()),
      q(sb.from('extract_figures').select('*').eq('project_id', pid).order('type').order('seq')),
      q(sb.from('reduction_memos').select('*').eq('project_id', pid).order('id')),
      q(sb.from('contract_withheld').select('*').eq('project_id', pid).maybeSingle()),
      q(sb.from('extract_labor').select('*').eq('project_id', pid)),
      q(sb.from('labor_payments').select('*').eq('project_id', pid).order('paid_on')),
    ]);
    let audit: any[] = [];
    if (me.role === 'manager') {
      const exIds = (ex as any[]).map((e) => e.id);
      const [a1, a2] = await Promise.all([
        q(sb.from('audit_log').select('*').eq('table_name', 'projects').eq('row_id', pid).order('at', { ascending: false }).limit(200)),
        exIds.length ? q(sb.from('audit_log').select('*').eq('table_name', 'extracts').in('row_id', exIds).order('at', { ascending: false }).limit(300)) : Promise.resolve([]),
      ]);
      audit = [...(a1 as any[]), ...(a2 as any[])].sort((a, b) => (a.at < b.at ? 1 : -1));
    }
    return { L, p, pf, ex: ex as any[], memos: memos as any[], held, labor: labor as any[], lpay: lpay as any[], audit };
  }, [id]);
  if (!data) return <Loading error={error} />;
  const p: any = data.p, pf: any = data.pf, held: any = data.held;
  const works = data.ex.filter((e) => e.type === 'works' && !e.cancelled_at);
  const sumNet = data.ex.filter((e) => !e.cancelled_at).reduce((s, e) => s + Number(e.net || 0), 0);
  const paid = data.ex.filter((e) => ['paid', 'paid_no_data'].includes(e.payment_status)).reduce((s, e) => s + Number(e.net || 0), 0);
  const lastCum = Math.max(0, ...works.map((e) => Number(e.cumulative || 0)));
  const tabs = [['extracts', 'المستخلصات'], ['money', 'الموقف المالي'], ['data', 'البيانات'], ['memos', 'مذكرات الخفض'], ['labor', 'القوة العاملة'], ...(me.role === 'manager' ? [['audit', 'السجل']] : [])];
  return (
    <div className="stack">
      <div>
        <div className="muted small">{data.L.company[p.company_id]?.name || 'غير محدد'} · {data.L.agency[p.agency_id]?.name} · {data.L.site[p.site_id]?.name || '—'}</div>
        <h1>{p.short_name || p.name}</h1>
        <div className="row wrap gap">
          <Pill tone="blue">{p.contract_ref || p.contract_no_original || 'من غير رقم عقد'}</Pill>
          {p.unified_code && <Pill>{p.unified_code}</Pill>}
          <Pill>{PSTATUS[p.status]}</Pill>
          {p.tax_regime ? <Pill>ضريبة {TAX[p.tax_regime]}</Pill> : <Pill tone="warn">نظام الضريبة ناقص</Pill>}
        </div>
      </div>
      <div className="stats">
        <Stat label="قيمة العقد المعتمدة" value={money(pf.approved_value, 0)} sub={pf.reductions > 0 ? `بعد خفض ${money(pf.reductions, 0)}` : undefined} />
        <Stat label="آخر تراكمي" value={money(lastCum, 0)} sub={pf.approved_value ? pct(lastCum / pf.approved_value) : undefined} />
        <Stat label="المتبقي من العقد" value={money(pf.approved_value ? pf.approved_value - lastCum : null, 0)} />
        <Stat label="المحتجز" value={money(held?.total_held ?? 0, 0)} />
      </div>
      <div className="tabs no-print">{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'extracts' && <ExtractsTab ex={data.ex} p={p} reload={reload} />}
      {tab === 'money' && (
        <div className="stack">
          <div className="stats">
            <Stat label="إجمالي الصافي" value={money(sumNet, 0)} />
            <Stat label="المصروف" value={money(paid, 0)} />
            <Stat label="لم يُصرف" value={money(sumNet - paid, 0)} />
          </div>
          <section className="card"><h2>المحتجز (م-504)</h2>
            {held ? <div className="stats">
              <Stat label="ضمان أعمال 5%" value={money(held.retention_held, 2)} />
              <Stat label="تأمين نهائي" value={money(held.final_insurance_held, 2)} />
              <Stat label="تعلية" value={money(held.taaliya_held, 2)} />
              <Stat label="رجع بمستخلصات رد" value={money(held.total_returned, 2)} />
            </div> : <p className="muted">مفيش مستخلصات</p>}
            {held?.unknown_extracts > 0 && <p className="muted small">{held.unknown_extracts} مستخلص نظامه يدوي، ومحتجزه مش محسوب.</p>}
          </section>
        </div>
      )}
      {tab === 'data' && <ProjectForm p={p} L={data.L} reload={reload} />}
      {tab === 'memos' && <Memos p={p} memos={data.memos} reload={reload} />}
      {tab === 'labor' && <Labor p={p} labor={data.labor} lpay={data.lpay} ex={data.ex} reload={reload} />}
      {tab === 'audit' && <Audit rows={data.audit} ex={data.ex} />}
    </div>
  );
}

function ExtractsTab({ ex, p, reload }: { ex: any[]; p: any; reload: () => void }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="stack">
      <div className="row between"><h2>المستخلصات</h2><button onClick={() => setAdding(true)}>مستخلص جديد</button></div>
      <Table rows={ex} link={(r) => '/extracts/' + r.id} excel={'مستخلصات ' + (p.contract_ref || p.id)} search={false}
        rowClass={(r) => (r.cancelled_at ? 'cancelled' : '')}
        cols={[
          { key: 'display_name', label: 'المستخلص' },
          { key: 'cumulative', label: 'التراكمي', fmt: (v) => money(v) },
          { key: 'net', label: 'الصافي', fmt: (v) => money(v) },
          { key: 'execution_pct', label: 'التنفيذ', fmt: pct, xl: (v) => v },
          { key: 'net_to_bank', label: 'للبنك', fmt: (v) => money(v, 0) },
          { key: 'payment_status', label: 'الصرف', fmt: (v) => PAY[v] },
          { key: 'extract_date', label: 'التاريخ', fmt: date },
          { key: 'numbers_approved', label: 'الأرقام', fmt: (v) => (v ? 'معتمد' : 'مسودة') },
        ]} />
      {adding && <NewExtract p={p} ex={ex} onClose={() => { setAdding(false); reload(); }} />}
    </div>
  );
}

function NewExtract({ p, ex, onClose }: { p: any; ex: any[]; onClose: () => void }) {
  const nav = useNavigate();
  const a = useAction();
  const works = ex.filter((e) => e.type === 'works' && !e.cancelled_at);
  const nextSeq = Math.max(0, ...works.map((e) => e.seq)) + 1;
  const [f, setF] = useState<any>({ type: 'works', seq: nextSeq, is_final: false });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    await a.run(async () => {
      const row: any = {
        project_id: p.id, type: f.type, seq: Number(f.seq), is_final: f.type === 'works' ? !!f.is_final : false,
        extract_date: f.extract_date || null, materials: Number(f.materials || 0),
        document_transfer: f.document_transfer ? Number(f.document_transfer) : null,
        insurance_cert: f.insurance_cert || null, labor_cert: f.labor_cert || null,
      };
      if (f.type === 'works') row.cumulative = f.value ? Number(f.value) : null; else row.amount = f.value ? Number(f.value) : null;
      if (f.type !== 'works') row.parent_id = works.find((w) => w.seq === Number(f.seq))?.id ?? null;
      const r = await q(sb.from('extracts').insert(row).select('id').single());
      if (f.station) await q(sb.rpc('move_extract', { p_id: (r as any).id, p_station: f.station, p_on: today(), p_note: '' }));
      nav('/extracts/' + (r as any).id);
    });
  }
  return (
    <Modal title="مستخلص جديد" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Field label="النوع"><select id="ne-type" value={f.type} onChange={set('type')}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="التسلسل" hint={f.type === 'works' ? 'جاري 1، 2، 3…' : 'رقم المستخلص الأصلي (جـ)'}><input id="ne-seq" type="number" min={1} required value={f.seq} onChange={set('seq')} /></Field>
        {f.type === 'works' && <label className="check"><input id="ne-final" type="checkbox" checked={f.is_final} onChange={set('is_final')} /> ختامي</label>}
        <Field label={f.type === 'works' ? 'الإجمالي التراكمي' : 'القيمة'}><input id="ne-value" inputMode="decimal" onChange={set('value')} /></Field>
        {f.type === 'works' && <Field label="خصم الخامات"><input id="ne-materials" inputMode="decimal" onChange={set('materials')} /></Field>}
        <Field label="تاريخ المستخلص"><input id="ne-date" type="date" onChange={set('extract_date')} /></Field>
        <Field label="التحويل المكتوب في المستند" hint="اختياري"><input id="ne-doc" inputMode="decimal" onChange={set('document_transfer')} /></Field>
        <Field label="شهادة التأمينات"><select id="ne-ins" onChange={set('insurance_cert')} defaultValue=""><option value="">—</option><option value="done">تم الاستخراج</option><option value="not_done">لم يتم</option><option value="na">لا حاجة</option></select></Field>
        <Field label="المحطة"><select id="ne-station" onChange={set('station')} defaultValue=""><option value="">—</option><option value="site">الموقع</option><option value="company_admin">إدارة الشركة</option><option value="agency_admin">إدارة الجهة المالك</option></select></Field>
        <div className="form-actions"><button disabled={a.busy}>حفظ</button></div>
        <a.Msg />
      </form>
    </Modal>
  );
}

function ProjectForm({ p, L, reload }: { p: any; L: any; reload: () => void }) {
  const a = useAction();
  const [f, setF] = useState<any>({ ...p, wage_ratio: p.wage_ratio ? Number(p.wage_ratio) * 100 : '' });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    await a.run(async () => {
      await q(sb.from('projects').update({
        name: f.name, short_name: f.short_name || '', contract_no_original: f.contract_no_original || null, unified_code: f.unified_code || null,
        agency_id: Number(f.agency_id), company_id: f.company_id ? Number(f.company_id) : null, site_id: f.site_id ? Number(f.site_id) : null,
        boq_no: f.boq_no || null, contract_date: f.contract_date || null, contract_value: f.contract_value === '' || f.contract_value === null ? null : Number(f.contract_value),
        insurance_file_no: f.insurance_file_no || null, wage_ratio: f.wage_ratio === '' || f.wage_ratio === null ? null : Number(f.wage_ratio) / 100,
        notes: f.notes || '', status: f.status, tax_regime: f.tax_regime || null,
        advance_participant: f.advance_participant === '' || f.advance_participant === null ? null : String(f.advance_participant) === 'true',
        contract_stamp: Number(f.contract_stamp || 27),
      }).eq('id', p.id));
      reload();
    }, 'اتحفظ');
  }
  const sel = (k: string, opts: any[], label = (x: any) => x.name, empty = '—') => (
    <select id={'pf-' + k} value={f[k] ?? ''} onChange={set(k)}><option value="">{empty}</option>{opts.map((x) => <option key={x.id} value={x.id}>{label(x)}</option>)}</select>
  );
  return (
    <form className="form card" onSubmit={save}>
      <Field label="اسم المشروع"><textarea id="pf-name" value={f.name} onChange={set('name')} rows={2} /></Field>
      <Field label="الاسم المختصر"><input id="pf-short" value={f.short_name ?? ''} onChange={set('short_name')} /></Field>
      <Field label="رقم العقد (زي المستند)" hint={'الرقم الموحّد: ' + (p.contract_ref || '—')}><input id="pf-contract" value={f.contract_no_original ?? ''} onChange={set('contract_no_original')} /></Field>
      <Field label="كود العقد الموحد"><input id="pf-unified" value={f.unified_code ?? ''} onChange={set('unified_code')} /></Field>
      <Field label="الجهة">{sel('agency_id', L.agencies)}</Field>
      <Field label="الشركة">{sel('company_id', L.companies, (x) => x.name, 'غير محدد')}</Field>
      <Field label="الموقع">{sel('site_id', L.sites)}</Field>
      <Field label="المقايسة"><input id="pf-boq" value={f.boq_no ?? ''} onChange={set('boq_no')} /></Field>
      <Field label="تاريخ العقد"><input id="pf-date" type="date" value={f.contract_date ?? ''} onChange={set('contract_date')} /></Field>
      <Field label="قيمة العقد (قبل مذكرات الخفض)"><input id="pf-value" inputMode="decimal" value={f.contract_value ?? ''} onChange={set('contract_value')} /></Field>
      <Field label="ملف التأمينات"><input id="pf-ins" value={f.insurance_file_no ?? ''} onChange={set('insurance_file_no')} /></Field>
      <Field label="نسبة الأجور %" hint="لو فاضية بتتحسب 20%"><input id="pf-wage" inputMode="decimal" value={f.wage_ratio ?? ''} onChange={set('wage_ratio')} /></Field>
      <Field label="نظام الضريبة"><select id="pf-tax" value={f.tax_regime ?? ''} onChange={set('tax_regime')}><option value="">—</option><option value="14">14%</option><option value="5.04">5.04% (الوعاء)</option><option value="0">معفي</option></select></Field>
      <Field label="مشترك بالدفعات المقدمة؟"><select id="pf-adv" value={f.advance_participant === null || f.advance_participant === undefined ? '' : String(f.advance_participant)} onChange={set('advance_participant')}><option value="">—</option><option value="true">نعم</option><option value="false">لا</option></select></Field>
      <Field label="دمغة العقد"><input id="pf-stamp" inputMode="decimal" value={f.contract_stamp ?? 27} onChange={set('contract_stamp')} /></Field>
      <Field label="الحالة"><select id="pf-status" value={f.status} onChange={set('status')}>{Object.entries(PSTATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label="ملاحظات"><textarea id="pf-notes" value={f.notes ?? ''} onChange={set('notes')} rows={2} /></Field>
      <div className="form-actions"><button disabled={a.busy}>حفظ</button></div>
      <a.Msg />
    </form>
  );
}

function Memos({ p, memos, reload }: { p: any; memos: any[]; reload: () => void }) {
  const a = useAction();
  const [f, setF] = useState<any>({});
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (await a.run(() => q(sb.from('reduction_memos').insert({ project_id: p.id, memo_no: f.memo_no || '', memo_date: f.memo_date || null, amount: Number(f.amount), note: f.note || '' })), 'اتضافت')) {
      setF({}); reload();
    }
  }
  return (
    <div className="stack">
      <Table rows={memos} search={false} cols={[{ key: 'memo_no', label: 'رقم المذكرة' }, { key: 'memo_date', label: 'التاريخ', fmt: date }, { key: 'amount', label: 'القيمة', fmt: (v) => money(v) }, { key: 'note', label: 'ملاحظة' }]} />
      <form className="form inline card" onSubmit={add}>
        <Field label="رقم المذكرة"><input id="memo-no" value={f.memo_no ?? ''} onChange={(e) => setF({ ...f, memo_no: e.target.value })} /></Field>
        <Field label="التاريخ"><input id="memo-date" type="date" value={f.memo_date ?? ''} onChange={(e) => setF({ ...f, memo_date: e.target.value })} /></Field>
        <Field label="القيمة"><input id="memo-amount" required inputMode="decimal" value={f.amount ?? ''} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <div className="form-actions"><button disabled={a.busy}>إضافة مذكرة خفض</button></div>
        <a.Msg />
      </form>
    </div>
  );
}

function Labor({ p, labor, lpay, ex, reload }: { p: any; labor: any[]; lpay: any[]; ex: any[]; reload: () => void }) {
  const a = useAction();
  const [f, setF] = useState<any>({ paid_on: today() });
  const name = (id: number) => ex.find((e) => e.id === id)?.display_name || '—';
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (await a.run(() => q(sb.rpc('add_labor_payment', { p_project: p.id, p_paid_on: f.paid_on, p_amount: Number(f.amount), p_receipt_no: f.receipt_no || '', p_extract: f.extract_id ? Number(f.extract_id) : null, p_note: '' })), 'اتسجل')) {
      setF({ paid_on: today() }); reload();
    }
  }
  return (
    <div className="stack">
      {labor.some((l) => l.default_wage_ratio) && <div className="msg warn">نسبة أجور افتراضية 20% (م-604). اكتب نسبة المشروع من تبويب البيانات.</div>}
      <Table rows={labor.map((l) => ({ ...l, name: name(l.extract_id) }))} search={false}
        cols={[
          { key: 'name', label: 'المستخلص' }, { key: 'base', label: 'الأساس', fmt: (v) => money(v, 0) },
          { key: 'expected', label: 'المتوقع (ح-08)', fmt: (v) => money(v) }, { key: 'actual', label: 'تقدير المكتب', fmt: (v) => money(v) },
          { key: 'approved', label: 'المعتمد', fmt: (v) => money(v) }, { key: 'paid_before', label: 'اتسدد قبله', fmt: (v) => money(v) },
          { key: 'note', label: 'ملاحظة' },
        ]} />
      <h3>المسدد</h3>
      <Table rows={lpay} search={false} cols={[{ key: 'paid_on', label: 'التاريخ', fmt: date }, { key: 'amount', label: 'المبلغ', fmt: (v) => money(v) }, { key: 'receipt_no', label: 'رقم الإيصال' }, { key: 'extract_id', label: 'على مستخلص', fmt: (v) => (v ? name(v) : '—') }]} />
      <form className="form inline card" onSubmit={add}>
        <Field label="التاريخ"><input id="lp-date" type="date" required value={f.paid_on} onChange={(e) => setF({ ...f, paid_on: e.target.value })} /></Field>
        <Field label="المبلغ"><input id="lp-amount" required inputMode="decimal" value={f.amount ?? ''} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="رقم الإيصال"><input id="lp-receipt" value={f.receipt_no ?? ''} onChange={(e) => setF({ ...f, receipt_no: e.target.value })} /></Field>
        <Field label="على مستخلص"><select id="lp-extract" value={f.extract_id ?? ''} onChange={(e) => setF({ ...f, extract_id: e.target.value })}><option value="">—</option>{ex.filter((e) => e.type === 'works').map((e) => <option key={e.id} value={e.id}>{e.display_name}</option>)}</select></Field>
        <div className="form-actions"><button disabled={a.busy}>تسجيل سداد قوة عاملة</button></div>
        <a.Msg />
      </form>
    </div>
  );
}

const FIELD_AR: Record<string, string> = {
  cumulative: 'التراكمي', amount: 'القيمة', materials: 'الخامات', taaliya_rate: 'التعلية', numbers_approved: 'الاعتماد', net: 'الصافي',
  document_transfer: 'التحويل في المستند', bank_estimate: 'تقدير يدوي', extract_date: 'التاريخ', cancelled_at: 'الإلغاء', stage_status: 'الحالة',
  insurance_cert: 'شهادة التأمينات', labor_cert: 'شهادة القوة العاملة', contract_value: 'قيمة العقد', tax_regime: 'نظام الضريبة', name: 'الاسم',
};
export function Audit({ rows, ex }: { rows: any[]; ex?: any[] }) {
  const nm = (r: any) => (r.table_name === 'extracts' ? ex?.find((e) => e.id === r.row_id)?.display_name || 'مستخلص' : r.table_name === 'projects' ? 'المشروع' : r.table_name);
  const fmt = (c: any) => Object.entries(c || {}).filter(([k]) => !['id', 'created_by', 'approved_by'].includes(k))
    .map(([k, v]: any) => `${FIELD_AR[k] || k}: ${v.before ?? '—'} ← ${v.after ?? '—'}`).join(' · ');
  return <Table rows={rows.map((r) => ({ ...r, what: nm(r), change: r.action === 'insert' ? 'إضافة' : fmt(r.changes) }))} excel="السجل"
    cols={[{ key: 'at', label: 'الوقت', fmt: (v) => new Date(v).toLocaleString('en-GB', { timeZone: 'Africa/Cairo' }) }, { key: 'what', label: 'على' }, { key: 'action', label: 'العملية' }, { key: 'change', label: 'قبل ← بعد' }, { key: 'reason', label: 'السبب' }]} />;
}
