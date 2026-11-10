import { useEffect, useState } from 'react'
import { ArrowLeft, Bell, BookOpen, GraduationCap, Music2, Search, ShieldCheck, Sparkles } from 'lucide-react'
import { supabase } from './lib/supabase'
import Admin from './Admin'

type Announcement = { id: string; title: string; body: string; created_at: string }\ntype PublicSettings = { school_name:string; tagline:string; hero_title:string; hero_description:string; logo_url:string; about_text:string }
type StudentResult = { student_name: string; student_code: string; class_name: string; academic_year: string; level_name: string; subjects: { subject_name: string; score: number | null; final_grade: number; passing_grade: number; passed: boolean }[] }

export default function App() {
  if (window.location.pathname.replace(/\/$/, '').endsWith('/admin')) return <Admin />
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<StudentResult | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])\n  const [site, setSite] = useState<PublicSettings>({school_name:'ألحان تي اتشرومبي',tagline:'بوابة المدرسة الإلكترونية',hero_title:'كل خطوة في رحلة التعلّم تهمّنا',hero_description:'{site.hero_description}',logo_url:'',about_text:'{site.about_text}'})

  useEffect(() => {
    if (!supabase) return
    supabase.from('announcements').select('id,title,body,created_at').eq('is_published', true).order('created_at', { ascending: false }).limit(6)
      .then(({ data }) => setAnnouncements((data || []) as Announcement[]))
  }, [])

  async function searchResult(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setResult(null)
    if (!code.trim()) { setMessage('اكتب كود الطالب الأول.'); return }
    if (!supabase) { setMessage('الموقع في مرحلة التجهيز، وسيتم تفعيل البحث بعد ربط قاعدة البيانات.'); return }
    setLoading(true)
    const { data, error } = await supabase.rpc('lookup_published_result', { student_code_input: code.trim() })
    setLoading(false)
    if (error) { setMessage('حصلت مشكلة أثناء البحث. حاول مرة تانية أو تواصل مع إدارة المدرسة.'); return }
    if (!data) { setMessage('لم يتم العثور على نتيجة منشورة بهذا الكود.'); return }
    setResult(data as StudentResult)
  }

  return (
    <main>
      <nav className="nav container">
        <a className="brand" href="#"><span className="brand-mark">{site.logo_url ? <img src={site.logo_url} alt="" /> : <Music2 size={23}/>}</span><span>{site.school_name}<small>{site.tagline}</small></span></a>
        <a className="nav-link" href="#about">عن المدرسة</a>
        <a className="nav-link" href={`${import.meta.env.BASE_URL}admin`}>لوحة الإدارة</a>
      </nav>

      <section className="hero">
        <div className="hero-glow glow-one"/><div className="hero-glow glow-two"/>
        <div className="container hero-content">
          <div className="eyebrow"><Sparkles size={15}/> بوابتكم التعليمية</div>
          <h1>{site.hero_title.split(" ").slice(0,3).join(" ")}<br/><span>{site.hero_title.split(" ").slice(3).join(" ")}</span></h1>
          <p className="hero-copy">أهلاً بكم في الموقع الإلكتروني لمدرسة ألحان تي اتشرومبي، المكان المخصص لمتابعة النتائج ومعرفة آخر إعلانات المدرسة.</p>
          <a className="hero-cta" href="#results">تعرف على النتائج <ArrowLeft size={18}/></a>
          <div className="hero-stats"><div><strong>تعليم</strong><span>بمحبة واهتمام</span></div><i/><div><strong>متابعة</strong><span>مستمرة للطلاب</span></div><i/><div><strong>تواصل</strong><span>بكل سهولة</span></div></div>
        </div>
        <div className="hero-decoration"><div className="note note-a">♪</div><div className="note note-b">♫</div><div className="orbit orbit-a"/><div className="orbit orbit-b"/><div className="hero-emblem"><GraduationCap size={78}/><span>ALHAN</span></div></div>
      </section>

      <section className="container content-grid" id="results">
        <div className="section-intro"><div className="section-icon"><GraduationCap size={22}/></div><div><span className="kicker">بوابة الطالب</span><h2>استعلم عن نتيجتك</h2><p>اكتب كود الطالب الخاص بك لعرض النتيجة المعتمدة.</p></div></div>
        <div className="search-card">
          <div className="card-top"><div><span className="kicker">نتائج الطلاب</span><h3>بحث سريع عن النتيجة</h3></div><div className="card-icon"><Search size={23}/></div></div>
          <form onSubmit={searchResult}>
            <label htmlFor="student-code">كود الطالب</label>
            <div className="input-wrap"><Search size={19}/><input id="student-code" value={code} onChange={e=>setCode(e.target.value)} placeholder="اكتب كود الطالب هنا" autoComplete="off"/></div>
            <button className="primary-btn" disabled={loading}>{loading ? 'جاري البحث...' : 'عرض النتيجة'} <ArrowLeft size={18}/></button>
          </form>
          {message && <p className="notice" role="status">{message}</p>}
          {result && <div className="result-preview">
            <div className="result-student"><ShieldCheck/><div><strong>{result.student_name}</strong><small>{result.level_name} · {result.academic_year} · {result.class_name}</small></div></div>
            <div className="result-subjects">{result.subjects.map((subject, index) => <div className="result-subject" key={index}><span>{subject.subject_name}</span><strong>{subject.score ?? '—'} / {subject.final_grade}</strong><small>{subject.score === null ? 'لم تُسجل الدرجة' : subject.passed ? 'ناجح' : 'لم يحقق درجة النجاح'}</small></div>)}</div>
            <div className="result-total"><span>مجموع الدرجات المنشورة</span><strong>{result.subjects.reduce((sum, subject) => sum + (Number(subject.score) || 0), 0)}</strong></div>
          </div>}
          <div className="privacy"><ShieldCheck size={15}/> تظهر فقط النتائج التي اعتمدتها إدارة المدرسة.</div>
        </div>
      </section>

      <section className="announcements">
        <div className="container announcement-inner"><div className="section-intro"><div className="section-icon"><Bell size={21}/></div><div><span className="kicker">ابقَ على اطلاع</span><h2>إعلانات المدرسة</h2><p>هنا هتظهر آخر الأخبار والتنبيهات المهمة.</p></div></div>
          <div className="announcement-card">{announcements.length ? announcements.map(a=><article key={a.id}><span>{new Date(a.created_at).toLocaleDateString('ar-EG')}</span><h3>{a.title}</h3><p>{a.body}</p></article>) : <div className="empty-announcements"><Bell size={25}/><span>لا توجد إعلانات حاليًا</span><small>تابع الصفحة لمعرفة كل جديد.</small></div>}</div>
        </div>
      </section>

      <section className="container about" id="about"><div className="about-icon"><BookOpen size={27}/></div><div><span className="kicker">مدرستنا</span><h2>{site.school_name}</h2><p>نسعى إلى توفير تجربة تعليمية منظمة، تجمع بين الاهتمام بالطالب وسهولة التواصل ومتابعة المستوى الدراسي.</p></div></section>
      <footer><div className="container footer-inner"><span>© {new Date().getFullYear()} مدرسة ألحان تي اتشرومبي</span><span>بوابة المدرسة الإلكترونية</span></div></footer>
    </main>
  )
}