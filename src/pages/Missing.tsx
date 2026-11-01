import { sb, q } from '../supabase';
import { Loading, Table, useLoad } from '../ui';

// البيانات الناقصة (م-804)
export default function Missing() {
  const { data, error } = useLoad(async () => {
    const [m, p] = await Promise.all([
      q(sb.from('missing_data').select('*')),
      q(sb.from('projects').select('id, contract_ref, contract_no_original, short_name')),
    ]);
    const pj = Object.fromEntries((p as any[]).map((x) => [x.id, x]));
    return (m as any[]).map((r) => ({ ...r, project: pj[r.project_id]?.short_name, contract: pj[r.project_id]?.contract_ref || pj[r.project_id]?.contract_no_original || '—' }));
  });
  if (!data) return <Loading error={error} />;
  return (
    <div className="stack">
      <h1>بيانات ناقصة</h1>
      <Table excel="بيانات ناقصة" rows={data} link={(r) => (r.entity === 'project' ? '/projects/' : '/extracts/') + r.id}
        cols={[{ key: 'issue', label: 'الناقص' }, { key: 'contract', label: 'العقد' }, { key: 'project', label: 'المشروع' }]} />
    </div>
  );
}
