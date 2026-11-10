import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, LogOut, ShieldCheck, Music2, RefreshCw } from 'lucide-react'
import { supabase } from './lib/supabase'

type Profile = { display_name: string; role: 'super_admin' | 'staff' }
type Row = Record<string, any>
type Tab = 'levels' | 'years' | 'terms' | 'classes' | 'subjects' | 'links' | 'students' | 'grades' | 'announcements'

const tabs: { id: Tab; label: string; adminOnly?: boolean }[] = [
  { id: 'levels', label: 'المستويات', adminOnly: true },
  { id: 'years', label: 'السنوات', adminOnly: true },
  { id: 'terms', label: 'الترمات', adminOnly: true },
  { id: 'classes', label: 'الفصول', adminOnly: true },
  { id: 'subjects', label: 'المواد', adminOnly: true },
  { id: 'links', label: 'مواد الفصول', adminOnly: true },
  { id: 'students', label: 'الطلاب', adminOnly: true },
  { id: 'grades', label: 'الدرجات' },
  { id: 'announcements', label: 'الإعلانات', adminOnly: true },
]

const tableByTab: Partial<Record<Tab, string>> = {
  levels: 'academic_levels', years: 'academic_years', terms: 'terms', classes: 'classes',
  subjects: 'subjects', links: 'class_subjects', students: 'students', grades: 'grades',
  announcements: 'announcements',
}

export default function Admin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState<Tab>('levels')
  const [rows, setRows] = useState<Row[]>([])
  const [levels, setLevels] = useState<Row[]>([])
  const [years, setYears] = useState<Row[]>([])
  const [terms, setTerms] = useState<Row[]>([])
  const [classes, setClasses] = useState<Row[]>([])
  const [subjects, setSubjects] = useState<Row[]>([])
  const [links, setLinks] = useState<Row[]>([])
  const [students, setStudents] = useState<Row[]>([])
  const [form, setForm] = useState<Record<string, string>>({})
  const isAdmin = profile?.role === 'super_admin'

  const loadProfile = useCallback(async (id: string) => {
    if (!supabase) return
    const { data, error } = await supabase.from('profiles').select('display_name, role').eq('id', id).single()
    if (error || !data || !['super_admin', 'staff'].includes(data.role)) {
      setProfile(null); setUserId(''); setMessage('الحساب ده مش مربوط بصلاحية إدارية. راجع المسؤول الرئيسي.')
      await supabase.auth.signOut(); return
    }
    setProfile(data as Profile); setUserId(id); setMessage('')
  }, [])

  useEffect(() => {
    if (!supabase) return
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (alive && data.session?.user) void loadProfile(data.session.user.id)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive && session?.user) void loadProfile(session.user.id)
      if (alive && !session) { setProfile(null); setUserId('') }
    })
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [loadProfile])

  const refresh = useCallback(async () => {
    if (!supabase || !profile) return
    setLoading(true)
    const [l,y,t,c,s,cs,st] = await Promise.all([
      supabase.from('academic_levels').select('*').order('sort_order'),
      supabase.from('academic_years').select('*').order('sort_order'),
      supabase.from('terms').select('*').order('sort_order'),
      supabase.from('classes').select('*').order('name'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('class_subjects').select('*'),
      supabase.from('students').select('*').order('full_name'),
    ])
    setLevels(l.data || []); setYears(y.data || []); setTerms(t.data || [])
    setClasses(c.data || []); setSubjects(s.data || []); setLinks(cs.data || []); setStudents(st.data || [])
    const table = tableByTab[tab]
    if (table) {
      const result = await supabase.from(table).select('*').order('created_at', { ascending: false }).limit(150)
      if (result.error) {
        const fallback = await supabase.from(table).select('*').limit(150)
        setRows(fallback.data || [])
      } else setRows(result.data || [])
    }
    setLoading(false)
  }, [profile, tab])

  useEffect(() => { if (profile) void refresh() }, [profile, refresh])

  async function addRecord(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !profile) return
    setLoading(true); setMessage('')
    let table = ''; let payload: Row = {}
    if (tab === 'levels') { table = 'academic_levels'; payload = { name: form.name, sort_order: Number(form.sort_order || 0) } }
    if (tab === 'years') { table = 'academic_years'; payload = { level_id: form.level_id, name: form.name, sort_order: Number(form.sort_order || 0), is_current: form.is_current === 'true' } }
    if (tab === 'terms') { table = 'terms'; payload = { academic_year_id: form.academic_year_id, name: form.name, sort_order: Number(form.sort_order || 0) } }
    if (tab === 'classes') { table = 'classes'; payload = { academic_year_id: form.academic_year_id, term_id: form.term_id, name: form.name } }
    if (tab === 'subjects') { table = 'subjects'; payload = { name: form.name } }
    if (tab === 'links') { table = 'class_subjects'; payload = { class_id: form.class_id, subject_id: form.subject_id, final_grade: Number(form.final_grade), passing_grade: Number(form.passing_grade) } }
    if (tab === 'students') { table = 'students'; payload = { student_code: form.student_code, full_name: form.full_name, class_id: form.class_id } }
    if (tab === 'announcements') { table = 'announcements'; payload = { title: form.title, body: form.body, is_published: form.is_published === 'true', created_by: userId } }
    const { error } = await supabase.from(table).insert(payload)
    setLoading(false)
    if (error) { setMessage('لم يتم الحفظ: ' + error.message); return }
    setMessage('تم الحفظ بنجاح.')
    setForm({})
    await refresh()
  }

  async function saveGrade(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !profile) return
    const link = links.find(x => x.id === form.class_subject_id)
    const student = students.find(x => x.id === form.student_id)
    if (!link || !student || student.class_id !== link.class_id) {
      setMessage('اختار طالبًا ومادة من نفس الفصل.'); return
    }
    const score = Number(form.score)
    if (!Number.isFinite(score) || score < 0 || score > Number(link.final_grade)) {
      setMessage('الدرجة لازم تكون بين صفر والدرجة النهائية للمادة.'); return
    }
    setLoading(true); setMessage('')
    const { error } = await supabase.from('grades').upsert({
      student_id: form.student_id, class_subject_id: form.class_subject_id,
      score, status: form.status || 'draft', updated_by: userId,
    }, { onConflict: 'student_id,class_subject_id' })
    setLoading(false)
    if (error) { setMessage('لم يتم حفظ الدرجة: ' + error.message); return }
    setMessage('تم حفظ الدرجة. ' + (form.status === 'ready' ? 'أصبحت جاهزة لمراجعة المسؤول الرئيسي.' : 'حُفظت كمسودة.'))
    setForm({})
    await refresh()
  }

  async function publishClass(classId: string) {
    if (!supabase || !isAdmin) return
    setLoading(true)
    const { error } = await supabase.rpc('publish_class_results', { target_class_id: classId })
    setLoading(false)
    setMessage(error ? 'تعذر اعتماد النتائج: ' + error.message : 'تم نشر الدرجات الجاهزة لهذا الفصل.')
    await refresh()
  }

  async function signIn(event: FormEvent) {
    event.preventDefault(); setMessage('')
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
    await supabase.auth.signOut(); setProfile(null); setUserId(''); setPassword('')
  }

  const field = (name: string, label: string, placeholder = '', type = 'text') => (
    <label className="adm-field">{label}<input required name={name} type={type} value={form[name] || ''} placeholder={placeholder} onChange={e => setForm(v => ({ ...v, [name]: e.target.value }))}/></label>
  )
  const selectField = (name: string, label: string, options: Row[], getLabel: (x: Row) => string) => (
    <label className="adm-field">{label}<select required value={form[name] || ''} onChange={e => setForm(v => ({ ...v, [name]: e.target.value }))}><option value="">اختر...</option>{options.map(x => <option key={x.id} value={x.id}>{getLabel(x)}</option>)}</select></label>
  )
  const nameOf = (items: Row[], id: string, key: string) => items.find(x => x.id === id)?.[key] || '—'
  const labels: Record<Tab,string> = { levels:'المستويات الدراسية', years:'السنوات الدراسية', terms:'الترمات', classes:'الفصول', subjects:'المواد', links:'ربط المواد بالفصول', students:'الطلاب', grades:'إدخال الدرجات', announcements:'إعلانات المدرسة' }

  return (
    <main className="admin-page" dir="rtl">
      <header className="admin-header">
        <a className="brand" href="/"><span className="brand-mark"><Music2 size={23}/></span><span>ألحان تي اتشرومبي<small>بوابة الإدارة</small></span></a>
        <a className="admin-back" href="/"><ArrowRight size={16}/> العودة للموقع</a>
      </header>
      <section className={profile ? 'admin-dashboard' : 'admin-shell'}>
        <div className="admin-heading"><span className="admin-shield"><ShieldCheck size={25}/></span><span className="kicker">منطقة محمية</span><h1>إدارة المدرسة</h1><p>سجّل الدخول بحساب إداري معتمد لإدارة بيانات المدرسة والنتائج.</p></div>
        {!profile ? (
          <form className="admin-login" onSubmit={signIn}>
            <label htmlFor="admin-email">البريد الإلكتروني</label><input id="admin-email" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/>
            <label htmlFor="admin-password">كلمة المرور</label><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="كلمة المرور"/>
            <button className="primary-btn" disabled={loading}>{loading ? 'جاري التحقق...' : 'تسجيل الدخول'}</button>
            {message && <p className="notice" role="alert">{message}</p>}
            {!supabase && <p className="admin-hint">لم يتم ربط إعدادات Supabase ببيئة تشغيل الموقع حتى الآن.</p>}
          </form>
        ) : (
          <>
            <div className="admin-userbar"><div><strong>أهلًا {profile.display_name || 'بك'}</strong><small>{isAdmin ? 'المسؤول الرئيسي' : 'مسؤول درجات'}</small></div><button className="admin-logout" onClick={signOut}><LogOut size={16}/> خروج</button></div>
            <div className="admin-tabs">{tabs.filter(x => isAdmin || !x.adminOnly).map(x=><button key={x.id} className={tab===x.id?'active':''} onClick={()=>{setTab(x.id);setForm({});setMessage('')}}>{x.label}</button>)}</div>
            <div className="admin-workspace">
              <div className="admin-work-title"><div><span className="kicker">لوحة التحكم</span><h2>{labels[tab]}</h2></div><button className="admin-refresh" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={15}/> تحديث</button></div>
              {tab === 'grades' ? (
                <form className="admin-form-grid" onSubmit={saveGrade}>
                  {selectField('student_id','الطالب',students,x=>x.full_name+' — '+x.student_code)}
                  {selectField('class_subject_id','المادة والفصل',links,x=>nameOf(classes,x.class_id,'name')+' / '+nameOf(subjects,x.subject_id,'name')+' ('+x.final_grade+')')}
                  {field('score','الدرجة','مثال: 85','number')}
                  <label className="adm-field">حالة الدرجة<select value={form.status || 'draft'} onChange={e=>setForm(v=>({...v,status:e.target.value}))}><option value="draft">مسودة</option><option value="ready">جاهزة للاعتماد</option></select></label>
                  <button className="primary-btn" disabled={loading}>حفظ الدرجة</button>
                  <p className="admin-hint">المسؤول العادي يقدر يحفظ مسودة أو يرسل الدرجة للمراجعة، ولا يقدر ينشرها.</p>
                </form>
              ) : tab === 'levels' ? (
                <form className="admin-form-grid" onSubmit={addRecord}>{field('name','اسم المستوى','المستوى الأول')}{field('sort_order','ترتيب الظهور','1','number')}<button className="primary-btn" disabled={loading}>إضافة المستوى</button></form>
              ) : tab === 'years' ? (
                <form className="admin-form-grid" onSubmit={addRecord}>{selectField('level_id','المستوى',levels,x=>x.name)}{field('name','اسم السنة','السنة الأولى')}{field('sort_order','الترتيب','1','number')}<label className="adm-field">السنة الحالية<select value={form.is_current || 'false'} onChange={e=>setForm(v=>({...v,is_current:e.target.value}))}><option value="true">نعم</option><option value="false">لا</option></select></label><button className="primary-btn" disabled={loading}>إضافة السنة</button></form>
              ) : tab === 'terms' ? (
                <form className="admin-form-grid" onSubmit={addRecord}>{selectField('academic_year_id','السنة الدراسية',years,x=>x.name)}{field('name','اسم الترم','الترم الأول')}{field('sort_order','الترتيب','1','number')}<button className="primary-btn" disabled={loading}>إضافة الترم</button></form>
              ) : tab === 'classes' ? (
                <form className="admin-form-grid" onSubmit={addRecord}>{selectField('academic_year_id','السنة الدراسية',years,x=>x.name)}{selectField('term_id','الترم',terms,x=>x.name)}{field('name','اسم الفصل','الفصل الأول')}<button className="primary-btn" disabled={loading}>إضافة الفصل</button></form>
              ) : tab === 'subjects' ? (
                <form className="admin-form-grid" onSubmit={addRecord}>{field('name','اسم المادة','اسم المادة') }<button className="primary-btn" disabled={loading}>إضافة المادة</button></form>
              ) : tab === 'links' ? (
                <form className="admin-form-grid" onSubmit={addRecord}>{selectField('class_id','الفصل',classes,x=>x.name)}{selectField('subject_id','المادة',subjects,x=>x.name)}{field('final_grade','الدرجة النهائية','100','number')}{field('passing_grade','درجة النجاح','50','number')}<button className="primary-btn" disabled={loading}>ربط المادة بالفصل</button></form>
              ) : tab === 'students' ? (
                <form className="admin-form-grid" onSubmit={addRecord}>{field('full_name','اسم الطالب','الاسم بالكامل')}{field('student_code','كود الطالب','كود فريد')}{selectField('class_id','الفصل',classes,x=>x.name)}<button className="primary-btn" disabled={loading}>إضافة الطالب</button></form>
              ) : (
                <form className="admin-form-grid" onSubmit={addRecord}>{field('title','عنوان الإعلان','عنوان الإعلان')}<label className="adm-field">نص الإعلان<textarea required value={form.body || ''} onChange={e=>setForm(v=>({...v,body:e.target.value}))}/></label><label className="adm-field">النشر<select value={form.is_published || 'false'} onChange={e=>setForm(v=>({...v,is_published:e.target.value}))}><option value="false">مسودة</option><option value="true">نشر فورًا</option></select></label><button className="primary-btn" disabled={loading}>حفظ الإعلان</button></form>
              )}
              {message && <p className="notice" role="status">{message}</p>}
              {tab === 'grades' && isAdmin && <div className="admin-publish"><strong>اعتماد ونشر النتائج</strong><p>النشر يقتصر على الدرجات الجاهزة في الفصل المختار.</p>{classes.map(c=><button key={c.id} className="admin-publish-btn" disabled={loading} onClick={()=>void publishClass(c.id)}>نشر نتائج {c.name}</button>)}</div>}
              <div className="admin-records"><h3>السجلات الحالية ({rows.length})</h3>{rows.length===0?<p className="admin-hint">لا توجد سجلات لعرضها بعد.</p>:rows.map((r,i)=><div className="admin-record" key={r.id || i}><strong>{r.name || r.full_name || r.title || (r.score !== undefined ? 'درجة: '+r.score : 'سجل محفوظ')}</strong><small>{r.student_code || r.body || r.status || r.id}</small></div>)}</div>
            </div>
          </>
        )}
        <p className="admin-footnote">كل عمليات الحفظ تخضع لصلاحيات قاعدة البيانات وسياسات الحماية.</p>
      </section>
    </main>
  )
}
