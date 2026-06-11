import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getMyRole } from "@/lib/auth.functions";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useActivePatient } from "@/store/activePatient";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings · MED-AI" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const getRole = useServerFn(getMyRole);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getRole() });
  const navigate = useNavigate();
  const clear = useActivePatient((s) => s.clear);

  async function signOut() {
    clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings & profile</h1>
      <Card className="rounded-3xl">
        <CardHeader><CardTitle className="text-lg">Account</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Name" value={me?.profile?.full_name ?? "—"} />
          <Row label="Email" value={me?.profile?.email ?? "—"} />
          <Row label="Role" value={me?.role ?? "—"} />
          {me?.profile?.patient_code && <Row label="Patient ID" value={me.profile.patient_code} />}
        </CardContent>
      </Card>
      <Button variant="destructive" className="rounded-full" onClick={signOut}>Sign out</Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
