import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { ensureBootstrapAdmin, getMyRole, resolvePatientEmail } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in · MED-AI" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const bootstrap = useServerFn(ensureBootstrapAdmin);
  const getRole = useServerFn(getMyRole);
  const resolve = useServerFn(resolvePatientEmail);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    bootstrap().catch(() => {});
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) await redirectByRole();
    });
  }, []);

  async function redirectByRole() {
    try {
      const me = await getRole();
      if (me.role === "admin") navigate({ to: "/admin" });
      else if (me.role === "doctor") navigate({ to: "/welcome" });
      else if (me.role === "patient") navigate({ to: "/records" });
      else navigate({ to: "/records" });
    } catch {
      navigate({ to: "/records" });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/20 p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-6 gap-2">
          <div className="h-11 w-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
            <Activity className="h-6 w-6" />
          </div>
          <div className="text-2xl font-semibold tracking-tight">MED-AI</div>
        </div>
        <div className="rounded-3xl border bg-card p-6 shadow-sm">
          <Tabs defaultValue="staff">
            <TabsList className="grid grid-cols-2 w-full rounded-full bg-muted/60">
              <TabsTrigger value="staff" className="rounded-full">Staff</TabsTrigger>
              <TabsTrigger value="patient" className="rounded-full">Patient</TabsTrigger>
            </TabsList>
            <TabsContent value="staff" className="mt-5">
              <StaffForm loading={loading} setLoading={setLoading} onDone={redirectByRole} />
            </TabsContent>
            <TabsContent value="patient" className="mt-5">
              <PatientForm
                loading={loading}
                setLoading={setLoading}
                resolve={(code) => resolve({ data: { code } })}
                onDone={redirectByRole}
              />
            </TabsContent>
          </Tabs>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">
          Clinical preview · not for medical use
        </p>
      </div>
    </div>
  );
}

function StaffForm({
  loading,
  setLoading,
  onDone,
}: {
  loading: boolean;
  setLoading: (v: boolean) => void;
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    onDone();
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Password</Label>
        <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" className="w-full rounded-full" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
      </Button>
    </form>
  );
}

function PatientForm({
  loading,
  setLoading,
  resolve,
  onDone,
}: {
  loading: boolean;
  setLoading: (v: boolean) => void;
  resolve: (code: string) => Promise<{ email: string | null }>;
  onDone: () => void;
}) {
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { email } = await resolve(code);
    if (!email) {
      setLoading(false);
      return toast.error("Patient ID not found");
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password: pin });
    setLoading(false);
    if (error) return toast.error("Invalid PIN");
    toast.success("Welcome");
    onDone();
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Patient ID</Label>
        <Input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. P-1024" />
      </div>
      <div className="space-y-1.5">
        <Label>PIN</Label>
        <Input type="password" required value={pin} onChange={(e) => setPin(e.target.value)} />
      </div>
      <Button type="submit" className="w-full rounded-full" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
      </Button>
    </form>
  );
}
