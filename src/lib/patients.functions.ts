import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listPatients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("patients")
      .select("id, full_name, age, gender, primary_concern, patient_code, created_at")
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
      .select("id, full_name, age, gender, primary_concern, patient_code")
      .or(`full_name.ilike.%${q}%,patient_code.ilike.%${q}%`)
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

export const createPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    full_name: string;
    age: number;
    gender: string;
    primary_concern: string;
  }) =>
    z
      .object({
        full_name: z.string().min(1).max(200),
        age: z.number().int().min(0).max(150),
        gender: z.string().min(1).max(30),
        primary_concern: z.string().min(1).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("patients")
      .insert({ ...data, created_by: context.userId })
      .select("id, full_name, age, gender, primary_concern")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
