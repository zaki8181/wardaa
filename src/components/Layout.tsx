import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { canCreateUsers } from '@/lib/constants';
import type { RoleKey } from '@/lib/types';
import {
  Flower2, LogOut, Home, Users, Vote, BarChart3, UserCircle, Menu, X,
  ClipboardList,
} from 'lucide-react';

export type PageId = 'home' | 'users' | 'voters' | 'results' | 'profile';

type NavItem = { id: PageId; label: string; icon: React.ReactNode };

function getNavItems(role: RoleKey): NavItem[] {
  const items: NavItem[] = [];
  if (role === 'مراقب القسم') {
    items.push({ id: 'home', label: 'تقرير التصويت', icon: <ClipboardList className="w-5 h-5" /> });
  } else {
    items.push({ id: 'home', label: 'الرئيسية', icon: <Home className="w-5 h-5" /> });
  }
  if (canCreateUsers(role)) {
    items.push({ id: 'users', label: 'المستخدمون', icon: <Users className="w-5 h-5" /> });
  }
  items.push({ id: 'voters', label: 'الناخبون', icon: <Vote className="w-5 h-5" /> });
  if (role !== 'مراقب القسم') {
    items.push({ id: 'results', label: 'النتائج الحية', icon: <BarChart3 className="w-5 h-5" /> });
  }
  items.push({ id: 'profile', label: 'الحساب', icon: <UserCircle className="w-5 h-5" /> });
  return items;
}

type Props = { page: PageId; setPage: (p: PageId) => void; children: React.ReactNode };

export default function Layout({ page, setPage, children }: Props) {
  const { user, profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const role = profile?.role ?? 'مراقب القسم';
  const navItems = getNavItems(role);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 right-0 z-40 h-screen w-64 bg-white border-l border-gray-100 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
              <Flower2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-sm">وردة ديجيتال</h1>
              <p className="text-[11px] text-gray-400">لوحة مراقبة الانتخابات</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setPage(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                page === item.id
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className={page === item.id ? 'text-brand-600' : 'text-gray-400'}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 mb-2">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs flex-shrink-0">
              {(profile?.full_name || user?.email || 'م')[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-800 truncate">{profile?.full_name || 'المستخدم'}</p>
              <p className="text-[10px] text-gray-400 truncate">{role}</p>
            </div>
          </div>
          <button onClick={signOut} className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all">
            <LogOut className="w-3.5 h-3.5" />تسجيل الخروج
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-gray-900/30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100">
          <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 truncate">
                {navItems.find(i => i.id === page)?.label || 'الرئيسية'}
              </h2>
              {profile?.branch && <p className="text-xs text-gray-400">{profile.branch}</p>}
            </div>
          </div>
        </header>
        <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
