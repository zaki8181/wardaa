import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { ROLE_META } from '@/lib/constants';
import { User, Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({
    full_name: '', phone_number: '', prefecture: '', region: '', party_duty: '',
    school: '', voter_number: '', section: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        phone_number: profile.phone_number || '',
        prefecture: profile.prefecture || '',
        region: profile.region || '',
        party_duty: profile.party_duty || '',
        school: profile.school || '',
        voter_number: profile.voter_number || '',
        section: profile.section || '',
      });
    }
  }, [profile]);

  if (!profile) return null;

  const isSection = profile.role === 'مراقب القسم';
  const meta = ROLE_META[profile.role];

  const save = async () => {
    setMsg(null);
    if (!form.full_name.trim()) { setMsg({ text: 'الاسم مطلوب.', ok: false }); return; }
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name: form.full_name.trim(),
      phone_number: form.phone_number || null,
      prefecture: form.prefecture || null,
      region: form.region || null,
      party_duty: form.party_duty || null,
      school: form.school || null,
      voter_number: form.voter_number || null,
      section: form.section || null,
    }).eq('id', profile.id);
    setSaving(false);
    if (error) { setMsg({ text: 'تعذّر الحفظ.', ok: false }); return; }
    setMsg({ text: 'تم حفظ التعديلات.', ok: true });
    refreshProfile();
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div className="max-w-lg mx-auto animate-fade-in-up">
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-center text-white">
          <div className="w-16 h-16 mx-auto rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold mb-3">
            {profile.full_name[0] || '؟'}
          </div>
          <h3 className="text-xl font-bold">{profile.full_name || 'المستخدم'}</h3>
          <span className={`inline-flex items-center gap-1.5 mt-2 rounded-full px-3 py-1 text-xs font-medium bg-white/20 text-white`}>
            {profile.role}
          </span>
          {profile.branch && <p className="text-brand-100 text-sm mt-1">{profile.branch}</p>}
        </div>

        <div className="p-6 space-y-4">
          <Inp label="الاسم الكامل" value={form.full_name} onChange={v => setForm({ ...form, full_name: v })} />

          {!isSection ? (
            <>
              <Inp label="رقم الهاتف" value={form.phone_number} onChange={v => setForm({ ...form, phone_number: v })} dir="ltr" />
              <div className="grid grid-cols-2 gap-4">
                <Inp label="عمالة" value={form.prefecture} onChange={v => setForm({ ...form, prefecture: v })} />
                <Inp label="اقليم" value={form.region} onChange={v => setForm({ ...form, region: v })} />
              </div>
              <Inp label="المهمة الحزبية" value={form.party_duty} onChange={v => setForm({ ...form, party_duty: v })} />
            </>
          ) : (
            <>
              <Inp label="المدرسة" value={form.school} onChange={v => setForm({ ...form, school: v })} />
              <div className="grid grid-cols-2 gap-4">
                <Inp label="رقم الناخب" value={form.voter_number} onChange={v => setForm({ ...form, voter_number: v })} dir="ltr" />
                <Inp label="القسم" value={form.section} onChange={v => setForm({ ...form, section: v })} />
              </div>
            </>
          )}

          {msg && (
            <div className={`flex items-center gap-2 rounded-xl p-3 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {msg.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{msg.text}
            </div>
          )}

          <button onClick={save} disabled={saving}
            className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 transition-all">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
          </button>

          <div className="border-t border-gray-100 pt-4 text-xs text-gray-400 space-y-1">
            <p>الدور: {profile.role} (لا يمكن تغييره ذاتيًا)</p>
            {profile.branch && <p>الفرع: {profile.branch}</p>}
            <p>تاريخ الإنشاء: {new Date(profile.created_at).toLocaleDateString('ar-MA')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Inp({ label, value, onChange, dir }: { label: string; value: string; onChange: (v: string) => void; dir?: string }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      <input dir={dir} value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-900 outline-none transition-all focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100" />
    </div>
  );
}
