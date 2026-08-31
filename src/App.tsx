import { useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import LoginPage from '@/components/LoginPage';
import Layout, { type PageId } from '@/components/Layout';
import HomePage from '@/components/HomePage';
import UsersPage from '@/components/UsersPage';
import VotersPage from '@/components/VotersPage';
import LiveResultsPage from '@/components/LiveResultsPage';
import ProfilePage from '@/components/ProfilePage';
import { Flower2, LogOut, AlertCircle } from 'lucide-react';

function AppInner() {
  const { session, profile, loading, signOut } = useAuth();
  const [page, setPage] = useState<PageId>('home');

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white shadow-lg shadow-brand-500/20 mb-4">
          <Flower2 className="w-7 h-7 animate-pulse" />
        </div>
        <p className="text-gray-400 text-sm">جارٍ التحميل...</p>
      </div>
    );
  }

  if (!session) return <LoginPage />;

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 max-w-md text-center shadow-lg">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">حسابك غير مفعّل</h2>
          <p className="text-sm text-gray-500 mb-6">
            لم يتم تعيين دور لحسابك بعد. تواصل مع المشرف العام لتفعيل الوصول.
          </p>
          <button onClick={signOut}
            className="flex items-center justify-center gap-2 mx-auto rounded-xl border border-gray-200 px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all">
            <LogOut className="w-4 h-4" /> تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  let content: React.ReactNode;
  switch (page) {
    case 'users': content = <UsersPage />; break;
    case 'voters': content = <VotersPage />; break;
    case 'results': content = <LiveResultsPage />; break;
    case 'profile': content = <ProfilePage />; break;
    default: content = <HomePage />;
  }

  return <Layout page={page} setPage={setPage}>{content}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
