import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, LogOut, ShieldCheck, Music2 } from 'lucide-react'
import { supabase } from './lib/supabase'

type Profile = { display_name: string; role: 'super_admin' | 'staff' }

export default function Admin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function loadProfile(userId: string) {
    if (!supabase) return
    const { data, error } = await supabase.from('profiles').select('display_name, role').eq('id', userId).single()
    if (error || !data || !['super_admin', 'staff'].includes(data.role)) {
      setProfile(null)
      setMessage('الحساب ده مش مربوط بصلاحية إدارية. راجع المسؤول الرئيسي.')
      await supabase.auth.signOut()
      return
    }
    setProfile(data as Profile)
    setMessage('')
  }

  useEffect(() => {
    if (!supabase) return
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (alive && data.session?.user) void loadProfile(data.session.user.id)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive && session?.user) void loadProfile(session.user.id)
      if (alive && !session) setProfile(null)
    })
    return () => {
      alive = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function signIn(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    if (!supabase) { setMessage('إعدادات الاتصال بقاعدة البيانات لم تكتمل بعد.'); return }
    if (!email.trim() || !password) { setMessage('اكتب البريد الإلكتروني وكلمة المرور.'); return }
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error || !data.user) { setMessage('تعذر تسجيل الدخول. راجع البريد الإلكتروني وكلمة المرور.'); return }
    await loadProfile(data.user.id)
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    setProfile(null)
    setPassword('')
  }

  return (
    <main className="admin-page" dir="rtl">
      <header className="admin-header">
        <a className="brand" href="/"><span className="brand-mark"><Music2 size={23}/></span><span>ألحان تي اتشرومبي<small>بوابة الإدارة</small></span></a>
        <a className="admin-back" href="/"><ArrowRight size={16}/> العودة للموقع</a>
      </header>
      <section className="admin-shell">
        <div className="admin-heading"><span className="admin-shield"><ShieldCheck size={25}/></span><span className="kicker">منطقة محمية</span><h1>إدارة المدرسة</h1><p>سجّل الدخول بحساب إداري معتمد للمتابعة وإدارة بيانات المدرسة.</p></div>
        {!profile ? (
          <form className="admin-login" onSubmit={signIn}>
            <label htmlFor="admin-email">البريد الإلكتروني</label>
            <input id="admin-email" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/>
            <label htmlFor="admin-password">كلمة المرور</label>
            <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="كلمة المرور"/>
            <button className="primary-btn" disabled={loading}>{loading ? 'جاري التحقق...' : 'تسجيل الدخول'}</button>
            {message && <p className="notice" role="alert">{message}</p>}
            {!supabase && <p className="admin-hint">لم يتم ربط إعدادات Supabase ببيئة تشغيل الموقع حتى الآن.</p>}
          </form>
        ) : (
          <div className="admin-welcome">
            <span className="admin-status"><ShieldCheck size={17}/> تم التحقق من الصلاحية</span>
            <h2>أهلًا {profile.display_name || 'بك'}</h2>
            <p>نوع الحساب: {profile.role === 'super_admin' ? 'المسؤول الرئيسي' : 'مسؤول'}</p>
            <div className="admin-next"><strong>تم تجهيز بوابة الدخول.</strong><span>الخطوة التالية هي بناء أقسام الإدارة وربطها بالصلاحيات المسجلة في قاعدة البيانات.</span></div>
            <button className="admin-logout" onClick={signOut}><LogOut size={16}/> تسجيل الخروج</button>
          </div>
        )}
        <p className="admin-footnote">الدخول محمي بحساب Supabase والصلاحيات الموجودة في قاعدة البيانات.</p>
      </section>
    </main>
  )
}
