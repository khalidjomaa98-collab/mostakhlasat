import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { sb, q } from '../supabase';
import { lookups } from '../lookups';
import { CERT, date, money, PAY, pct, SOURCE, STATUS, today, TYPES } from '../lib';
import { Field, Loading, Modal, Pill, Stat, Table, useAction, useLoad } from '../ui';
import { useMe } from '../App';
import { Audit } from './Project';

// ملف المستخلص: الأرقام، الاستقطاعات، الدفعات، المحطات، الاستيفاء، الملاحظات
export default function Extract() {
  const { id } = useParams();
  const eid = Number(id);
  const me = useMe();
  const manager = me.role === 'manager';
  const [modal, setModal] = useState<string | null>(null);
  const { data, error, reload } = useLoad(async () => {
    const [L, e, fig, fin, mv, ist, notes, pays] = await Promise.all([
      lookups(),
      q(sb.from('extracts').select('*').eq('id', eid).single()),
      q(sb.from('extract_figures').select('*').eq('id', eid).single()),
      q(sb.from('extract_finance').select('*').eq('id', eid).single()),
      q(sb.from('extract_movements').select('*').eq('extract_id', eid).order('id')),
      q(sb.from('extract_istifaa').select('*').eq('extract_id', eid).order('id')),
      q(sb.from('extract_notes').select('*').eq('extract_id', eid).order('created_at', { ascending: false })),
      q(sb.from('payments').select('*').eq('extract_id', eid).order('paid_on')),
    ]);
    const p = await q(sb.from('projects').select('*').eq('id', (e as any).project_id).single());
    const people = Object.fromEntries(((await q(sb.from('profiles').select('id, full_name'))) as any[]).map((x) => [x.id, x.full_name]));
    const audit = manager ? await q(sb.from('audit_log').select('*').eq('table_name', 'extracts').eq('row_id', eid).order('at', { ascending: false })) : [];
    return { L, e: e as any, fig: fig as any, fin: fin as any, mv: mv as any[], ist: ist as any[], notes: notes as any[], pays: pays as any[], p: p as any, audit: audit as any[], people };
  }, [id]);
  const act = useAction();
  if (!data) return <Loading error={error} />;
  const { e, fig, fin, p, L } = data;
  const engine = fin.engine;
  const openIst = data.ist.find((i) => !i.closed_on);
  const locked = e.numbers_approved && !manager;
  return (
    <div className="stack">
      <div>
        <div className="muted small"><Link to={'/projects/' + p.id}>{p.contract_ref || p.contract_no_original || 'من غير رقم'} · {p.short_name || p.name}</Link> · {L.company[p.company_id]?.name || 'غير محدد'} · {L.agency[p.agency_id]?.name}</div>
        <h1>{fig.display_name} <span className="muted small">#{e.id}</span></h1>
        <div className="row wrap gap">
          <Pill tone={e.numbers_approved ? 'ok' : 'gray'}>{e.numbers_approved ? 'الأرقام معتمدة' : 'مسودة'}</Pill>
          <Pill tone="blue">{STATUS[fig.display_status] || fig.display_status}</Pill>
          <Pill tone={['paid', 'paid_no_data'].includes(fin.payment_status) ? 'ok' : fin.payment_status === 'partially_paid' ? 'warn' : 'gray'}>{PAY[fin.payment_status]}</Pill>
          {fig.station_code && <Pill>{L.station[fig.station_code]?.name}{fig.days_in_station != null ? ` · ${fig.days_in_station} يوم` : ''}</Pill>}
          {e.cancelled_at && <Pill tone="bad">ملغي: {e.cancel_reason}</Pill>}
          {e.legacy_row && <Pill>من الشيت: صف {e.legacy_row}</Pill>}
        </div>
      </div>

      <div className="stats">
        {e.type === 'works' && <Stat label="التراكمي" value={money(e.cumulative)} sub={fig.execution_pct != null ? 'التنفيذ ' + pct(fig.execution_pct) : undefined} />}
        <Stat label="الصافي" value={money(fig.net)} />
        <Stat label="الصافي للبنك" value={money(fin.net_to_bank, 0)} sub={fin.net_source ? SOURCE[fin.net_source] : 'مش محسوب'} tone={fin.is_manual_estimate ? 'warn' : ''} />
        <Stat label="الواصل" value={money(fin.paid_total)} sub={fin.remaining != null ? 'الباقي ' + money(fin.remaining) : undefined} />
      </div>

      {!e.cancelled_at && (
        <div className="row wrap gap no-print">
          <button onClick={() => setModal('move')}>نقل</button>
          {!openIst ? <button className="ghost" onClick={() => setModal('istifaa')}>استيفاء</button>
            : <button className="ghost" onClick={() => act.run(() => q(sb.rpc('close_istifaa', { p_id: eid }))).then(reload)}>تم الاستيفاء</button>}
          {!['paid_no_data', 'paid'].includes(fin.payment_status) && <button className="ghost" onClick={() => setModal('pay')}>تسجيل دفعة</button>}
          {!locked && <button className="ghost" onClick={() => setModal('edit')}>تعديل</button>}
          {manager && !e.numbers_approved && <button className="ghost" onClick={() => act.run(() => q(sb.rpc('approve_extract', { p_id: eid })), 'اتعتمد').then(reload)}>اعتماد الأرقام</button>}
          {manager && <button className="ghost danger" onClick={() => setModal('cancel')}>إلغاء المستخلص</button>}
        </div>
      )}
      <act.Msg />
      {openIst && <div className="msg warn">في استيفاء ({openIst.kind === 'lattat' ? 'لطات' : 'نواقص'}): {openIst.required} — من {date(openIst.opened_on)}</div>}
      {fin.alert_taaliya_without_cert && <div className="msg warn">شهادة التأمينات «لم يتم» والتعلية صفر (م-406).</div>}

      {e.type === 'works' && (
        <section className="card">
          <h2>الاستقطاعات</h2>
          {!engine && <p className="muted">نظام الجهة يدوي: اكتب الصافي للبنك من «تعديل» (م-404).</p>}
          {engine?.missing && <p className="muted">المحرك مستني: {engine.missing.join('، ')}. لحد ما تتملا، الصافي للبنك بيتاخد من التقدير اليدوي أو المستند.</p>}
          {engine?.skipped && <p className="muted">{engine.skipped}</p>}
          {engine?.error && <div className="msg err">{engine.error}</div>}
          {engine?.items && <Deductions engine={engine} fin={fin} />}
        </section>
      )}

      <section className="card">
        <h2>الدفعات</h2>
        {fin.payment_status === 'paid_no_data' ? <p className="muted">اتصرف قبل المنظومة، وبيانات الصرف مش متسجلة (م-505).</p> :
          <Table rows={data.pays} search={false} rowClass={(r) => (r.cancelled_at ? 'cancelled' : '')}
            cols={[
              { key: 'paid_on', label: 'التاريخ', fmt: date }, { key: 'amount', label: 'المبلغ', fmt: (v) => money(v) },
              { key: 'transfer_no', label: 'رقم التحويل' }, { key: 'bank', label: 'البنك' }, { key: 'note', label: 'ملاحظة', fmt: (v, r) => [v, r.over_reason && 'زيادة: ' + r.over_reason, r.cancelled_at && 'ملغية: ' + r.cancel_reason].filter(Boolean).join(' · ') || '—' },
              ...(manager ? [{ key: 'id', label: '', fmt: (v: any, r: any) => !r.cancelled_at && <button className="link danger" onClick={() => { const why = window.prompt('سبب إلغاء الدفعة'); if (why) act.run(() => q(sb.rpc('cancel_payment', { p_id: v, p_reason: why }))).then(reload); }}>إلغاء</button> }] : []),
            ]} />}
      </section>

      <div className="grid2">
        <section className="card">
          <h2>الحركة</h2>
          <Table rows={data.mv.map((m) => ({ ...m, station: L.station[m.station_code]?.name, days: m.entered_on ? Math.round(((m.left_on ? new Date(m.left_on) : new Date()).getTime() - new Date(m.entered_on).getTime()) / 86400000) : null }))} search={false}
            cols={[{ key: 'station', label: 'المحطة' }, { key: 'entered_on', label: 'دخول', fmt: date }, { key: 'left_on', label: 'خروج', fmt: date }, { key: 'days', label: 'المدة' }, { key: 'note', label: 'ملاحظة' }]} />
        </section>
        <section className="card">
          <h2>الملاحظات</h2>
          <NoteForm eid={eid} reload={reload} />
          <ul className="notes">{data.notes.map((n) => <li key={n.id}><p>{n.body}</p><small className="muted">{n.created_by ? data.people[n.created_by] || 'مستخدم' : 'منقول من الشيت'} · {date(n.created_at)}</small></li>)}</ul>
        </section>
      </div>

      <section className="card">
        <h2>بيانات المستخلص</h2>
        <dl className="kv">
          <dt>النوع</dt><dd>{TYPES[e.type]}</dd>
          <dt>التاريخ</dt><dd>{date(e.extract_date)}</dd>
          <dt>خصم الخامات</dt><dd className="num">{money(e.materials)}</dd>
          <dt>التعلية</dt><dd>{e.taaliya_rate > 0 ? '10%' : 'صفر'}</dd>
          <dt>التحويل في المستند</dt><dd className="num">{money(e.document_transfer)}</dd>
          <dt>تقدير يدوي</dt><dd className="num">{money(e.bank_estimate)}</dd>
          <dt>شهادة التأمينات</dt><dd>{CERT[e.insurance_cert] || '—'}</dd>
          <dt>شهادة القوة العاملة</dt><dd>{CERT[e.labor_cert] || '—'}</dd>
          <dt>في كشف المتابعة</dt><dd>{fig.in_followup ? 'نعم' : 'لا'}{e.followup_override !== null ? ' (اختيار يدوي)' : ''}</dd>
        </dl>
      </section>
      {manager && <section className="card"><h2>السجل</h2><Audit rows={data.audit} ex={[{ id: eid, display_name: fig.display_name }]} /></section>}

      {modal === 'move' && <MoveModal eid={eid} L={L} current={fig.station_code} onClose={() => { setModal(null); reload(); }} />}
      {modal === 'istifaa' && <IstifaaModal eid={eid} onClose={() => { setModal(null); reload(); }} />}
      {modal === 'pay' && <PayModal eid={eid} fin={fin} onClose={() => { setModal(null); reload(); }} />}
      {modal === 'edit' && <EditModal e={e} manager={manager} onClose={() => { setModal(null); reload(); }} />}
      {modal === 'cancel' && <CancelModal eid={eid} onClose={() => { setModal(null); reload(); }} />}
    </div>
  );
}

function Deductions({ engine, fin }: { engine: any; fin: any }) {
  const groups: Record<string, string> = { stamps: 'الدمغات والرسوم', retentions: 'الضمانات والاحتجازات', taxes: 'الضرائب', contractual: 'استقطاعات تعاقدية', unprinted: 'غير مطبوع في المستند' };
  let last = '';
  return (
    <div className="stack">
      <div className="tbl"><table>
        <thead><tr><th>البند</th><th>المحسوب</th><th>الفعلي</th></tr></thead>
        <tbody>
          {engine.items.map((it: any) => {
            const head = it.group !== last ? (last = it.group, <tr key={'g' + it.code} className="grp"><td colSpan={3}>{groups[it.group]}</td></tr>) : null;
            return [head, <tr key={it.code}><td>{it.label}</td><td className="num">{money(it.calculated)}</td><td className="num">{it.actual != null ? money(it.actual) : '—'}</td></tr>];
          })}
          <tr className="tot"><td>إجمالي الاستقطاعات</td><td className="num" colSpan={2}>{money(engine.total_deductions)}</td></tr>
          <tr className="tot"><td>الصافي للبنك (المحرك)</td><td className="num" colSpan={2}>{money(engine.net_to_bank, 0)}</td></tr>
        </tbody>
      </table></div>
      {fin.document_transfer != null && (
        <div className={'msg ' + (fin.document_match === 'matched' ? 'ok' : 'warn')}>
          المستند {money(fin.document_transfer, 0)} · الفرق {money(fin.engine_vs_document, 0)} جنيه — {fin.document_match === 'matched' ? 'مطابق' : 'راجع المدخلات'} (م-403)
        </div>
      )}
      <p className="muted small">نسخة النسب: من {engine.effective_from}</p>
    </div>
  );
}

function NoteForm({ eid, reload }: { eid: number; reload: () => void }) {
  const a = useAction();
  const [t, setT] = useState('');
  return (
    <form className="row gap" onSubmit={async (e) => { e.preventDefault(); if (t.trim() && await a.run(() => q(sb.rpc('add_extract_note', { p_id: eid, p_body: t.trim() })))) { setT(''); reload(); } }}>
      <input id="note-body" className="grow" placeholder="ملاحظة جديدة" value={t} onChange={(e) => setT(e.target.value)} />
      <button disabled={a.busy}>إضافة</button><a.Msg />
    </form>
  );
}

function MoveModal({ eid, L, current, onClose }: { eid: number; L: any; current: string; onClose: () => void }) {
  const a = useAction();
  const [f, setF] = useState<any>({ on: today(), station: '' });
  return (
    <Modal title="نقل المستخلص" onClose={onClose}>
      <form className="form" onSubmit={async (e) => { e.preventDefault(); if (await a.run(() => q(sb.rpc('move_extract', { p_id: eid, p_station: f.station, p_on: f.on, p_note: f.note || '' })))) onClose(); }}>
        <Field label="المحطة الجديدة"><select id="mv-station" required value={f.station} onChange={(e) => setF({ ...f, station: e.target.value })}><option value="" disabled>اختار</option>{L.stations.filter((s: any) => s.code !== current).map((s: any) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></Field>
        <Field label="التاريخ"><input id="mv-date" type="date" required value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></Field>
        <Field label="ملاحظة"><input id="mv-note" value={f.note || ''} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <div className="form-actions"><button disabled={a.busy}>نقل</button></div><a.Msg />
      </form>
    </Modal>
  );
}

function IstifaaModal({ eid, onClose }: { eid: number; onClose: () => void }) {
  const a = useAction();
  const [f, setF] = useState<any>({ kind: 'nawaqes' });
  return (
    <Modal title="استيفاء" onClose={onClose}>
      <form className="form" onSubmit={async (e) => { e.preventDefault(); if (await a.run(() => q(sb.rpc('open_istifaa', { p_id: eid, p_kind: f.kind, p_required: f.required })))) onClose(); }}>
        <Field label="النوع"><select id="is-kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="nawaqes">نواقص</option><option value="lattat">لطات</option></select></Field>
        <Field label="المطلوب"><input id="is-required" required value={f.required || ''} onChange={(e) => setF({ ...f, required: e.target.value })} /></Field>
        <div className="form-actions"><button disabled={a.busy}>فتح استيفاء</button></div><a.Msg />
      </form>
    </Modal>
  );
}

function PayModal({ eid, fin, onClose }: { eid: number; fin: any; onClose: () => void }) {
  const a = useAction();
  const [f, setF] = useState<any>({ paid_on: today(), amount: fin.remaining > 0 ? fin.remaining : '' });
  const [needReason, setNeedReason] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const ok = await a.run(() => q(sb.rpc('add_payment', { p_extract: eid, p_paid_on: f.paid_on, p_amount: Number(f.amount), p_transfer_no: f.transfer_no || '', p_bank: f.bank || '', p_note: f.note || '', p_over_reason: f.over_reason || null })));
    if (ok) onClose(); else setNeedReason(true);
  }
  return (
    <Modal title="تسجيل دفعة" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <p className="muted">الصافي للبنك {money(fin.net_to_bank, 0)} · الواصل {money(fin.paid_total)} · الباقي {money(fin.remaining)}</p>
        <Field label="التاريخ"><input id="pay-date" type="date" required value={f.paid_on} onChange={(e) => setF({ ...f, paid_on: e.target.value })} /></Field>
        <Field label="المبلغ"><input id="pay-amount" required inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="رقم التحويل"><input id="pay-transfer" value={f.transfer_no || ''} onChange={(e) => setF({ ...f, transfer_no: e.target.value })} /></Field>
        <Field label="البنك"><input id="pay-bank" value={f.bank || ''} onChange={(e) => setF({ ...f, bank: e.target.value })} /></Field>
        <Field label="ملاحظة"><input id="pay-note" value={f.note || ''} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        {needReason && <Field label="سبب (لو الدفعة بتعدّي الصافي)"><input id="pay-reason" value={f.over_reason || ''} onChange={(e) => setF({ ...f, over_reason: e.target.value })} /></Field>}
        <div className="form-actions"><button disabled={a.busy}>تسجيل</button></div><a.Msg />
      </form>
    </Modal>
  );
}

function EditModal({ e, manager, onClose }: { e: any; manager: boolean; onClose: () => void }) {
  const a = useAction();
  const [f, setF] = useState<any>({
    value: e.type === 'works' ? e.cumulative ?? '' : e.amount ?? '', materials: e.materials, taaliya_rate: String(Number(e.taaliya_rate)),
    extract_date: e.extract_date || '', document_transfer: e.document_transfer ?? '', bank_estimate: e.bank_estimate ?? '',
    insurance_cert: e.insurance_cert || '', labor_cert: e.labor_cert || '', stage_status: e.stage_status, labor_estimate_actual: e.labor_estimate_actual ?? '',
    followup_override: e.followup_override === null ? '' : String(e.followup_override), reason: '',
  });
  const set = (k: string) => (ev: any) => setF({ ...f, [k]: ev.target.value });
  const n = (v: any) => (v === '' || v === null ? null : Number(v));
  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    const ch: any = {
      materials: n(f.materials) ?? 0, extract_date: f.extract_date || null, document_transfer: n(f.document_transfer), bank_estimate: n(f.bank_estimate),
      insurance_cert: f.insurance_cert || null, labor_cert: f.labor_cert || null, stage_status: f.stage_status, labor_estimate_actual: n(f.labor_estimate_actual),
    };
    if (e.type === 'works') ch.cumulative = n(f.value); else ch.amount = n(f.value);
    if (manager) { ch.taaliya_rate = Number(f.taaliya_rate); ch.followup_override = f.followup_override === '' ? null : f.followup_override === 'true'; }
    if (await a.run(() => q(sb.rpc('update_extract', { p_id: e.id, p_changes: ch, p_reason: f.reason || null })))) onClose();
  }
  return (
    <Modal title="تعديل المستخلص" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Field label={e.type === 'works' ? 'الإجمالي التراكمي' : 'القيمة'}><input id="ed-value" inputMode="decimal" value={f.value} onChange={set('value')} /></Field>
        {e.type === 'works' && <Field label="خصم الخامات"><input id="ed-materials" inputMode="decimal" value={f.materials} onChange={set('materials')} /></Field>}
        {manager && e.type === 'works' && <Field label="التعلية"><select id="ed-taaliya" value={f.taaliya_rate} onChange={set('taaliya_rate')}><option value="0">صفر</option><option value="0.1">10%</option></select></Field>}
        <Field label="التاريخ"><input id="ed-date" type="date" value={f.extract_date} onChange={set('extract_date')} /></Field>
        <Field label="التحويل المكتوب في المستند"><input id="ed-doc" inputMode="decimal" value={f.document_transfer} onChange={set('document_transfer')} /></Field>
        <Field label="تقدير يدوي للصافي" hint="للنظام اليدوي أو لحد ما المستند ييجي (م-404، م-407)"><input id="ed-est" inputMode="decimal" value={f.bank_estimate} onChange={set('bank_estimate')} /></Field>
        <Field label="الحالة"><select id="ed-stage" value={f.stage_status} onChange={set('stage_status')}><option value="preparing">تحت الإعداد</option><option value="reviewing">قيد المراجعة</option><option value="approved">معتمد</option><option value="awaiting_payment">في انتظار الصرف</option></select></Field>
        <Field label="شهادة التأمينات"><select id="ed-ins" value={f.insurance_cert} onChange={set('insurance_cert')}><option value="">—</option><option value="done">تم الاستخراج</option><option value="not_done">لم يتم</option><option value="na">لا حاجة</option></select></Field>
        <Field label="شهادة القوة العاملة"><select id="ed-labor" value={f.labor_cert} onChange={set('labor_cert')}><option value="">—</option><option value="done">تم الاستخراج</option><option value="not_done">لم يتم</option><option value="na">لا حاجة</option></select></Field>
        <Field label="تقدير القوة العاملة (المكتب)"><input id="ed-labor-est" inputMode="decimal" value={f.labor_estimate_actual} onChange={set('labor_estimate_actual')} /></Field>
        {manager && <Field label="في كشف المتابعة"><select id="ed-follow" value={f.followup_override} onChange={set('followup_override')}><option value="">تلقائي (اللي ماتصرفش)</option><option value="true">يظهر</option><option value="false">ما يظهرش</option></select></Field>}
        {e.numbers_approved && <Field label="سبب التعديل" hint="مطلوب لأن المستخلص معتمد"><input id="ed-reason" value={f.reason} onChange={set('reason')} /></Field>}
        <div className="form-actions"><button disabled={a.busy}>حفظ</button></div><a.Msg />
      </form>
    </Modal>
  );
}

function CancelModal({ eid, onClose }: { eid: number; onClose: () => void }) {
  const a = useAction();
  const [r, setR] = useState('');
  return (
    <Modal title="إلغاء المستخلص" onClose={onClose}>
      <form className="form" onSubmit={async (e) => { e.preventDefault(); if (await a.run(() => q(sb.rpc('cancel_extract', { p_id: eid, p_reason: r })))) onClose(); }}>
        <p className="muted">المستخلص الملغي بيفضل ظاهر في السجل، ومش بيدخل في أي حساب.</p>
        <Field label="السبب"><input id="cx-reason" required value={r} onChange={(e) => setR(e.target.value)} /></Field>
        <div className="form-actions"><button className="danger" disabled={a.busy}>إلغاء المستخلص</button></div><a.Msg />
      </form>
    </Modal>
  );
}
