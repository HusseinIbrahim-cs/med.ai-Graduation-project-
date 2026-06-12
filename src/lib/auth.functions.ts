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
      .select("full_name, email, patient_id, patient_code, phone_number, username")
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
  if ((count ?? 0) > 0) {
    // Ensure admin profile has username set
    await supabaseAdmin
      .from("profiles")
      .update({ username: "admin" })
      .eq("email", "admin@med.ai.com")
      .is("username", null);
    return { created: false };
  }

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
    .update({ full_name: "MED-AI Admin", username: "admin", phone_number: "admin" })
    .eq("id", created.user.id);
  return { created: true };
});

// Staff login: resolve auth email by username + required staff role.
// Password validation is delegated to supabase.auth.signInWithPassword on the client.
export const resolveStaffByUsername = createServerFn({ method: "POST" })
  .inputValidator((d: { username: string; role: "admin" | "doctor" }) =>
    z
      .object({
        username: z.string().min(1).max(80),
        role: z.enum(["admin", "doctor"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("email, id, is_active")
      .ilike("username", data.username.trim())
      .maybeSingle();
    if (!row || !row.email) return { email: null };
    if (row.is_active === false) return { email: null, inactive: true };
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", row.id);
    const hasRole = (roles ?? []).some((r) => r.role === data.role);
    if (!hasRole) return { email: null };
    return { email: row.email };
  });

// Patient login: phone + PIN → returns synthetic email + the PIN (used as auth password).
export const resolvePatientByPhonePin = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string; pin: string }) =>
    z
      .object({
        phone: z.string().min(1).max(40),
        pin: z.string().min(1).max(40),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = data.phone.trim();
    const pin = data.pin.trim();
    const { data: patient } = await supabaseAdmin
      .from("patients")
      .select("id, pin")
      .eq("phone_number", phone)
      .maybeSingle();
    if (!patient || !patient.pin || patient.pin !== pin) {
      return { email: null, password: null };
    }
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("patient_id", patient.id)
      .maybeSingle();
    if (!profile?.email) return { email: null, password: null };
    return { email: profile.email, password: pin };
  });
