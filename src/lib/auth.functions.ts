import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const roles = (data ?? []).map((r) => r.role);
    const role = roles.includes("admin")
      ? "admin"
      : roles.includes("doctor")
        ? "doctor"
        : roles.includes("patient")
          ? "patient"
          : null;
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name, email, patient_id, patient_code")
      .eq("id", context.userId)
      .maybeSingle();
    return { role, userId: context.userId, profile };
  });

// Bootstrap: create initial admin if none exists. Idempotent. Public on purpose so the auth page can call it.
export const ensureBootstrapAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");
  if ((count ?? 0) > 0) return { created: false };

  const email = "admin@med.ai.com";
  const password = "password2004";
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "MED-AI Admin" },
  });
  if (createErr || !created.user) {
    return { created: false, error: createErr?.message ?? "create failed" };
  }
  await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
  await supabaseAdmin
    .from("profiles")
    .update({ full_name: "MED-AI Admin" })
    .eq("id", created.user.id);
  return { created: true };
});

// Resolve patient code to its synthetic auth email so client can call signInWithPassword.
export const resolvePatientEmail = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string }) => z.object({ code: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("patient_code", data.code)
      .maybeSingle();
    return { email: row?.email ?? null };
  });
