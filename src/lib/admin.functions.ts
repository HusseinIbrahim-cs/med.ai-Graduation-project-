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
      .select("id, full_name, email, is_active, patient_code, patient_id, phone_number, created_at")
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
  .inputValidator(
    (d: { full_name: string; email: string; password: string; phone_number: string }) =>
      z
        .object({
          full_name: z.string().min(1).max(200),
          email: z.string().email().max(255),
          password: z.string().min(6).max(72),
          phone_number: z
            .string()
            .min(4)
            .max(40)
            .regex(/^[0-9+\-\s()]+$/, "Invalid phone number"),
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
      .update({ full_name: data.full_name, phone_number: data.phone_number.trim() })
      .eq("id", created.user.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "doctor" });
    return { id: created.user.id };
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
    await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.is_active ? "none" : "876000h",
    });
    return { ok: true };
  });

export const createAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { full_name: string; email: string; password: string; phone_number: string }) =>
      z
        .object({
          full_name: z.string().min(1).max(200),
          email: z.string().email().max(255),
          password: z.string().min(6).max(72),
          phone_number: z
            .string()
            .min(4)
            .max(40)
            .regex(/^[0-9+\-\s()]+$/, "Invalid phone number"),
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
      .update({ full_name: data.full_name, phone_number: data.phone_number.trim(), username: data.email.split("@")[0] })
      .eq("id", created.user.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
    return { id: created.user.id };
  });

export const updateUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; full_name: string; email: string; phone_number: string }) =>
    z
      .object({
        user_id: z.string().uuid(),
        full_name: z.string().min(1).max(200),
        email: z.string().email().max(255),
        phone_number: z.string().min(0).max(40),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        email: data.email,
        phone_number: data.phone_number.trim(),
      })
      .eq("id", data.user_id);
    await supabaseAdmin.auth.admin.updateUserById(data.user_id, { email: data.email });
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) =>
    z.object({ user_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) throw new Error("You cannot delete your own account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patient_id: string }) =>
    z.object({ patient_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Find the auth user linked to this patient, if any, then delete both
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("patient_id", data.patient_id)
      .maybeSingle();
    await supabaseAdmin.from("patients").delete().eq("id", data.patient_id);
    if (profile?.id) {
      await supabaseAdmin.auth.admin.deleteUser(profile.id);
    }
    return { ok: true };
  });

export const updatePatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    patient_id: string;
    full_name: string;
    age: number;
    gender: string;
    primary_concern: string;
    phone_number: string;
  }) =>
    z
      .object({
        patient_id: z.string().uuid(),
        full_name: z.string().min(1).max(200),
        age: z.number().int().min(0).max(150),
        gender: z.string().min(1).max(30),
        primary_concern: z.string().min(0).max(2000),
        phone_number: z.string().min(0).max(40),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("patients")
      .update({
        full_name: data.full_name,
        age: data.age,
        gender: data.gender,
        primary_concern: data.primary_concern,
        phone_number: data.phone_number.trim(),
      })
      .eq("id", data.patient_id);
    return { ok: true };
  });
