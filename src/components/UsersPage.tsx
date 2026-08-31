import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase, callEdgeFunction } from '@/lib/supabase';
import { ROLES, ROLE_META, CREATABLE_ROLES, BRANCHES } from '@/lib/constants';
import type { Profile, RoleKey, BranchKey } from '@/lib/types';
import {
  Plus, Search, X, Loader2, AlertCircle, Trash2, MoreVertical,
  Mail, Phone, Building2, CheckCircle2, UserPlus,
} from 'lucide-react';

export default function UsersPage() {
  const { profile, session } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleKey | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Profile | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setUsers((data ?? []) as Profile[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { const h = () => setMenuOpen(null); window.addEventListener('click', h); return () => window.removeEventListener('click', h); }, []);

  const filtered = useMemo(() => users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return u.full_name.toLowerCase().includes(q) || (u.phone_number ?? '').includes(q) || (u.email ?? '').toLowerCase().includes(q);
    }
    return true;
  }), [users, roleFilter, search]);

  const handleDelete = async () => {
    if (!deleting || !session) return;
    const { error } = await callEdgeFunction('manage-user', { action: 'delete', user_id: deleting.id }, session);
    if (error) { showToast(error, false); } else { showToast('تم حذف المستخدم'); }
    setDeleting(null);
    load();
  };

  if (!profile) return null;
  const creatableRoles = CREATABLE_ROLES[profile.role];

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الرقم..."
            className="w-full rounded-xl border border-gray-200 bg-white pr-11 pl-10 py-3 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100" />
          {search && <button onClick={() => setSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as RoleKey | 'all')}
          className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100">
          <option value="all">كل الأدوار</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {creatableRoles.length > 0 && (
          <button onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700 active:scale-[0.98] transition-all">
            <Plus className="w-4 h-4" /> إضافة مستخدم
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <UserPlus className="w-10 h-10 text-brand-400 mx-auto mb-3" />
          <p className="font-bold text-gray-800">{search ? 'لا توجد نتائج' : 'لا يوجد مستخدمون'}</p>
          <p className="text-sm text-gray-400 mt-1">{search ? 'جرّب تعديل البحث' : 'أضف أول مستخدم'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 border-b border-gray-100">
                  <th className="text-right p-4 font-semibold">المستخدم</th>
                  <th className="text-right p-4 font-semibold hidden md:table-cell">الدور</th>
                  <th className="text-right p-4 font-semibold hidden lg:table-cell">الفرع</th>
                  <th className="text-right p-4 font-semibold hidden sm:table-cell">الهاتف</th>
                  <th className="p-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(u => {
                  const meta = ROLE_META[u.role];
                  return (
                    <tr key={u.id} className="hover:bg-gray-50/40 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{ backgroundColor: meta.color }}>
                            {u.full_name[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 truncate">{u.full_name}</p>
                            {u.email && <p className="text-xs text-gray-400 truncate" dir="ltr">{u.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.bg} ${meta.text} ${meta.border}`}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />{u.role}
                        </span>
                      </td>
                      <td className="p-4 hidden lg:table-cell text-gray-600 text-sm">{u.branch || '—'}</td>
                      <td className="p-4 hidden sm:table-cell text-gray-600 text-sm" dir="ltr">{u.phone_number || '—'}</td>
                      <td className="p-4 relative">
                        {profile.role === 'مشرف العام' && u.id !== profile.id && (
                          <>
                            <button onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === u.id ? null : u.id); }}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {menuOpen === u.id && (
                              <div className="absolute left-4 top-12 z-10 w-36 bg-white rounded-xl shadow-xl border border-gray-100 py-1 animate-scale-in" onClick={e => e.stopPropagation()}>
                                <button onClick={() => { setDeleting(u); setMenuOpen(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                                  <Trash2 className="w-4 h-4" /> حذف
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {formOpen && <CreateUserModal profile={profile} session={session!} onClose={() => setFormOpen(false)} onCreated={() => { setFormOpen(false); load(); showToast('تم إنشاء المستخدم'); }} />}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setDeleting(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 animate-scale-in text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-4"><Trash2 className="w-7 h-7 text-red-600" /></div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">حذف «{deleting.full_name}»؟</h3>
            <p className="text-sm text-gray-500 mb-6">سيتم حذف الحساب نهائيًا.</p>
            <div className="flex gap-3">
              <button onClick={handleDelete} className="flex-1 rounded-xl bg-red-600 py-2.5 font-semibold text-white hover:bg-red-700">حذف</button>
              <button onClick={() => setDeleting(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 font-semibold text-gray-600 hover:bg-gray-50">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
          <div className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium shadow-xl ${toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.ok ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}{toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}

function CreateUserModal({ profile, session, onClose, onCreated }: {
  profile: Profile; session: { access_token: string }; onClose: () => void; onCreated: () => void;
}) {
  const creatableRoles = CREATABLE_ROLES[profile.role];
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: creatableRoles[0] || 'مراقب القسم', branch: profile.branch || BRANCHES[0], section: '', phone_number: '', prefecture: '', region: '', party_duty: '', school: '', voter_number: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSection = form.role === 'مراقب القسم';

  const submit = async () => {
    setError(null);
    if (!form.email.trim() || !form.password || !form.full_name.trim()) { setError('الاسم والبريد وكلمة المرور مطلوبة.'); return; }
    if (form.password.length < 6) { setError('كلمة المرور: 6 أحرف على الأقل.'); return; }
    setSaving(true);
    const { error: e } = await callEdgeFunction('manage-user', { action: 'create', ...form }, session);
    setSaving(false);
    if (e) { setError(e); return; }
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div><h3 className="text-xl font-bold text-gray-900">إضافة مستخدم</h3><p className="text-sm text-gray-500 mt-0.5">أدخل بيانات المستخدم الجديد</p></div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Inp label="الاسم الكامل" value={form.full_name} onChange={v => setForm({ ...form, full_name: v })} />
            <Inp label="البريد الإلكتروني" value={form.email} onChange={v => setForm({ ...form, email: v })} type="email" dir="ltr" />
          </div>
          <Inp label="كلمة المرور" value={form.password} onChange={v => setForm({ ...form, password: v })} type="password" dir="ltr" />

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">الدور</label>
            <div className="flex flex-wrap gap-2">
              {creatableRoles.map(r => {
                const meta = ROLE_META[r];
                return (
                  <button key={r} type="button" onClick={() => setForm({ ...form, role: r })}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${form.role === r ? `${meta.bg} ${meta.text} ${meta.border} ring-2 ring-offset-1 ring-current` : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {r}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">الفرع</label>
              <select value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value as BranchKey })}
                className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100">
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            {isSection && <Inp label="القسم" value={form.section} onChange={v => setForm({ ...form, section: v })} />}
          </div>

          {!isSection ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Inp label="رقم الهاتف" value={form.phone_number} onChange={v => setForm({ ...form, phone_number: v })} dir="ltr" />
              <Inp label="عمالة" value={form.prefecture} onChange={v => setForm({ ...form, prefecture: v })} />
              <Inp label="اقليم" value={form.region} onChange={v => setForm({ ...form, region: v })} />
              <Inp label="المهمة الحزبية" value={form.party_duty} onChange={v => setForm({ ...form, party_duty: v })} />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Inp label="المدرسة" value={form.school} onChange={v => setForm({ ...form, school: v })} />
              <Inp label="رقم الناخب" value={form.voter_number} onChange={v => setForm({ ...form, voter_number: v })} dir="ltr" />
            </div>
          )}

          {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button onClick={submit} disabled={saving}
              className="flex-1 rounded-xl bg-brand-600 py-3 font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 transition-all">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              {saving ? 'جارٍ الإنشاء...' : 'إنشاء المستخدم'}
            </button>
            <button onClick={onClose} className="rounded-xl border border-gray-200 px-6 py-3 font-semibold text-gray-600 hover:bg-gray-50">إلغاء</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Inp({ label, value, onChange, type = 'text', dir }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; dir?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      <input type={type} dir={dir} value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-900 outline-none transition-all focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100" />
    </div>
  );
}
