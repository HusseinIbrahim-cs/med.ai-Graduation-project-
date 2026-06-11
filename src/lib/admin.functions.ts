import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: admin only");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, is_active, patient_code, patient_id, created_at")
      .order("created_at", { ascending: false });
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const byUser = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => {
      const arr = byUser.get(r.user_id) ?? [];
      arr.push(r.role);
      byUser.set(r.user_id, arr);
    });
    return (profiles ?? []).map((p: any) => ({ ...p, roles: byUser.get(p.id) ?? [] }));
  });

export const createDoctor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { full_name: string; email: string; password: string }) =>
    z
      .object({
        full_name: z.string().min(1).max(200),
        email: z.string().email().max(255),
        password: z.string().min(6).max(72),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "create failed");
    await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.full_name })
      .eq("id", created.user.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "doctor" });
    return { id: created.user.id };
  });

export const createPatientUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      full_name: string;
      patient_code: string;
      pin: string;
      age: number;
      gender: string;
      primary_concern: string;
    }) =>
      z
        .object({
          full_name: z.string().min(1).max(200),
          patient_code: z
            .string()
            .min(2)
            .max(40)
            .regex(/^[A-Za-z0-9_-]+$/),
          pin: z.string().min(4).max(72),
          age: z.number().int().min(0).max(150),
          gender: z.string().min(1).max(30),
          primary_concern: z.string().min(1).max(2000),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create patient row
    const { data: patientRow, error: pErr } = await supabaseAdmin
      .from("patients")
      .insert({
        full_name: data.full_name,
        age: data.age,
        gender: data.gender,
        primary_concern: data.primary_concern,
        patient_code: data.patient_code,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (pErr) throw new Error(pErr.message);

    const syntheticEmail = `patient-${data.patient_code.toLowerCase()}@medai.local`;
    const { data: created, error: aErr } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password: data.pin,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (aErr || !created.user) throw new Error(aErr?.message ?? "create failed");

    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        email: syntheticEmail,
        patient_code: data.patient_code,
        patient_id: patientRow.id,
      })
      .eq("id", created.user.id);

    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "patient" });
    return { id: created.user.id, patient_id: patientRow.id };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; is_active: boolean }) =>
    z.object({ user_id: z.string().uuid(), is_active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("profiles")
      .update({ is_active: data.is_active })
      .eq("id", data.user_id);
    // Also ban/unban the auth user
    await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.is_active ? "none" : "876000h",
    });
    return { ok: true };
  });
