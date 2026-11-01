import { createClient } from '@supabase/supabase-js';

// المفتاح ده عام (publishable) ومعمول عشان يكون في المتصفح. الحماية كلها في صلاحيات القاعدة (RLS).
export const SUPABASE_URL = 'https://mbfmscovcwwadaewpgbj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_73hI9vIueIQAth3w73kPvg_AsGIIYm2';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mostakhlasat-auth' },
});

// بيرجّع البيانات أو بيرمي رسالة الخطأ بالعربي زي ما القاعدة كتبتها
export async function q<T = any>(p: PromiseLike<{ data: T | null; error: any }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message || 'حصل خطأ');
  return data as T;
}
