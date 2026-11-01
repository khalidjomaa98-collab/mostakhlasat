import * as XLSX from 'xlsx';

export const money = (v: any, digits = 2) =>
  v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits });
export const pct = (v: any) => (v === null || v === undefined ? '—' : (Number(v) * 100).toFixed(2) + '%');
export const date = (v: any) => {
  if (!v) return '—';
  const d = new Date(v);
  return d.toLocaleDateString('en-GB', { timeZone: 'Africa/Cairo' });
};
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });

export const PAY: Record<string, string> = {
  unpaid: 'لم يُصرف', partially_paid: 'مصروف جزئيًا', paid: 'تم الصرف', paid_no_data: 'اتصرف (من غير بيانات)',
  unknown: 'غير معروف', cancelled: 'ملغي',
};
export const STATUS: Record<string, string> = {
  preparing: 'تحت الإعداد', reviewing: 'قيد المراجعة', approved: 'معتمد', awaiting_payment: 'في انتظار الصرف',
  istifaa: 'استيفاء', partially_paid: 'مصروف جزئيًا', paid: 'تم الصرف', cancelled: 'ملغي',
};
export const CERT: Record<string, string> = { done: 'تم', not_done: 'لم يتم', na: 'لا حاجة' };
export const TYPES: Record<string, string> = {
  works: 'مستخلص أعمال', taaliya_refund: 'رد تعلية تأمينات', retention_refund: 'رد ضمان أعمال',
  final_insurance_refund: 'رد تأمين نهائي', authorized_diff: 'فرق مصرح بصرفه',
};
export const TAX: Record<string, string> = { '14': '14%', '5.04': '5.04% (الوعاء)', '0': 'معفي' };
export const PSTATUS: Record<string, string> = { under_contract: 'تحت التعاقد', active: 'جاري', finished: 'منتهي' };
export const SOURCE: Record<string, string> = {
  document: 'من المستند', manual_estimate: 'تقدير يدوي', engine: 'محسوب', amount: 'القيمة',
};

export type Col = { key: string; label: string; fmt?: (v: any, row: any) => any; xl?: (v: any, row: any) => any };

// تصدير أي جدول لإكسيل (م-905)
export function exportExcel(filename: string, sheets: { name: string; cols: Col[]; rows: any[] }[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const data = [s.cols.map((c) => c.label), ...s.rows.map((r) => s.cols.map((c) => (c.xl ? c.xl(r[c.key], r) : r[c.key] ?? '')))];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = s.cols.map(() => ({ wch: 18 }));
    (ws as any)['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  wb.Workbook = { Views: [{ RTL: true }] } as any;
  XLSX.writeFile(wb, filename);
}

export function download(filename: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
