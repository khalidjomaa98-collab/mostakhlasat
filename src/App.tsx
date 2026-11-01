import { createContext, useContext, useEffect, useState } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { sb, q } from './supabase';
import Login from './pages/Login';
import Home from './pages/Home';
import Projects from './pages/Projects';
import Project from './pages/Project';
import Extracts from './pages/Extracts';
import Extract from './pages/Extract';
import Followup from './pages/Followup';
import Issue from './pages/Issue';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Missing from './pages/Missing';

export type Me = { id: string; full_name: string; role: 'manager' | 'follower'; active: boolean; email: string };
const MeCtx = createContext<Me | null>(null);
export const useMe = () => useContext(MeCtx)!;
export const isManager = (m: Me) => m.role === 'manager';

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [me, setMe] = useState<Me | null>(null);
  const [meErr, setMeErr] = useState<string | null>(null);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setMe(null); return; }
    q(sb.from('profiles').select('id, full_name, role, active').eq('id', session.user.id).maybeSingle())
      .then((p: any) => setMe(p ? { ...p, email: session.user.email || '' } : null))
      .catch((e) => setMeErr(e.message));
  }, [session]);

  if (session === undefined) return <div className="center pad muted">جاري التحميل…</div>;
  if (!session) return <Login />;
  if (meErr) return <div className="pad msg err">{meErr}</div>;
  if (!me) return <div className="center pad muted">جاري التحميل…</div>;
  if (!me.active) return (
    <div className="login"><div className="login-card">
      <h1>حسابك مستني التفعيل</h1>
      <p className="muted">الحساب {session.user.email} اتعمل، بس لازم المدير يفعّله من الإعدادات ← المستخدمين قبل ما تشوف أي بيانات.</p>
      <button onClick={() => sb.auth.signOut()}>خروج</button>
    </div></div>
  );

  return (
    <MeCtx.Provider value={me}>
      <Shell />
    </MeCtx.Provider>
  );
}

function Shell() {
  const me = useMe();
  const nav = useNavigate();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);

  // خروج تلقائي بعد 30 دقيقة من غير استخدام على الكمبيوتر و7 أيام على الموبايل (ت-04)
  useEffect(() => {
    const mobile = matchMedia('(max-width: 760px)').matches;
    const limit = (mobile ? 7 * 24 * 60 : 30) * 60 * 1000;
    const key = 'mostakhlasat-last-active';
    const touch = () => { try { localStorage.setItem(key, String(Date.now())); } catch { /* ignore */ } };
    const check = () => {
      let last = Date.now();
      try { last = Number(localStorage.getItem(key)) || Date.now(); } catch { /* ignore */ }
      if (Date.now() - last > limit) sb.auth.signOut();
    };
    check(); touch();
    const evs = ['click', 'keydown', 'touchstart'];
    evs.forEach((e) => addEventListener(e, touch, { passive: true }));
    const t = setInterval(check, 60 * 1000);
    return () => { evs.forEach((e) => removeEventListener(e, touch)); clearInterval(t); };
  }, []);

  const links = [
    ['/', 'الرئيسية'], ['/followup', 'كشف المتابعة'], ['/extracts', 'المستخلصات'], ['/projects', 'المشروعات'],
    ['/reports', 'التقارير'], ['/missing', 'بيانات ناقصة'], ...(me.role === 'manager' ? [['/settings', 'الإعدادات']] : []),
  ];
  return (
    <div className="app">
      <header className="topbar no-print">
        <button className="ghost menu-btn" onClick={() => setOpen(!open)} aria-label="القائمة">☰</button>
        <b className="brand">المستخلصات</b>
        <nav className={open ? 'open' : ''} onClick={() => setOpen(false)}>
          {links.map(([to, l]) => <NavLink key={to} to={to} end={to === '/'}>{l}</NavLink>)}
        </nav>
        <form className="gsearch" onSubmit={(e) => { e.preventDefault(); if (term.trim()) nav('/extracts?q=' + encodeURIComponent(term.trim())); }}>
          <input id="global-search" placeholder="رقم عقد أو مشروع أو مستخلص" value={term} onChange={(e) => setTerm(e.target.value)} />
        </form>
        <span className="who">{me.full_name || me.email} · {me.role === 'manager' ? 'مدير' : 'متابعة'}</span>
        <button className="ghost" onClick={() => sb.auth.signOut()}>خروج</button>
      </header>
      <main className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<Project />} />
          <Route path="/extracts" element={<Extracts />} />
          <Route path="/extracts/:id" element={<Extract />} />
          <Route path="/followup" element={<Followup />} />
          <Route path="/issues/:id" element={<Issue />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/missing" element={<Missing />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<div className="pad muted">الصفحة دي مش موجودة</div>} />
        </Routes>
      </main>
    </div>
  );
}
