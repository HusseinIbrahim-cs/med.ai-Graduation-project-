import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listPatients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("patients")
      .select("id, full_name, age, gender, primary_concern, patient_code, phone_number, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const searchPatients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q: string }) => z.object({ q: z.string().max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const q = data.q.trim();
    if (!q) return [];
    const { data: rows, error } = await context.supabase
      .from("patients")
      .select("id, full_name, age, gender, primary_concern, patient_code, phone_number")
      .or(`full_name.ilike.%${q}%,patient_code.ilike.%${q}%,phone_number.ilike.%${q}%`)
      .limit(20);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("patients")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

// Create patient + auto-provision an auth user keyed on phone (phone is the password too).
export const createPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    full_name: string;
    age: number;
    gender: string;
    primary_concern: string;
    phone_number: string;
  }) =>
    z
      .object({
        full_name: z.string().min(1).max(200),
        age: z.number().int().min(0).max(150),
        gender: z.string().min(1).max(30),
        primary_concern: z.string().min(1).max(2000),
        phone_number: z
          .string()
          .min(4)
          .max(40)
          .regex(/^[0-9+\-\s()]+$/, "Invalid phone number"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = data.phone_number.trim();

    // 1. Insert patient row (let DB auto-generate UUID).
    const { data: patientRow, error: pErr } = await supabaseAdmin
      .from("patients")
      .insert({
        full_name: data.full_name,
        age: data.age,
        gender: data.gender,
        primary_concern: data.primary_concern,
        phone_number: phone,
        created_by: context.userId,
      })
      .select("id, full_name, age, gender, primary_concern, phone_number")
      .single();
    if (pErr) throw new Error(pErr.message);

    // 2. Create auth user (synthetic email; password = phone) so they can log in by phone.
    const cleanPhone = phone.replace(/[^0-9a-z]/gi, "");
    const syntheticEmail = `patient-${cleanPhone}@medai.local`;
    const { data: created, error: aErr } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password: phone,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (aErr || !created.user) {
      // Roll back patient row to keep data consistent.
      await supabaseAdmin.from("patients").delete().eq("id", patientRow.id);
      throw new Error(aErr?.message ?? "Failed to create patient account");
    }

    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        email: syntheticEmail,
        phone_number: phone,
        patient_id: patientRow.id,
      })
      .eq("id", created.user.id);

    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "patient" });

    return patientRow;
  });
