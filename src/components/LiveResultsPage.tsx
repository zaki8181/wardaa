import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { BRANCHES, BRANCH_META } from '@/lib/constants';
import type { VoteReport, BranchKey, Profile } from '@/lib/types';
import { BarChart3, Loader2, Flower2, Users, RefreshCw, XCircle } from 'lucide-react';

type SectionAgg = {
  branch: BranchKey;
  section: string;
  voters_count: number | null;
  total_registered: number | null;
  warda_votes: number | null;
  cancelled_votes: number;
  latest_vc_at: string;
  latest_details_at: string;
  submitter_name?: string;
};

export default function LiveResultsPage() {
  const { profile } = useAuth();
  const [reports, setReports] = useState<VoteReport[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    const [rRes, pRes] = await Promise.all([
      supabase.from('vote_reports').select('*').order('submitted_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, role'),
    ]);
    setReports((rRes.data ?? []) as VoteReport[]);
    setProfiles((pRes.data ?? []) as Profile[]);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const channel = supabase.channel('vote_reports_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vote_reports' }, () => { load(true); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const nameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.id, p.full_name);
    return m;
  }, [profiles]);

  // Build per-section aggregation: latest voters_count + latest details independently
  const sectionAggs = useMemo(() => {
    const map = new Map<string, SectionAgg>();

    for (const r of reports) {
      const key = `${r.branch}:${r.section}`;
      if (!map.has(key)) {
        map.set(key, {
          branch: r.branch,
          section: r.section,
          voters_count: null,
          total_registered: null,
          warda_votes: null,
          cancelled_votes: 0,
          latest_vc_at: '',
          latest_details_at: '',
          submitter_name: nameMap.get(r.submitted_by) || '—',
        });
      }
      const agg = map.get(key)!;

      if (r.report_type === 'voters_count' && !agg.latest_vc_at) {
        agg.voters_count = r.voters_count;
        agg.latest_vc_at = r.submitted_at;
      }
      if (r.report_type === 'details' && !agg.latest_details_at) {
        agg.total_registered = r.total_registered;
        agg.warda_votes = r.warda_votes;
        agg.cancelled_votes = r.cancelled_votes;
        agg.latest_details_at = r.submitted_at;
      }
    }

    return Array.from(map.values());
  }, [reports, nameMap]);

  const branchData = useMemo(() => {
    return BRANCHES.map(b => {
      const sections = sectionAggs.filter(s => s.branch === b);
      let tv = 0, tr = 0, wv = 0, cv = 0;
      for (const s of sections) {
        if (s.voters_count !== null) tv += s.voters_count;
        if (s.total_registered !== null) tr += s.total_registered;
        if (s.warda_votes !== null) wv += s.warda_votes;
        cv += s.cancelled_votes;
      }
      return { branch: b, sections, voters_count: tv, total_registered: tr, warda_votes: wv, cancelled_votes: cv };
    });
  }, [sectionAggs]);

  const grand = useMemo(() => {
    let tv = 0, tr = 0, wv = 0, cv = 0;
    for (const b of branchData) { tv += b.voters_count; tr += b.total_registered; wv += b.warda_votes; cv += b.cancelled_votes; }
    return { voters_count: tv, total_registered: tr, warda_votes: wv, cancelled_votes: cv };
  }, [branchData]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Grand totals — raw numbers only */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <BigStat label="عدد المصوتين" value={grand.voters_count} icon={<Users className="w-5 h-5" />} accent="blue" />
        <BigStat label="العدد الكلي للناخبين" value={grand.total_registered} icon={<BarChart3 className="w-5 h-5" />} accent="gray" />
        <BigStat label="أصوات وردة" value={grand.warda_votes} icon={<Flower2 className="w-5 h-5" />} accent="rose" />
        <BigStat label="أصوات ملغاة" value={grand.cancelled_votes} icon={<XCircle className="w-5 h-5" />} accent="amber" />
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">التفاصيل حسب الفرع</h3>
        <button onClick={() => load(true)} disabled={refreshing}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-brand-600 transition-colors">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> تحديث
        </button>
      </div>

      {branchData.map(bd => {
        const meta = BRANCH_META[bd.branch];
        return (
          <div key={bd.branch} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: meta.color }} />
                  <h4 className="font-bold text-gray-900">{meta.label}</h4>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-500">المصوتين: <b className="text-gray-900">{bd.voters_count}</b></span>
                  <span className="text-gray-500">الناخبين: <b className="text-gray-900">{bd.total_registered}</b></span>
                  <span className="text-brand-600 font-bold">وردة: {bd.warda_votes}</span>
                  <span className="text-gray-400">ملغاة: {bd.cancelled_votes}</span>
                </div>
              </div>
            </div>

            {bd.sections.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/60 text-gray-500 text-xs">
                      <th className="text-right p-3 font-semibold">القسم</th>
                      <th className="text-right p-3 font-semibold">المراقب</th>
                      <th className="text-right p-3 font-semibold">المصوتين</th>
                      <th className="text-right p-3 font-semibold">الناخبين</th>
                      <th className="text-right p-3 font-semibold">وردة</th>
                      <th className="text-right p-3 font-semibold">ملغاة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {bd.sections.map((s, i) => (
                      <tr key={i} className="hover:bg-gray-50/40">
                        <td className="p-3 font-medium text-gray-800">{s.section}</td>
                        <td className="p-3 text-gray-600">{s.submitter_name}</td>
                        <td className="p-3 font-bold text-gray-900">{s.voters_count ?? '—'}</td>
                        <td className="p-3 text-gray-600">{s.total_registered ?? '—'}</td>
                        <td className="p-3 font-bold text-brand-600">{s.warda_votes ?? '—'}</td>
                        <td className="p-3 text-gray-500">{s.cancelled_votes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-5 text-sm text-gray-400 text-center">لا توجد تقارير بعد</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BigStat({ label, value, icon, accent }: { label: string; value: number | string; icon: React.ReactNode; accent: string }) {
  const cls: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    gray: 'bg-gray-100 text-gray-500',
    rose: 'bg-rose-50 text-rose-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div><p className="text-sm text-gray-400 mb-1">{label}</p><p className="text-2xl font-bold text-gray-900">{value}</p></div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${cls[accent]}`}>{icon}</div>
      </div>
    </div>
  );
}
