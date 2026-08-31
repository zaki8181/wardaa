import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ROLE_HIERARCHY: Record<string, string[]> = {
  "مشرف العام": ["مشرف العام", "مراقب العام", "مسؤل الخلية", "مراقب القسم"],
  "مراقب العام": ["مسؤل الخلية", "مراقب القسم"],
  "مسؤل الخلية": ["مراقب القسم"],
  "مراقب القسم": [],
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonRes({ error: "غير مصرح" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: caller },
    } = await admin.auth.getUser(token);
    if (!caller) return jsonRes({ error: "غير مصرح" }, 401);

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role, branch")
      .eq("id", caller.id)
      .maybeSingle();
    if (!callerProfile) return jsonRes({ error: "لا يوجد ملف شخصي" }, 403);

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const {
        email,
        password,
        role,
        full_name,
        branch,
        section,
        phone_number,
        prefecture,
        region,
        party_duty,
        school,
        voter_number,
      } = body;

      const allowed = ROLE_HIERARCHY[callerProfile.role] ?? [];
      if (!allowed.includes(role)) {
        return jsonRes({ error: "ليس لديك صلاحية إنشاء هذا الدور" }, 403);
      }

      if (!email || !password || !full_name) {
        return jsonRes(
          { error: "البريد وكلمة المرور والاسم مطلوبة" },
          400
        );
      }

      const { data: newAuth, error: authError } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name },
        });

      if (authError) {
        const msg = authError.message.includes("already been registered")
          ? "البريد الإلكتروني مسجّل بالفعل"
          : authError.message;
        return jsonRes({ error: msg }, 400);
      }

      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .insert({
          id: newAuth.user.id,
          role,
          parent_id: caller.id,
          branch: branch || callerProfile.branch,
          section: section || null,
          full_name,
          phone_number: phone_number || null,
          prefecture: prefecture || null,
          region: region || null,
          party_duty: party_duty || null,
          school: school || null,
          voter_number: voter_number || null,
        })
        .select()
        .single();

      if (profileError) {
        await admin.auth.admin.deleteUser(newAuth.user.id);
        return jsonRes({ error: profileError.message }, 400);
      }

      return jsonRes({ user: { ...profile, email } });
    }

    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) return jsonRes({ error: "معرّف المستخدم مطلوب" }, 400);

      if (callerProfile.role !== "مشرف العام") {
        return jsonRes({ error: "ليس لديك صلاحية الحذف" }, 403);
      }

      if (user_id === caller.id) {
        return jsonRes({ error: "لا يمكنك حذف حسابك" }, 400);
      }

      await admin.from("profiles").delete().eq("id", user_id);
      const { error: delError } = await admin.auth.admin.deleteUser(user_id);
      if (delError) return jsonRes({ error: delError.message }, 400);

      return jsonRes({ success: true });
    }

    return jsonRes({ error: "عملية غير معروفة" }, 400);
  } catch (err) {
    return jsonRes({ error: (err as Error).message }, 500);
  }
});
