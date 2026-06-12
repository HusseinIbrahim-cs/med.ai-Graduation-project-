import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, Loader2, Stethoscope, UserRound } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  ensureBootstrapAdmin,
  getMyRole,
  resolvePatientByPhonePin,
  resolveStaffByUsername,
} from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in · MED-AI" }] }),
  component: AuthPage,
});

type Mode = "staff" | "patient";
type StaffRole = "doctor" | "admin";

function AuthPage() {
  const navigate = useNavigate();
  const bootstrap = useServerFn(ensureBootstrapAdmin);
  const getRole = useServerFn(getMyRole);
  const resolveStaff = useServerFn(resolveStaffByUsername);
  const resolvePatient = useServerFn(resolvePatientByPhonePin);

  const [mode, setMode] = useState<Mode>("staff");
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-6 gap-2">
          <div className="h-11 w-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
            <Activity className="h-6 w-6" />
          </div>
          <div className="text-2xl font-semibold tracking-tight text-slate-800">MED-AI</div>
        </div>

        <div className="rounded-3xl border border-teal-100 bg-white p-6 shadow-md shadow-teal-100/40">
          {/* Top Staff/Patient toggle */}
          <div className="grid grid-cols-2 p-1 rounded-full bg-emerald-50 mb-6">
            <ToggleButton active={mode === "staff"} onClick={() => setMode("staff")}>
              <Stethoscope className="h-4 w-4" /> Staff
            </ToggleButton>
            <ToggleButton active={mode === "patient"} onClick={() => setMode("patient")}>
              <UserRound className="h-4 w-4" /> Patient
            </ToggleButton>
          </div>

          {mode === "staff" ? (
            <StaffForm
              loading={loading}
              setLoading={setLoading}
              resolve={(username, role) => resolveStaff({ data: { username, role } })}
              onDone={redirectByRole}
            />
          ) : (
            <PatientForm
              loading={loading}
              setLoading={setLoading}
              resolve={(phone, pin) => resolvePatient({ data: { phone, pin } })}
              onDone={redirectByRole}
            />
          )}
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">
          Clinical preview · not for medical use
        </p>
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-full py-2 text-sm font-medium transition-all",
        active
          ? "bg-teal-600 text-white shadow"
          : "text-slate-600 hover:text-teal-700",
      )}
    >
      {children}
    </button>
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
  resolve: (
    username: string,
    role: StaffRole,
  ) => Promise<{ email: string | null; inactive?: boolean }>;
  onDone: () => void;
}) {
  const [role, setRole] = useState<StaffRole>("doctor");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { email, inactive } = await resolve(username, role);
      if (inactive) {
        toast.error("This account has been deactivated");
        return;
      }
      if (!email) {
        toast.error("Invalid username or role");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error("Invalid username or password");
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
        <Label className="text-slate-700">Role</Label>
        <div className="grid grid-cols-2 gap-2">
          <RolePill active={role === "doctor"} onClick={() => setRole("doctor")}>
            Doctor
          </RolePill>
          <RolePill active={role === "admin"} onClick={() => setRole("admin")}>
            Admin
          </RolePill>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-slate-700">Username</Label>
        <Input
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. admin"
          className="border-teal-100 focus-visible:ring-teal-500"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-slate-700">Password</Label>
        <Input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border-teal-100 focus-visible:ring-teal-500"
        />
      </div>
      <Button
        type="submit"
        className="w-full rounded-full bg-teal-600 hover:bg-teal-700 text-white"
        disabled={loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
      </Button>
    </form>
  );
}

function RolePill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full py-2 text-sm font-medium border transition-all",
        active
          ? "bg-emerald-100 border-emerald-300 text-emerald-800"
          : "bg-white border-slate-200 text-slate-600 hover:border-teal-300",
      )}
    >
      {children}
    </button>
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
  resolve: (
    phone: string,
    pin: string,
  ) => Promise<{ email: string | null; password: string | null }>;
  onDone: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { email, password } = await resolve(phone, pin);
      if (!email || !password) {
        toast.error("Invalid phone number or PIN.");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error("Invalid phone number or PIN.");
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
        <Label className="text-slate-700">Phone Number</Label>
        <Input
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g. +1 555 123 4567"
          className="border-teal-100 focus-visible:ring-teal-500"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-slate-700">PIN</Label>
        <Input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          required
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="••••"
          className="border-teal-100 focus-visible:ring-teal-500 tracking-widest"
        />
      </div>
      <Button
        type="submit"
        className="w-full rounded-full bg-teal-600 hover:bg-teal-700 text-white"
        disabled={loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
      </Button>
    </form>
  );
}
