import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Bell,
  ClipboardList,
  FileText,
  LogOut,
  Menu,
  Search,
  Settings,
  Sparkles,
  StopCircle,
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRole } from "@/lib/auth.functions";
import { searchPatients } from "@/lib/patients.functions";
import { useActivePatient } from "@/store/activePatient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { EndSessionDialog } from "@/components/EndSessionDialog";
import { WaveBackground } from "@/components/WaveBackground";

type NavItem = { label: string; to: string; icon: React.ComponentType<{ className?: string }> };

const DOCTOR_NAV: NavItem[] = [
  { label: "Patient Records", to: "/records", icon: FileText },
  { label: "AI Diagnosis", to: "/diagnosis", icon: Activity },
  { label: "Consultation Summary", to: "/summary", icon: ClipboardList },
  { label: "Clinical Assistant", to: "/consultation", icon: Sparkles },
  { label: "Settings & Profile", to: "/settings", icon: Settings },
];
const ADMIN_NAV: NavItem[] = [
  { label: "Admin Dashboard", to: "/admin", icon: UserRound },
  ...DOCTOR_NAV,
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { patient, sessionId, clear } = useActivePatient();
  const [endOpen, setEndOpen] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const getRole = useServerFn(getMyRole);
  const search = useServerFn(searchPatients);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getRole() });

  const isPatient = me?.role === "patient";

  const nav = useMemo<NavItem[]>(() => {
    if (me?.role === "admin") return ADMIN_NAV;
    return DOCTOR_NAV;
  }, [me?.role]);

  const { data: results = [] } = useQuery({
    queryKey: ["search", searchVal],
    queryFn: () => search({ data: { q: searchVal } }),
    enabled: searchVal.length > 0 && !isPatient,
  });

  async function handleSignOut() {
    clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  // Patient: single-page layout with no sidebar, no patient-search header.
  if (isPatient) {
    return (
      <div className="relative min-h-screen w-full">
        <WaveBackground />
        <header className="sticky top-0 z-30 h-16 border-b bg-card/70 backdrop-blur flex items-center gap-3 px-4 md:px-6">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <Activity className="h-5 w-5" />
            </div>
            <div className="font-semibold tracking-tight text-lg">MED-AI</div>
          </div>
          <div className="flex-1" />
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-primary">
              <UserRound className="h-4 w-4" />
            </div>
            <span className="text-muted-foreground">{me?.profile?.full_name ?? "—"}</span>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        <main className="p-4 md:p-6">{children}</main>
      </div>
    );
  }

  const SidebarBody = (
    <>
      <div className="flex h-16 items-center gap-2 px-5 border-b">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Activity className="h-5 w-5" />
        </div>
        <div className="font-semibold tracking-tight text-lg">MED-AI</div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileNavOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "hover:bg-sidebar-accent/60",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t text-xs text-muted-foreground">
        v0.1 · Clinical preview
      </div>
    </>
  );

  return (
    <div className="relative min-h-screen w-full">
      <WaveBackground />

      {/* Fixed desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-64 flex-col border-r bg-sidebar/95 backdrop-blur text-sidebar-foreground">
        {SidebarBody}
      </aside>

      <div className="flex min-h-screen flex-col md:ml-64 min-w-0">
        {/* Header */}
        <header className="h-16 border-b bg-card/70 backdrop-blur flex items-center gap-2 md:gap-3 px-3 md:px-6 sticky top-0 z-30">
          {/* Mobile hamburger */}
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden rounded-full">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-sidebar text-sidebar-foreground">
              <div className="flex h-full flex-col">{SidebarBody}</div>
            </SheetContent>
          </Sheet>

          <div className="md:hidden font-semibold">MED-AI</div>

          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search patient by name or ID..."
              className="pl-9 rounded-full bg-muted/60 border-0"
              value={searchVal}
              onChange={(e) => {
                setSearchVal(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            />
            {searchOpen && searchVal && (
              <div className="absolute z-40 mt-2 w-full rounded-2xl border bg-popover shadow-lg overflow-hidden">
                {results.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No matches</div>
                ) : (
                  results.map((p) => (
                    <button
                      key={p.id}
                      className="w-full text-left px-3 py-2.5 hover:bg-accent text-sm flex items-center justify-between"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        useActivePatient.getState().setPatient({
                          id: p.id,
                          full_name: p.full_name,
                          age: p.age,
                          gender: p.gender,
                          primary_concern: p.primary_concern,
                        });
                        useActivePatient.getState().setSessionId(null);
                        setSearchOpen(false);
                        setSearchVal("");
                        navigate({ to: "/records" });
                      }}
                    >
                      <span>
                        <span className="font-medium">{p.full_name}</span>{" "}
                        <span className="text-muted-foreground">
                          · {p.gender ?? "—"} · {p.age ?? "?"}
                        </span>
                      </span>
                      {p.patient_code && (
                        <span className="text-xs text-muted-foreground">{p.patient_code}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="flex-1" />
          {sessionId && (
            <Button
              variant="destructive"
              className="rounded-full hidden sm:inline-flex"
              onClick={() => setEndOpen(true)}
            >
              <StopCircle className="h-4 w-4 mr-1.5" /> End Session
            </Button>
          )}
          <Button variant="ghost" size="icon" className="rounded-full hidden sm:inline-flex">
            <Bell className="h-4 w-4" />
          </Button>
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-primary">
              <UserRound className="h-4 w-4" />
            </div>
            <span className="text-muted-foreground">{me?.profile?.full_name ?? "—"}</span>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        {/* Active patient strip */}
        {patient && (
          <div className="border-b bg-primary/5 px-4 md:px-6 py-2 flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">Active patient:</span>
            <span className="font-medium truncate">{patient.full_name}</span>
            <span className="text-muted-foreground hidden sm:inline">· {patient.gender ?? "—"}</span>
            <button
              className="ml-auto text-muted-foreground hover:text-foreground"
              onClick={() => clear()}
              title="Clear active patient"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <main className="flex-1 min-w-0 p-4 md:p-6">{children}</main>
      </div>

      <EndSessionDialog open={endOpen} onOpenChange={setEndOpen} />
    </div>
  );
}

export function useSignOut() {
  const navigate = useNavigate();
  const clear = useActivePatient((s) => s.clear);
  return async () => {
    clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };
}

export function useEnsureAuth() {
  useEffect(() => {}, []);
}
