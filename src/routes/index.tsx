import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
    // Authenticated — route by role. Patients land on /patient,
    // staff are routed by AppShell; default to /records.
    const userId = data.session.user.id;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const r = (roles ?? []).map((x) => x.role);
    if (r.includes("admin")) throw redirect({ to: "/admin" });
    if (r.includes("doctor")) throw redirect({ to: "/welcome" });
    if (r.includes("patient")) throw redirect({ to: "/patient" });
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
