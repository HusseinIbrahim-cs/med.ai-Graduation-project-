import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listSessionsForPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patient_id: string }) =>
    z.object({ patient_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("sessions")
      .select("*")
      .eq("patient_id", data.patient_id)
      .order("session_date", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patient_id: string; insurance_provider?: string }) =>
    z
      .object({
        patient_id: z.string().uuid(),
        insurance_provider: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Determine if this is patient's first session
    const { count } = await context.supabase
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("patient_id", data.patient_id);
    const isFirst = (count ?? 0) === 0;

    const { data: row, error } = await context.supabase
      .from("sessions")
      .insert({
        patient_id: data.patient_id,
        insurance_provider: data.insurance_provider,
        progress_status: isFirst ? "baseline_established" : null,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { session: row, isFirst };
  });

export const updateSessionAiData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id: string;
      summary?: string | null;
      soap?: unknown;
      doctor_transcript?: string | null;
      patient_transcript?: string | null;
    }) =>
      z
        .object({
          id: z.string().uuid(),
          summary: z.string().nullable().optional(),
          soap: z.any().optional(),
          doctor_transcript: z.string().nullable().optional(),
          patient_transcript: z.string().nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("sessions").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateSessionWrapUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id: string;
      doctor_notes: string;
      prescribed_medicine: string;
      next_session_time: string | null;
      progress_status?: "showing_improvement" | "no_improvement" | null;
    }) =>
      z
        .object({
          id: z.string().uuid(),
          doctor_notes: z.string().max(5000),
          prescribed_medicine: z.string().max(5000),
          next_session_time: z.string().nullable(),
          progress_status: z.enum(["showing_improvement", "no_improvement"]).nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sessions")
      .update({
        doctor_notes: data.doctor_notes,
        prescribed_medicine: data.prescribed_medicine,
        next_session_time: data.next_session_time,
        ...(data.progress_status ? { progress_status: data.progress_status } : {}),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const editPastSession = updateSessionWrapUp;

export const attachXrayToSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      session_id: string;
      xray_image_path: string;
      xray_top_disease: string;
      xray_findings: unknown;
    }) =>
      z
        .object({
          session_id: z.string().uuid(),
          xray_image_path: z.string().min(1).max(500),
          xray_top_disease: z.string().max(200),
          xray_findings: z.any(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sessions")
      .update({
        xray_image_path: data.xray_image_path,
        xray_top_disease: data.xray_top_disease,
        xray_findings: data.xray_findings,
      })
      .eq("id", data.session_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getXraySignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string }) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("xray-images")
      .createSignedUrl(data.path, 3600);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

export const uploadXrayImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // not used directly; client uses supabase storage browser client
    return { userId: context.userId };
  });
