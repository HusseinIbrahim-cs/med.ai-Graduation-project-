import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, CalendarClock, FileText, Image as ImageIcon, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getMyRole } from "@/lib/auth.functions";
import { getMyPatientDashboard } from "@/lib/patientSelf.functions";
import { getXraySignedUrl } from "@/lib/sessions.functions";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/patient")({
  head: () => ({ meta: [{ title: "My Health · MED-AI" }] }),
  component: PatientDashboard,
});

function statusBadge(status: string | null) {
  if (!status) return <Badge variant="outline">Pending</Badge>;
  if (status === "baseline_established")
    return <Badge variant="outline" className="bg-primary/15 text-primary border-primary/30">Baseline</Badge>;
  if (status === "showing_improvement")
    return <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300">Improving</Badge>;
  return <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">No change</Badge>;
}

function PatientDashboard() {
  const navigate = useNavigate();
  const getRole = useServerFn(getMyRole);
  const dash = useServerFn(getMyPatientDashboard);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getRole() });
  useEffect(() => {
    if (me && me.role && me.role !== "patient") {
      navigate({ to: me.role === "admin" ? "/admin" : "/welcome" });
    }
  }, [me, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["my-patient-dashboard"],
    queryFn: () => dash(),
  });

  const sessions = data?.sessions ?? [];
  const patient = data?.patient;
  const total = sessions.length;
  const improving = sessions.filter((s: any) => s.progress_status === "showing_improvement").length;
  const baseline = sessions.filter((s: any) => s.progress_status === "baseline_established").length;
  const pct = total ? Math.round(((improving + baseline) / total) * 100) : 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="rounded-3xl border-primary/20 bg-gradient-to-br from-sky-50/80 via-white/60 to-emerald-50/80 backdrop-blur">
        <CardContent className="py-6 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Welcome back</div>
            <h1 className="text-2xl md:text-3xl font-semibold mt-1 truncate">
              {patient?.full_name ?? data?.profile?.full_name ?? "Patient"}
            </h1>
            <div className="text-sm text-muted-foreground mt-1">
              {patient?.gender ?? "—"} · {patient?.age ?? "?"} yrs
              {patient?.primary_concern ? ` · ${patient.primary_concern}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2 text-primary">
            <Activity className="h-8 w-8" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Treatment progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-muted-foreground">
              {total} session{total === 1 ? "" : "s"}
            </div>
            <div className="text-sm font-medium">{pct}%</div>
          </div>
          <Progress value={pct} />
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge variant="outline">Total {total}</Badge>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
              Baseline {baseline}
            </Badge>
            <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300">
              Improving {improving}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Clinical history
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && sessions.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No clinical sessions yet. Check back after your first visit.
            </p>
          )}
          {sessions.map((s: any) => (
            <PatientSessionItem key={s.id} session={s} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function PatientSessionItem({ session }: { session: any }) {
  const getUrl = useServerFn(getXraySignedUrl);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  async function view() {
    if (!session.xray_image_path) return;
    const { url } = await getUrl({ data: { path: session.xray_image_path } });
    setUrl(url);
    setOpen(true);
  }

  return (
    <div className="rounded-2xl border p-4 bg-card/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            {new Date(session.session_date ?? session.created_at).toLocaleString()}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {statusBadge(session.progress_status)}
            {session.next_session_time && (
              <Badge variant="outline">
                Next: {new Date(session.next_session_time).toLocaleDateString()}
              </Badge>
            )}
          </div>
        </div>
        {session.xray_image_path && (
          <Button size="sm" variant="outline" className="rounded-full" onClick={view}>
            <ImageIcon className="h-3.5 w-3.5 mr-1" /> X-Ray
          </Button>
        )}
      </div>

      {session.summary && (
        <div className="mt-3 text-sm">
          <div className="text-xs font-medium uppercase text-muted-foreground">AI Summary</div>
          <p className="mt-1">{session.summary}</p>
        </div>
      )}
      {session.xray_top_disease && (
        <div className="mt-2 text-sm">
          <div className="text-xs font-medium uppercase text-muted-foreground">X-Ray finding</div>
          <p className="mt-1">{session.xray_top_disease}</p>
        </div>
      )}
      {session.prescribed_medicine && (
        <div className="mt-2 text-sm">
          <div className="text-xs font-medium uppercase text-muted-foreground">Prescribed</div>
          <p className="mt-1 whitespace-pre-wrap">{session.prescribed_medicine}</p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>X-Ray</DialogTitle>
          </DialogHeader>
          {url && <img src={url} alt="x-ray" className="w-full rounded-xl" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
