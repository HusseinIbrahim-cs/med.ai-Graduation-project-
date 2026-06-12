import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import { getMyRole } from "@/lib/auth.functions";
import { supabase } from "@/integrations/supabase/client";
import { useActivePatient } from "@/store/activePatient";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings · MED-AI" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const getRole = useServerFn(getMyRole);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getRole() });
  const navigate = useNavigate();
  const clear = useActivePatient((s) => s.clear);

  const [apiKey, setApiKey] = useState("");
  const [show, setShow] = useState(false);

  useEffect(() => {
    setApiKey(localStorage.getItem("geminiApiKey") ?? "");
  }, []);

  function saveKey() {
    if (!apiKey.trim()) {
      localStorage.removeItem("geminiApiKey");
      toast.success("Gemini API key cleared");
      return;
    }
    localStorage.setItem("geminiApiKey", apiKey.trim());
    toast.success("Gemini API key saved");
  }

  async function signOut() {
    clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings & profile</h1>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-lg">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Name" value={me?.profile?.full_name ?? "—"} />
          <Row label="Email" value={me?.profile?.email ?? "—"} />
          <Row label="Phone" value={me?.profile?.phone_number ?? "—"} />
          <Row label="Role" value={me?.role ?? "—"} />
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Gemini API key
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Used by the Clinical Assistant chatbot. Stored only in your browser (localStorage) — never sent to our servers.
            Get a key at{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              aistudio.google.com/apikey
            </a>
            .
          </p>
          <div className="space-y-1.5">
            <Label>API key</Label>
            <div className="flex gap-2">
              <Input
                type={show ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIza…"
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide" : "Show"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <Button onClick={saveKey} className="rounded-full">
            Save key
          </Button>
        </CardContent>
      </Card>

      <Button variant="destructive" className="rounded-full" onClick={signOut}>
        Sign out
      </Button>
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
