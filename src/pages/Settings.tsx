import { useState } from 'react';
import { sb, q } from '../supabase';
import { lookups } from '../lookups';
import { date, download, exportExcel } from '../lib';
import { Field, Loading, Table, useAction, useLoad } from '../ui';
import { useMe } from '../App';

// الإعدادات (م-901، م-904، م-405) والنسخة الاحتياطية (إضافة 4) — للمدير بس
export default function Settings() {
  const me = useMe();
  const [tab, setTab] = useState('backup');
  if (me.role !== 'manager') return <div className="pad muted">الإعدادات للمدير بس.</div>;
  const tabs = [['backup', 'النسخة الاحتياطية'], ['users', 'المستخدمين'], ['lists', 'القوائم'], ['rates', 'نسب الاستقطاع'], ['general', 'إعدادات عامة']];
  return (
    <div className="stack">
      <h1>الإعدادات</h1>
      <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'backup' && <Backup />}
      {tab === 'users' && <Users />}
      {tab === 'lists' && <Lists />}
      {tab === 'rates' && <Rates />}
      {tab === 'general' && <General />}
    </div>
  );
}

function Backup() {
  const a = useAction();
  const { data, reload } = useLoad(() => q(sb.from('backup_status').select('*').maybeSingle()));
  const b: any = data;
  async function take() {
    await a.run(async () => {
      const res: any = await q(sb.rpc('export_backup'));
      const stamp = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
      download(`mostakhlasat-backup-${stamp}.json`, JSON.stringify(res));
      const t = res.tables;
      const sheet = (name: string, rows: any[]) => ({ name, rows, cols: Object.keys(rows[0] || { id: 1 }).map((k) => ({ key: k, label: k, xl: (v: any) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : v) })) });
      exportExcel(`mostakhlasat-backup-${stamp}.xlsx`, [
        sheet('projects', t.projects), sheet('extracts', t.extracts), sheet('payments', t.payments), sheet('movements', t.extract_movements),
        sheet('notes', t.extract_notes), sheet('memos', t.reduction_memos), sheet('labor_payments', t.labor_payments),
      ]);
      reload();
    }, 'النسخة اتنزلت: ملف JSON (للاستعادة) وملف إكسيل (للقراية من غير البرنامج). انقلهم على الفلاشة.');
  }
  return (
    <section className="card stack">
      <h2>النسخة الاحتياطية</h2>
      <p>الخطة المجانية مفيهاش نسخ احتياطي، فالنسخة دي هي الحماية الوحيدة لو حصلت مشكلة. نزّلها كل أسبوع على الأقل وحطها على الفلاشة.</p>
      <p className="muted">آخر نسخة: {b?.last_taken_at ? `${date(b.last_taken_at)} (من ${b.days_since} يوم)` : 'لسه ما اتعملتش'}</p>
      <div><button disabled={a.busy} onClick={take}>نزّل نسخة دلوقتي</button></div>
      <a.Msg />
    </section>
  );
}

function Users() {
  const a = useAction();
  const { data, error, reload } = useLoad(() => q(sb.from('profiles').select('*').order('created_at')));
  if (!data) return <Loading error={error} />;
  const upd = (id: string, ch: any) => a.run(() => q(sb.from('profiles').update(ch).eq('id', id)), 'اتحفظ').then(reload);
  return (
    <section className="card stack">
      <p className="muted">أي حد يعمل حساب من صفحة الدخول بيبدأ متوقف، ومش بيشوف حاجة لحد ما تفعّله هنا.</p>
      <a.Msg />
      <Table rows={data as any[]} search={false}
        cols={[
          { key: 'full_name', label: 'الاسم' }, { key: 'email', label: 'الإيميل', fmt: (v) => <span dir="ltr">{v || '—'}</span> },
          { key: 'role', label: 'الدور', fmt: (v, r) => <select id={'role-' + r.id} value={v} onChange={(e) => upd(r.id, { role: e.target.value })}><option value="manager">مدير</option><option value="follower">متابعة</option></select> },
          { key: 'active', label: 'الحالة', fmt: (v, r) => <button className={v ? 'ghost' : ''} onClick={() => upd(r.id, { active: !v })}>{v ? 'إيقاف' : 'تفعيل'}</button> },
          { key: 'id', label: 'كلمة السر', fmt: (_v, r) => r.email ? <button className="link" onClick={() => a.run(() => sb.auth.resetPasswordForEmail(r.email, { redirectTo: location.href.split('#')[0] }).then(({ error }) => { if (error) throw error; }), 'اتبعت رابط تغيير كلمة السر')}>ابعت رابط</button> : '—' },
        ]} />
    </section>
  );
}

function Lists() {
  const a = useAction();
  const { data, error, reload } = useLoad(() => lookups(true));
  const [site, setSite] = useState('');
  if (!data) return <Loading error={error} />;
  const save = (t: string, key: string, id: any, ch: any) => a.run(() => q(sb.from(t).update(ch).eq(key, id)), 'اتحفظ').then(() => { lookups(true); reload(); });
  return (
    <div className="stack">
      <a.Msg />
      <section className="card"><h2>الشركات وترويساتها</h2>
        <Table rows={data.companies} search={false} cols={[
          { key: 'name', label: 'الاسم', fmt: (v, r) => <input id={'co-name-' + r.id} defaultValue={v} onBlur={(e) => e.target.value !== v && save('companies', 'id', r.id, { name: e.target.value })} /> },
          { key: 'header_line', label: 'سطر تحت الترويسة', fmt: (v, r) => <input id={'co-line-' + r.id} defaultValue={v} onBlur={(e) => e.target.value !== v && save('companies', 'id', r.id, { header_line: e.target.value })} /> },
          { key: 'color', label: 'اللون', fmt: (v, r) => <input id={'co-color-' + r.id} type="color" defaultValue={v} onBlur={(e) => e.target.value !== v && save('companies', 'id', r.id, { color: e.target.value })} /> },
          { key: 'logo_path', label: 'اللوجو', fmt: (v) => (v ? <img src={'./' + v} alt="" style={{ height: 32 }} /> : 'ترويسة نصية') },
        ]} />
      </section>
      <section className="card"><h2>الجهات</h2>
        <Table rows={data.agencies} search={false} cols={[
          { key: 'name', label: 'الجهة' },
          { key: 'deduction_system', label: 'نظام الاستقطاع', fmt: (v, r) => <select id={'ag-sys-' + r.id} value={v} onChange={(e) => save('agencies', 'id', r.id, { deduction_system: e.target.value })}><option value="afa_2025">القوات المسلحة بعد 18/7/2025</option><option value="manual">يدوي</option></select> },
          { key: 'labor_basis', label: 'القوة العاملة', fmt: (v, r) => <select id={'ag-lab-' + r.id} value={v} onChange={(e) => save('agencies', 'id', r.id, { labor_basis: e.target.value })}><option value="contract_total">على إجمالي العقد</option><option value="per_extract">على كل مستخلص</option></select> },
        ]} />
      </section>
      <section className="card"><h2>المحطات وحد التأخير</h2>
        <Table rows={data.stations} search={false} cols={[
          { key: 'name', label: 'المحطة' },
          { key: 'delay_limit_days', label: 'حد التأخير (يوم)', fmt: (v, r) => <input id={'st-delay-' + r.code} type="number" min={1} defaultValue={v} onBlur={(e) => Number(e.target.value) !== v && save('stations', 'code', r.code, { delay_limit_days: Number(e.target.value) })} /> },
        ]} />
      </section>
      <section className="card"><h2>المواقع</h2>
        <p>{data.sites.map((s) => s.name).join(' · ')}</p>
        <form className="row gap" onSubmit={(e) => { e.preventDefault(); if (site.trim()) a.run(() => q(sb.from('sites').insert({ name: site.trim() })), 'اتضاف').then(() => { setSite(''); lookups(true); reload(); }); }}>
          <input id="new-site" placeholder="موقع جديد" value={site} onChange={(e) => setSite(e.target.value)} /><button>إضافة</button>
        </form>
      </section>
    </div>
  );
}

function Rates() {
  const a = useAction();
  const { data, error, reload } = useLoad(() => q(sb.from('deduction_rate_versions').select('*').order('effective_from', { ascending: false })));
  const [draft, setDraft] = useState<{ from: string; json: string; note: string } | null>(null);
  if (!data) return <Loading error={error} />;
  const rows = data as any[];
  return (
    <section className="card stack">
      <p className="muted">تغيير أي نسبة بيعمل نسخة جديدة بتاريخ سريان، والمستخلصات القديمة بتفضل على نسختها (م-405). النسخة بعد ما تتسجل ما بتتعدلش.</p>
      <Table rows={rows} search={false} cols={[{ key: 'effective_from', label: 'سارية من' }, { key: 'system_code', label: 'النظام' }, { key: 'note', label: 'ملاحظة' }]} />
      {!draft ? <div><button onClick={() => setDraft({ from: '', json: JSON.stringify(rows[0]?.params, null, 2), note: '' })}>نسخة نسب جديدة</button></div> : (
        <form className="form" onSubmit={(e) => { e.preventDefault(); a.run(async () => {
          const params = JSON.parse(draft.json);
          await q(sb.from('deduction_rate_versions').insert({ system_code: 'afa_2025', effective_from: draft.from, params, note: draft.note }));
          setDraft(null); reload();
        }, 'النسخة اتسجلت'); }}>
          <Field label="سارية من"><input id="rv-from" type="date" required value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></Field>
          <Field label="ملاحظة (إيه اللي اتغير ومنين)"><input id="rv-note" required value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></Field>
          <Field label="النسب"><textarea id="rv-json" dir="ltr" rows={18} value={draft.json} onChange={(e) => setDraft({ ...draft, json: e.target.value })} /></Field>
          <div className="form-actions"><button>حفظ النسخة</button><button type="button" className="ghost" onClick={() => setDraft(null)}>إلغاء</button></div>
        </form>
      )}
      <a.Msg />
    </section>
  );
}

function General() {
  const a = useAction();
  const { data, error, reload } = useLoad(() => q(sb.from('settings').select('*').order('key')));
  if (!data) return <Loading error={error} />;
  return (
    <section className="card stack">
      <Table rows={data as any[]} search={false} cols={[
        { key: 'label', label: 'الإعداد' },
        { key: 'value', label: 'القيمة', fmt: (v, r) => <input id={'set-' + r.key} inputMode="decimal" defaultValue={v} onBlur={(e) => Number(e.target.value) !== Number(v) && a.run(() => q(sb.from('settings').update({ value: Number(e.target.value) }).eq('key', r.key)), 'اتحفظ').then(reload)} /> },
      ]} />
      <a.Msg />
    </section>
  );
}
