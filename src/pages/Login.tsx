import { useState } from 'react';
import { sb } from '../supabase';

export default function Login() {
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; s: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      if (mode === 'in') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message.includes('Invalid') ? 'الإيميل أو كلمة السر غلط' : error.message);
      } else if (mode === 'up') {
        if (password.length < 10) throw new Error('كلمة السر لازم تبقى 10 حروف على الأقل');
        const { error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: location.href.split('#')[0] } });
        if (error) throw new Error(error.message);
        setMsg({ t: 'ok', s: 'الحساب اتعمل. افتح الإيميل اللي وصلك واضغط على رابط التأكيد، وبعدها ادخل. والمدير لازم يفعّل حسابك.' });
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] });
        if (error) throw new Error(error.message);
        setMsg({ t: 'ok', s: 'لو الإيميل متسجل، هيوصلك رابط لتغيير كلمة السر.' });
      }
    } catch (err: any) { setMsg({ t: 'err', s: err.message }); }
    finally { setBusy(false); }
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logos"><img src="./logos/dammam.png" alt="الدمام" /><img src="./logos/rabat.png" alt="الرباط" /></div>
        <h1>منظومة متابعة المستخلصات</h1>
        {mode === 'up' && <label className="field"><span>الاسم</span><input id="signup-name" required value={name} onChange={(e) => setName(e.target.value)} /></label>}
        <label className="field"><span>الإيميل</span><input id="login-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" /></label>
        {mode !== 'reset' && <label className="field"><span>كلمة السر</span><input id="login-password" type="password" required autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" /></label>}
        <button disabled={busy}>{mode === 'in' ? 'دخول' : mode === 'up' ? 'إنشاء حساب' : 'ابعت رابط'}</button>
        {msg && <div className={'msg ' + msg.t}>{msg.s}</div>}
        <div className="login-links">
          {mode !== 'in' && <button type="button" className="link" onClick={() => setMode('in')}>عندي حساب</button>}
          {mode !== 'up' && <button type="button" className="link" onClick={() => setMode('up')}>حساب جديد</button>}
          {mode !== 'reset' && <button type="button" className="link" onClick={() => setMode('reset')}>نسيت كلمة السر</button>}
        </div>
      </form>
    </div>
  );
}
