/*
# إنشاء مستخدمي لوحة وردة ديجيتال

1. الجداول الجديدة
- `dashboard_users`: سجل المستخدمين الذين يديرهم المشرف داخل اللوحة.
- `id`: معرّف فريد.
- `full_name`: الاسم الكامل.
- `email`: البريد الإلكتروني.
- `phone`: رقم الهاتف الاختياري.
- `role`: الدور التنظيمي.
- `status`: حالة الحساب (نشط أو غير نشط).
- `organization`: الجهة أو القسم الاختياري.
- `created_by`: الحساب الذي أضاف السجل.
- `created_at`: تاريخ الإنشاء.
- `updated_at`: تاريخ آخر تعديل.

2. الأمان
- تفعيل RLS على جدول `dashboard_users`.
- السماح للمستخدمين المسجلين بقراءة وإضافة وتعديل وحذف سجلات مساحة العمل المشتركة.
- عدم السماح للزوار غير المسجلين بالوصول إلى بيانات اللوحة.

3. ملاحظات
- هذا الجدول يمثل بيانات المستخدمين داخل لوحة الإدارة، ولا ينشئ حسابات دخول تلقائية في نظام المصادقة.
- يمكن لاحقًا ربط دعوة المستخدم بإنشاء حساب دخول منفصل.
*/

CREATE TABLE IF NOT EXISTS public.dashboard_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  role text NOT NULL CHECK (role IN ('المشرف العام', 'مستخدم مسجّل', 'هيكل تنظيمي', 'مراقب', 'مشرف', 'عامل ميداني')),
  status text NOT NULL DEFAULT 'نشط' CHECK (status IN ('نشط', 'غير نشط')),
  organization text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboard_users ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS dashboard_users_role_idx ON public.dashboard_users(role);
CREATE INDEX IF NOT EXISTS dashboard_users_full_name_idx ON public.dashboard_users(full_name);
CREATE INDEX IF NOT EXISTS dashboard_users_status_idx ON public.dashboard_users(status);

DROP POLICY IF EXISTS "authenticated_read_dashboard_users" ON public.dashboard_users;
CREATE POLICY "authenticated_read_dashboard_users" ON public.dashboard_users
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_dashboard_users" ON public.dashboard_users;
CREATE POLICY "authenticated_insert_dashboard_users" ON public.dashboard_users
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "authenticated_update_dashboard_users" ON public.dashboard_users;
CREATE POLICY "authenticated_update_dashboard_users" ON public.dashboard_users
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_dashboard_users" ON public.dashboard_users;
CREATE POLICY "authenticated_delete_dashboard_users" ON public.dashboard_users
  FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.set_dashboard_users_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dashboard_users_updated_at ON public.dashboard_users;
CREATE TRIGGER dashboard_users_updated_at
  BEFORE UPDATE ON public.dashboard_users
  FOR EACH ROW EXECUTE FUNCTION public.set_dashboard_users_updated_at();