import { useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth';
import { Flower2, Lock, Mail, Eye, EyeOff, AlertCircle, Loader2, ArrowLeft, User } from 'lucide-react';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'setup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email.trim() || !password) { setError('أدخل البريد وكلمة المرور.'); return; }
    if (password.length < 6) { setError('كلمة المرور: 6 أحرف على الأقل.'); return; }
    if (mode === 'setup' && !fullName.trim()) { setError('أدخل اسمك الكامل.'); return; }

    setLoading(true);
    if (mode === 'signin') {
      const { error } = await signIn(email.trim(), password);
      setLoading(false);
      if (error) setError(error);
    } else {
      const { error } = await signUp(email.trim(), password, fullName.trim());
      setLoading(false);
      if (error) { setError(error); return; }
      setInfo('تم إنشاء الحساب. يمكنك الدخول الآن.');
      setMode('signin');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      <div className="relative lg:w-1/2 min-h-[260px] lg:min-h-screen overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 2px, transparent 2px), radial-gradient(circle at 80% 70%, white 1.5px, transparent 1.5px)', backgroundSize: '60px 60px, 40px 40px' }} />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-400/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-16 w-[28rem] h-[28rem] bg-brand-300/20 rounded-full blur-3xl" />
        <div className="relative h-full flex flex-col justify-between p-8 lg:p-14 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Flower2 className="w-7 h-7" />
            </div>
            <div><h1 className="text-2xl font-bold">وردة ديجيتال</h1><p className="text-brand-100 text-sm">منصة مراقبة الانتخابات</p></div>
          </div>
          <div className="hidden lg:block animate-fade-in-up">
            <h2 className="text-4xl font-bold leading-tight mb-4">نظام متكامل<br />لمراقبة الانتخابات</h2>
            <p className="text-brand-100/90 text-lg leading-relaxed max-w-md">تتبّع المصوّتين عبر فروعك الثلاثة، واستلم النتائج الحية من المراقبين الميدانيين لحظة بلحظة.</p>
            <div className="mt-10 flex items-center gap-6 text-sm text-brand-100/80">
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-white/70" /> إدارة الأدوار</div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-white/70" /> نتائج حية</div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-white/70" /> 3 فروع</div>
            </div>
          </div>
          <p className="text-brand-100/60 text-xs">© 2026 وردة ديجيتال</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-11 h-11 rounded-2xl bg-brand-600 flex items-center justify-center text-white"><Flower2 className="w-6 h-6" /></div>
            <h1 className="text-xl font-bold text-gray-900">وردة ديجيتال</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">{mode === 'signin' ? 'تسجيل الدخول' : 'إعداد المشرف العام'}</h2>
            <p className="text-gray-500">{mode === 'signin' ? 'أدخل بياناتك للوصول إلى لوحة التحكّم' : 'أنشئ حساب المشرف العام الأول للبدء'}</p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 animate-scale-in">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /><p className="text-sm">{error}</p>
            </div>
          )}
          {info && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700 animate-scale-in">
              <div className="w-5 h-5 flex-shrink-0 mt-0.5 flex items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold">!</div>
              <p className="text-sm">{info}</p>
            </div>
          )}

          <form onSubmit={submit} className="space-y-5">
            {mode === 'setup' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">الاسم الكامل</label>
                <div className="relative">
                  <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="مثال: أحمد محمد" className="w-full rounded-xl border border-gray-200 bg-gray-50/50 pr-11 pl-4 py-3.5 text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" className="w-full rounded-xl border border-gray-200 bg-gray-50/50 pr-11 pl-4 py-3.5 text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100" autoComplete="email" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type={showPw ? 'text' : 'password'} dir="ltr" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-xl border border-gray-200 bg-gray-50/50 pr-11 pl-11 py-3.5 text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
                <button type="button" onClick={() => setShowPw(s => !s)} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full rounded-xl bg-brand-600 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/20 transition-all hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" />جارٍ المعالجة...</> : <>{mode === 'signin' ? 'دخول' : 'إنشاء الحساب'}<ArrowLeft className="w-5 h-5" /></>}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-gray-500">
            {mode === 'signin' ? (
              <>أول مرة؟{' '}<button onClick={() => { setMode('setup'); setError(null); }} className="font-semibold text-brand-600 hover:text-brand-700">إنشاء حساب المشرف العام</button></>
            ) : (
              <>لديك حساب؟{' '}<button onClick={() => { setMode('signin'); setError(null); }} className="font-semibold text-brand-600 hover:text-brand-700">تسجيل الدخول</button></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
