import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  ensureBootstrapAdmin,
  getMyRole,
  resolvePatientLoginByPhone,
  resolveStaffEmailByPhone,
} from "@/lib/auth.functions";
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
  const resolveStaff = useServerFn(resolveStaffEmailByPhone);
  const resolvePatient = useServerFn(resolvePatientLoginByPhone);
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
              <StaffForm
                loading={loading}
                setLoading={setLoading}
                resolve={(phone) => resolveStaff({ data: { phone } })}
                onDone={redirectByRole}
              />
            </TabsContent>
            <TabsContent value="patient" className="mt-5">
              <PatientForm
                loading={loading}
                setLoading={setLoading}
                resolve={(phone) => resolvePatient({ data: { phone } })}
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
  resolve,
  onDone,
}: {
  loading: boolean;
  setLoading: (v: boolean) => void;
  resolve: (phone: string) => Promise<{ email: string | null }>;
  onDone: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { email } = await resolve(phone);
      if (!email) {
        toast.error("No staff account found for that phone number");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error("Invalid credentials");
        return;
      }
      toast.success("Welcome back");
      onDone();
    } finally {
      setLoading(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Phone number</Label>
        <Input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +1 555 123 4567" />
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
  resolve: (phone: string) => Promise<{ email: string | null; password: string | null }>;
  onDone: () => void;
}) {
  const [phone, setPhone] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { email, password } = await resolve(phone);
      if (!email || !password) {
        toast.error("No patient found for that phone number");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error("Sign-in failed");
        return;
      }
      toast.success("Welcome");
      onDone();
    } finally {
      setLoading(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Phone number</Label>
        <Input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +1 555 123 4567" />
      </div>
      <Button type="submit" className="w-full rounded-full" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
      </Button>
    </form>
  );
}
