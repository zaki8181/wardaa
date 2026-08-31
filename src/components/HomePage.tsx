import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { BRANCHES, BRANCH_META, ROLE_META, ROLES } from '@/lib/constants';
import type { Profile, VoteReport, BranchKey, ReportType } from '@/lib/types';
import {
  Users, Vote, BarChart3, Flower2,
  Loader2, Send, AlertCircle, CheckCircle2, ClipboardList, XCircle,
} from 'lucide-react';

export default function HomePage() {
  const { profile } = useAuth();
  if (!profile) return null;
  return profile.role === 'مراقب القسم' ? <ReportForm profile={profile} /> : <StatsDashboard profile={profile} />;
}

function StatsDashboard({ profile }: { profile: Profile }) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [voterStats, setVoterStats] = useState<{ branch: BranchKey; total: number; sympathizers: number }[]>([]);
  const [reportStats, setReportStats] = useState<{ totalVoters: number; totalReg: number; wardaVotes: number; cancelled: number }>({ totalVoters: 0, totalReg: 0, wardaVotes: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [usersRes, ...rest] = await Promise.all([
        supabase.from('profiles').select('*'),
        ...BRANCHES.flatMap(b => [
          supabase.from('voters').select('*', { count: 'exact', head: true }).eq('branch', b),
          supabase.from('voters').select('*', { count: 'exact', head: true }).eq('branch', b).eq('type', 'متعاطف'),
        ]),
        supabase.from('vote_reports').select('*').order('submitted_at', { ascending: false }),
      ]);
      const voterCounts = rest.slice(0, BRANCHES.length * 2);
      const reportsRes = rest[rest.length - 1];

      setUsers((usersRes.data ?? []) as Profile[]);

      const branches = BRANCHES.map((b, i) => {
        const total = voterCounts[i * 2]?.count ?? 0;
        const sympathizers = voterCounts[i * 2 + 1]?.count ?? 0;
        return { branch: b, total, sympathizers };
      });
      setVoterStats(branches);

      const reports = (reportsRes.data ?? []) as VoteReport[];

      // Latest voters_count per section (report_type = 'voters_count')
      const latestVc = new Map<string, number>();
      for (const r of reports) {
        if (r.report_type !== 'voters_count') continue;
        const key = `${r.branch}:${r.section}`;
        if (!latestVc.has(key) && r.voters_count !== null) latestVc.set(key, r.voters_count);
      }

      // Latest details per section (report_type = 'details')
      const latestDetails = new Map<string, VoteReport>();
      for (const r of reports) {
        if (r.report_type !== 'details') continue;
        const key = `${r.branch}:${r.section}`;
        if (!latestDetails.has(key)) latestDetails.set(key, r);
      }

      let tv = 0, tr = 0, wv = 0, cv = 0;
      for (const [key, vc] of latestVc) { tv += vc; }
      for (const r of latestDetails.values()) {
        tr += r.total_registered ?? 0;
        wv += r.warda_votes ?? 0;
        cv += r.cancelled_votes ?? 0;
      }
      setReportStats({ totalVoters: tv, totalReg: tr, wardaVotes: wv, cancelled: cv });

      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>;

  const roleCounts: Record<string, number> = {};
  for (const r of ROLES) roleCounts[r] = 0;
  for (const u of users) roleCounts[u.role] = (roleCounts[u.role] ?? 0) + 1;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="المستخدمون" value={users.length} icon={<Users className="w-5 h-5" />} accent="brand" />
        <StatCard label="عدد المصوتين" value={reportStats.totalVoters} icon={<Vote className="w-5 h-5" />} accent="emerald" />
        <StatCard label="العدد الكلي للناخبين" value={reportStats.totalReg} icon={<BarChart3 className="w-5 h-5" />} accent="blue" />
        <StatCard label="أصوات وردة" value={reportStats.wardaVotes} icon={<Flower2 className="w-5 h-5" />} accent="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-base font-bold text-gray-900 mb-4">المستخدمون حسب الدور</h3>
          <div className="space-y-3">
            {ROLES.map(r => {
              const meta = ROLE_META[r];
              return (
                <div key={r} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: meta.color }} />
                    <span className="text-sm text-gray-700">{r}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{roleCounts[r]}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-base font-bold text-gray-900 mb-4">الناخبون حسب الفرع</h3>
          <div className="space-y-4">
            {voterStats.map(vs => {
              const meta = BRANCH_META[vs.branch];
              return (
                <div key={vs.branch} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: meta.color }} />
                    <span className="text-sm text-gray-700">{meta.label}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    <span className="font-bold text-gray-900">{vs.total}</span> ناخب
                    <span className="text-gray-400 mr-2"> · {vs.sympathizers} متعاطف</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportForm({ profile }: { profile: Profile }) {
  // Group A: voters_count (standalone)
  const [votersCount, setVotersCount] = useState('');
  const [savingA, setSavingA] = useState(false);
  const [msgA, setMsgA] = useState<{ text: string; ok: boolean } | null>(null);

  // Group B: details (total_registered, warda_votes, cancelled_votes)
  const [totalReg, setTotalReg] = useState('');
  const [wardaVotes, setWardaVotes] = useState('');
  const [cancelledVotes, setCancelledVotes] = useState('');
  const [savingB, setSavingB] = useState(false);
  const [msgB, setMsgB] = useState<{ text: string; ok: boolean } | null>(null);

  const [latestA, setLatestA] = useState<VoteReport | null>(null);
  const [latestB, setLatestB] = useState<VoteReport | null>(null);
  const [totalRegRef, setTotalRegRef] = useState<number | null>(null);

  const loadLatest = useCallback(async () => {
    const { data } = await supabase
      .from('vote_reports')
      .select('*')
      .eq('submitted_by', profile.id)
      .order('submitted_at', { ascending: false });
    const reports = (data ?? []) as VoteReport[];
    setLatestA(reports.find(r => r.report_type === 'voters_count') ?? null);
    const bReport = reports.find(r => r.report_type === 'details');
    setLatestB(bReport ?? null);
    if (bReport?.total_registered !== null && bReport?.total_registered !== undefined) {
      setTotalRegRef(bReport.total_registered);
    }
  }, [profile.id]);

  useEffect(() => { loadLatest(); }, [loadLatest]);

  const submitA = async () => {
    setMsgA(null);
    const vc = parseInt(votersCount);
    if (isNaN(vc)) { setMsgA({ text: 'أدخل رقمًا صحيحًا.', ok: false }); return; }
    if (vc < 0) { setMsgA({ text: 'لا يمكن إدخال أرقام سالبة.', ok: false }); return; }
    if (totalRegRef !== null && vc > totalRegRef) { setMsgA({ text: 'عدد المصوتين لا يمكن أن يتجاوز العدد الكلي للناخبين.', ok: false }); return; }

    setSavingA(true);
    const { error } = await supabase.from('vote_reports').insert({
      section: profile.section || '',
      branch: profile.branch || 'حي محمدي',
      report_type: 'voters_count' as ReportType,
      voters_count: vc,
      total_registered: null,
      warda_votes: null,
      cancelled_votes: 0,
    });
    setSavingA(false);
    if (error) { setMsgA({ text: 'تعذّر إرسال التقرير.', ok: false }); return; }
    setMsgA({ text: 'تم إرسال عدد المصوتين بنجاح.', ok: true });
    setVotersCount('');
    loadLatest();
  };

  const submitB = async () => {
    setMsgB(null);
    const tr = parseInt(totalReg);
    const wv = parseInt(wardaVotes);
    const cv = parseInt(cancelledVotes);
    if (isNaN(tr) || isNaN(wv) || isNaN(cv)) { setMsgB({ text: 'أدخل أرقامًا صحيحة في جميع الحقول.', ok: false }); return; }
    if (tr < 0 || wv < 0 || cv < 0) { setMsgB({ text: 'لا يمكن إدخال أرقام سالبة.', ok: false }); return; }

    setSavingB(true);
    const { error } = await supabase.from('vote_reports').insert({
      section: profile.section || '',
      branch: profile.branch || 'حي محمدي',
      report_type: 'details' as ReportType,
      voters_count: null,
      total_registered: tr,
      warda_votes: wv,
      cancelled_votes: cv,
    });
    setSavingB(false);
    if (error) { setMsgB({ text: 'تعذّر إرسال التقرير.', ok: false }); return; }
    setMsgB({ text: 'تم إرسال التفاصيل بنجاح.', ok: true });
    setTotalReg(''); setWardaVotes(''); setCancelledVotes('');
    setTotalRegRef(tr);
    loadLatest();
  };

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in-up">
      {/* Group A: عدد المصوتين (standalone) */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center"><Vote className="w-6 h-6 text-emerald-600" /></div>
          <div><h3 className="font-bold text-gray-900">عدد المصوتين</h3><p className="text-xs text-gray-400">أرسل هذا الرقم بشكل مستقل</p></div>
        </div>
        <div className="space-y-4">
          <NumField label="عدد المصوتين" value={votersCount} onChange={setVotersCount} />
          {msgA && (
            <div className={`flex items-center gap-2 text-sm rounded-xl p-3 ${msgA.ok ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
              {msgA.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{msgA.text}
            </div>
          )}
          <button onClick={submitA} disabled={savingA}
            className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 transition-all">
            {savingA ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {savingA ? 'جارٍ الإرسال...' : 'إرسال'}
          </button>
        </div>
        {latestA && latestA.voters_count !== null && (
          <div className="mt-4 pt-4 border-t border-gray-50 text-center">
            <p className="text-xs text-gray-400 mb-1">آخر إرسال</p>
            <p className="text-2xl font-bold text-gray-900">{latestA.voters_count}</p>
            <p className="text-xs text-gray-400 mt-1">{new Date(latestA.submitted_at).toLocaleString('ar-MA')}</p>
          </div>
        )}
      </div>

      {/* Group B: details (3 fields, one send button) */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-brand-100 flex items-center justify-center"><ClipboardList className="w-6 h-6 text-brand-600" /></div>
          <div><h3 className="font-bold text-gray-900">تفاصيل التصويت</h3><p className="text-xs text-gray-400">أرسل الأرقام الثلاثة معًا</p></div>
        </div>
        <div className="space-y-4">
          <NumField label="العدد الكلي للناخبين" value={totalReg} onChange={setTotalReg} />
          <NumField label="عدد أصوات وردة" value={wardaVotes} onChange={setWardaVotes} />
          <NumField label="عدد الأصوات الملغاة" value={cancelledVotes} onChange={setCancelledVotes} />
          {msgB && (
            <div className={`flex items-center gap-2 text-sm rounded-xl p-3 ${msgB.ok ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
              {msgB.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{msgB.text}
            </div>
          )}
          <button onClick={submitB} disabled={savingB}
            className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 transition-all">
            {savingB ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {savingB ? 'جارٍ الإرسال...' : 'إرسال التفاصيل'}
          </button>
        </div>
        {latestB && (
          <div className="mt-4 pt-4 border-t border-gray-50 grid grid-cols-3 gap-2 text-center">
            <div><p className="text-lg font-bold text-gray-900">{latestB.total_registered ?? '—'}</p><p className="text-xs text-gray-400">الناخبون</p></div>
            <div><p className="text-lg font-bold text-brand-600">{latestB.warda_votes ?? '—'}</p><p className="text-xs text-gray-400">وردة</p></div>
            <div><p className="text-lg font-bold text-gray-500">{latestB.cancelled_votes}</p><p className="text-xs text-gray-400">ملغاة</p></div>
            <p className="col-span-3 text-xs text-gray-400 mt-1">{new Date(latestB.submitted_at).toLocaleString('ar-MA')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      <input type="number" min="0" dir="ltr" value={value} onChange={e => onChange(e.target.value)} placeholder="0"
        className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-gray-900 text-left outline-none transition-all focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100" />
    </div>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: number | string; icon: React.ReactNode; accent: string }) {
  const cls: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    rose: 'bg-rose-50 text-rose-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div><p className="text-sm text-gray-400 mb-1">{label}</p><p className="text-2xl font-bold text-gray-900">{value}</p></div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${cls[accent] || cls.brand}`}>{icon}</div>
      </div>
    </div>
  );
}
