import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase, fetchAllPaginated } from '@/lib/supabase';
import { BRANCHES, BRANCH_META, canAddVoters, canViewAllBranches } from '@/lib/constants';
import { parseVoterExcel, generateVoterTemplate, type ParsedVoter } from '@/lib/excel';
import type { Voter, BranchKey, VoterType } from '@/lib/types';
import {
  Search, X, Plus, Upload, Download, Loader2, AlertCircle, CheckCircle2,
  Users, FileSpreadsheet, FileUp, AlertTriangle, ArrowRightLeft, ChevronRight, ChevronLeft,
} from 'lucide-react';

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 400;

export default function VotersPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [branch, setBranch] = useState<BranchKey>(profile?.branch as BranchKey || BRANCHES[0]);
  const [classTab, setClassTab] = useState<VoterType>('الناخبون');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Voter[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [branchCounts, setBranchCounts] = useState<Record<BranchKey, number>>({
    'حي محمدي': 0, 'عين السبع': 0, 'روش نوار': 0,
  });
  const [voterCount, setVoterCount] = useState(0);
  const [sympathizerCount, setSympathizerCount] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [exporting, setExporting] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const effectiveBranch: BranchKey = canViewAllBranches(profile?.role ?? 'مراقب القسم')
    ? branch
    : (profile?.branch as BranchKey) || branch;

  // Load the current page of rows + counts
  const loadPage = useCallback(async () => {
    setLoading(true);
    try {
      let baseQuery = supabase.from('voters').select('*', { count: 'exact' }).eq('branch', effectiveBranch).eq('type', classTab);
      const s = search.trim();
      if (s) {
        baseQuery = baseQuery.or(`full_name.ilike.%${s}%,national_id.ilike.%${s}%,voter_number.ilike.%${s}%`);
      }
      const from = page * PAGE_SIZE;
      const { data, count, error } = await baseQuery
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      setRows((data ?? []) as Voter[]);
      setTotalCount(count ?? 0);
    } catch {
      setRows([]);
      setTotalCount(0);
      showToast('تعذّر تحميل البيانات', false);
    }
    setLoading(false);
  }, [effectiveBranch, classTab, search, page]);

  // Load counts (branch tabs + classification tabs)
  const loadCounts = useCallback(async () => {
    if (!profile) return;
    try {
      const isAll = canViewAllBranches(profile.role);
      const branchToQuery: BranchKey[] = isAll ? BRANCHES : [(profile.branch as BranchKey) || effectiveBranch];

      // Branch totals
      const bCounts: Record<BranchKey, number> = { 'حي محمدي': 0, 'عين السبع': 0, 'روش نوار': 0 };
      await Promise.all(BRANCHES.map(async (b) => {
        if (!branchToQuery.includes(b)) return;
        const { count } = await supabase.from('voters').select('*', { count: 'exact', head: true }).eq('branch', b);
        bCounts[b] = count ?? 0;
      }));
      setBranchCounts(bCounts);

      // Classification counts for the current branch
      const [vc, sc] = await Promise.all([
        supabase.from('voters').select('*', { count: 'exact', head: true }).eq('branch', effectiveBranch).eq('type', 'الناخبون'),
        supabase.from('voters').select('*', { count: 'exact', head: true }).eq('branch', effectiveBranch).eq('type', 'متعاطف'),
      ]);
      setVoterCount(vc.count ?? 0);
      setSympathizerCount(sc.count ?? 0);
    } catch {
      // silent
    }
  }, [profile, effectiveBranch]);

  useEffect(() => { loadCounts(); }, [loadCounts]);
  useEffect(() => { loadPage(); }, [loadPage]);

  // Reset to page 0 on filter changes
  useEffect(() => { setPage(0); }, [branch, classTab, effectiveBranch]);

  // Debounced search
  const onSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(0); }, SEARCH_DEBOUNCE_MS);
  };

  const reclassify = async (id: string, newType: VoterType) => {
    const { error } = await supabase.from('voters').update({ type: newType }).eq('id', id);
    if (error) { showToast('تعذّر تحديث التصنيف', false); return; }
    setRows(prev => prev.map(v => v.id === id ? { ...v, type: newType } : v));
    loadCounts();
    loadPage();
  };

  const handleImport = async (rows: ParsedVoter[]) => {
    const payload = rows.map(r => ({
      branch: effectiveBranch,
      full_name: r.full_name,
      national_id: r.national_id || null,
      voter_number: r.voter_number || null,
      school: r.school || null,
      section: r.section || null,
      type: (r.type === 'متعاطف' ? 'متعاطف' : 'الناخبون') as VoterType,
    }));
    const { error } = await supabase.from('voters').insert(payload);
    if (error) {
      let ok = 0, bad = 0;
      for (const p of payload) { const { error: e } = await supabase.from('voters').insert(p); if (e) bad++; else ok++; }
      await loadCounts(); await loadPage();
      return { added: ok, errors: bad };
    }
    await loadCounts(); await loadPage();
    return { added: rows.length, errors: 0 };
  };

  const handleAddVoter = async (v: { full_name: string; national_id: string; voter_number: string; school: string; section: string; type: VoterType }) => {
    const { error } = await supabase.from('voters').insert({ ...v, branch: effectiveBranch, national_id: v.national_id || null, voter_number: v.voter_number || null, school: v.school || null, section: v.section || null });
    if (error) throw new Error('تعذّر إضافة السجل.');
    await loadCounts(); await loadPage();
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const allBranchVoters = await fetchAllPaginated<Voter>('voters', (q) => {
        return q.select('*').eq('branch', effectiveBranch);
      });
      const data = allBranchVoters.map(v => ({
        'الاسم الكامل': v.full_name,
        'رقم البطاقة الوطنية': v.national_id ?? '',
        'رقم الناخب': v.voter_number ?? '',
        'المدرسة': v.school ?? '',
        'القسم': v.section ?? '',
        'التصنيف': v.type,
      }));
      if (data.length === 0) { showToast('لا توجد بيانات للتصدير', false); return; }
      const header = Object.keys(data[0]);
      const csv = '\uFEFF' + [header.join(','), ...data.map(r => header.map(h => (r as Record<string, string>)[h]).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${effectiveBranch}_الناخبون.csv`; a.click();
      showToast(`تم تصدير ${data.length} سجل`);
    } catch {
      showToast('تعذّر تصدير البيانات', false);
    } finally {
      setExporting(false);
    }
  };

  if (!profile) return null;
  const showAllBranches = canViewAllBranches(profile.role);
  const canAdd = canAddVoters(profile.role);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const from = page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, totalCount);

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Branch tabs */}
      {(showAllBranches || !profile.branch) && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {BRANCHES.map(b => {
            const meta = BRANCH_META[b];
            const ct = branchCounts[b];
            return (
              <button key={b} onClick={() => setBranch(b)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap transition-all ${
                  branch === b ? 'bg-gray-900 text-white border-transparent shadow-md' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: branch === b ? '#fff' : meta.color }} />
                {b}
                <span className={`text-xs px-1.5 rounded-full ${branch === b ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>{ct}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Classification tabs + actions */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex rounded-xl bg-gray-100 p-1">
          <button onClick={() => setClassTab('الناخبون')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${classTab === 'الناخبون' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
            الناخبون <span className="bg-blue-100 text-blue-700 text-xs px-1.5 rounded-full">{voterCount}</span>
          </button>
          <button onClick={() => setClassTab('متعاطف')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${classTab === 'متعاطف' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
            متعاطف <span className="bg-sky-100 text-sky-700 text-xs px-1.5 rounded-full">{sympathizerCount}</span>
          </button>
        </div>
        <div className="flex gap-2">
          {totalCount > 0 || branchCounts[effectiveBranch] > 0 ? (
            <button onClick={exportExcel} disabled={exporting}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-60">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? 'جارٍ التصدير...' : 'تصدير'}
            </button>
          ) : null}
          {canAdd && (
            <>
              <button onClick={() => setImportOpen(true)} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-all">
                <Upload className="w-4 h-4" /> استيراد
              </button>
              <button onClick={() => setFormOpen(true)} className="flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 transition-all">
                <Plus className="w-4 h-4" /> إضافة
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input value={search} onChange={e => onSearchChange(e.target.value)} placeholder="ابحث بالاسم أو رقم البطاقة أو رقم الناخب..."
          className="w-full rounded-xl border border-gray-200 bg-white pr-11 pl-10 py-3 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100" />
        {search && <button onClick={() => { setSearch(''); setPage(0); }} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <Users className="w-10 h-10 text-brand-400 mx-auto mb-3" />
          <p className="font-bold text-gray-800">{search ? 'لا توجد نتائج' : 'لا توجد سجلات'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 border-b border-gray-100">
                  <th className="text-right p-3 font-semibold">الاسم</th>
                  <th className="text-right p-3 font-semibold hidden sm:table-cell">رقم البطاقة</th>
                  <th className="text-right p-3 font-semibold hidden md:table-cell">المدرسة</th>
                  <th className="text-right p-3 font-semibold hidden lg:table-cell">القسم</th>
                  <th className="p-3 font-semibold w-32">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50/40">
                    <td className="p-3">
                      <p className="font-semibold text-gray-800">{v.full_name}</p>
                      {v.voter_number && <p className="text-xs text-gray-400" dir="ltr">#{v.voter_number}</p>}
                    </td>
                    <td className="p-3 hidden sm:table-cell text-gray-600 text-xs" dir="ltr">{v.national_id || '—'}</td>
                    <td className="p-3 hidden md:table-cell text-gray-600 text-xs">{v.school || '—'}</td>
                    <td className="p-3 hidden lg:table-cell text-gray-600 text-xs">{v.section || '—'}</td>
                    <td className="p-3">
                      {v.type === 'الناخبون' ? (
                        <button onClick={() => reclassify(v.id, 'متعاطف')}
                          className="flex items-center gap-1 rounded-lg bg-sky-50 text-sky-700 px-3 py-1.5 text-xs font-medium hover:bg-sky-100 transition-colors">
                          <ArrowRightLeft className="w-3.5 h-3.5" /> متعاطف
                        </button>
                      ) : (
                        <button onClick={() => reclassify(v.id, 'الناخبون')}
                          className="flex items-center gap-1 rounded-lg bg-blue-50 text-blue-700 px-3 py-1.5 text-xs font-medium hover:bg-blue-100 transition-colors">
                          <ArrowRightLeft className="w-3.5 h-3.5" /> ناخب
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              {from}-{to} من {totalCount}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-600 px-2">{page + 1} / {totalPages || 1}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {formOpen && <AddVoterModal onClose={() => setFormOpen(false)} onSave={async v => { await handleAddVoter(v); setFormOpen(false); showToast('تمت إضافة السجل'); }} />}
      {importOpen && <ImportVoterModal onClose={() => setImportOpen(false)} onImport={async rows => { const r = await handleImport(rows); setImportOpen(false); showToast(`تم استيراد ${r.added} سجل`); }} />}

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

function AddVoterModal({ onClose, onSave }: { onClose: () => void; onSave: (v: { full_name: string; national_id: string; voter_number: string; school: string; section: string; type: VoterType }) => Promise<void> }) {
  const [form, setForm] = useState({ full_name: '', national_id: '', voter_number: '', school: '', section: '', type: 'الناخبون' as VoterType });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!form.full_name.trim()) { setError('الاسم مطلوب.'); return; }
    setSaving(true);
    try { await onSave(form); } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl animate-scale-in p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">إضافة ناخب / متعاطف</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <Inp label="الاسم الكامل" value={form.full_name} onChange={v => setForm({ ...form, full_name: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Inp label="رقم البطاقة" value={form.national_id} onChange={v => setForm({ ...form, national_id: v })} dir="ltr" />
          <Inp label="رقم الناخب" value={form.voter_number} onChange={v => setForm({ ...form, voter_number: v })} dir="ltr" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Inp label="المدرسة" value={form.school} onChange={v => setForm({ ...form, school: v })} />
          <Inp label="القسم" value={form.section} onChange={v => setForm({ ...form, section: v })} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">التصنيف</label>
          <div className="flex gap-2">
            {(['الناخبون', 'متعاطف'] as const).map(t => (
              <button key={t} onClick={() => setForm({ ...form, type: t })}
                className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${form.type === t ? 'bg-brand-50 text-brand-700 border-brand-200 ring-2 ring-brand-100' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{t}</button>
            ))}
          </div>
        </div>
        {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</div>}
        <div className="flex gap-3">
          <button onClick={submit} disabled={saving}
            className="flex-1 rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}{saving ? 'جارٍ الإضافة...' : 'إضافة'}
          </button>
          <button onClick={onClose} className="rounded-xl border border-gray-200 px-6 py-3 font-semibold text-gray-600 hover:bg-gray-50">إلغاء</button>
        </div>
      </div>
    </div>
  );
}

function ImportVoterModal({ onClose, onImport }: { onClose: () => void; onImport: (rows: ParsedVoter[]) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedVoter[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setParsing(true); setError(null);
    setFileName(file.name);
    try {
      const parsed = await parseVoterExcel(file);
      if (!parsed.length) { setError('لم يتم العثور على صفوف صالحة.'); setRows(null); }
      else setRows(parsed);
    } catch { setError('تعذّر قراءة الملف.'); }
    finally { setParsing(false); }
  };

  const doImport = async () => {
    if (!rows) return;
    setImporting(true);
    try { await onImport(rows); } catch { setError('خطأ أثناء الاستيراد.'); }
    finally { setImporting(false); }
  };

  const downloadTemplate = () => {
    const blob = new Blob([generateVoterTemplate()], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'نموذج_الناخبين.csv'; a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl animate-scale-in p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">استيراد الناخبين من Excel</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        <button onClick={downloadTemplate}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 px-4 py-3 text-sm font-medium text-gray-600 hover:border-brand-300 hover:text-brand-700 transition-all">
          <Download className="w-4 h-4" /> تحميل نموذج جاهز
        </button>

        {!rows && (
          <div onClick={() => inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            className="cursor-pointer rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50/40 px-6 py-10 text-center hover:border-brand-400 hover:bg-brand-50/30 transition-all">
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {parsing ? <Loader2 className="w-8 h-8 animate-spin text-brand-500 mx-auto" /> : (
              <div className="flex flex-col items-center gap-2">
                <FileUp className="w-10 h-10 text-brand-400" />
                <p className="font-semibold text-gray-700">اسحب الملف هنا أو انقر للاختيار</p>
                <p className="text-xs text-gray-400">xlsx, xls, csv</p>
              </div>
            )}
          </div>
        )}

        {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl p-3"><AlertTriangle className="w-4 h-4" />{error}</div>}

        {rows && (
          <>
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <span className="font-semibold text-gray-700">{fileName}</span>
              <span className="bg-emerald-100 text-emerald-700 text-xs px-2 rounded-full">{rows.length} صف</span>
              <button onClick={() => { setRows(null); if (inputRef.current) inputRef.current.value = ''; }} className="text-xs text-gray-500 hover:text-gray-700 mr-auto">تغيير</button>
            </div>
            <div className="rounded-xl border border-gray-200 max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr><th className="p-2 text-right">الاسم</th><th className="p-2 text-right">البطاقة</th><th className="p-2 text-right">القسم</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.slice(0, 30).map((r, i) => (
                    <tr key={i}><td className="p-2">{r.full_name}</td><td className="p-2" dir="ltr">{r.national_id || '—'}</td><td className="p-2">{r.section || '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={doImport} disabled={importing}
              className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {importing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              {importing ? 'جارٍ الاستيراد...' : `استيراد ${rows.length} سجل`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Inp({ label, value, onChange, dir }: { label: string; value: string; onChange: (v: string) => void; dir?: string }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      <input dir={dir} value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100" />
    </div>
  );
}
