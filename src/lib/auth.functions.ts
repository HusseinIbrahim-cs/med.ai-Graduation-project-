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
      .select("full_name, email, patient_id, patient_code, phone_number")
      .eq("id", context.userId)
      .maybeSingle();
    return { role, userId: context.userId, profile };
  });

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
    .update({ full_name: "MED-AI Admin", phone_number: "admin" })
    .eq("id", created.user.id);
  return { created: true };
});

// Staff login: phone + password → return synthetic email so client can call signInWithPassword
export const resolveStaffEmailByPhone = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string }) =>
    z.object({ phone: z.string().min(1).max(40) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("email, id")
      .eq("phone_number", data.phone.trim())
      .maybeSingle();
    if (!row) return { email: null };
    // Ensure they have a staff role (not a patient)
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", row.id);
    const isStaff = (roles ?? []).some((r) => r.role === "admin" || r.role === "doctor");
    return { email: isStaff ? row.email : null };
  });

// Patient login: phone only → return synthetic credentials (phone == password)
export const resolvePatientLoginByPhone = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string }) =>
    z.object({ phone: z.string().min(1).max(40) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = data.phone.trim();
    const { data: patient } = await supabaseAdmin
      .from("patients")
      .select("id")
      .eq("phone_number", phone)
      .maybeSingle();
    if (!patient) return { email: null, password: null };
    // Find the linked profile/auth user via patient_id
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("patient_id", patient.id)
      .maybeSingle();
    if (!profile?.email) return { email: null, password: null };
    return { email: profile.email, password: phone };
  });
