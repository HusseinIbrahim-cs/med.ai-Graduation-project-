import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns the currently signed-in patient's own profile, patient record,
 * and full chronological session history.
 */
export const getMyPatientDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile, error: profErr } = await context.supabase
      .from("profiles")
      .select("id, full_name, patient_id, phone_number, email")
      .eq("id", context.userId)
      .maybeSingle();
    if (profErr) throw new Error(profErr.message);
    if (!profile?.patient_id) {
      return { patient: null, sessions: [], profile };
    }
    const { data: patient } = await context.supabase
      .from("patients")
      .select("*")
      .eq("id", profile.patient_id)
      .maybeSingle();
    const { data: sessions, error: sessErr } = await context.supabase
      .from("sessions")
      .select("*")
      .eq("patient_id", profile.patient_id)
      .order("session_date", { ascending: false });
    if (sessErr) throw new Error(sessErr.message);
    return { patient, sessions: sessions ?? [], profile };
  });
