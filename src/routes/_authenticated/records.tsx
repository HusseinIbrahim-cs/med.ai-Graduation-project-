import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, FilePlus, ChevronDown, ChevronUp, Image as ImageIcon, Pencil } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  createSession,
  editPastSession,
  getXraySignedUrl,
  listSessionsForPatient,
} from "@/lib/sessions.functions";
import { useActivePatient } from "@/store/activePatient";

export const Route = createFileRoute("/_authenticated/records")({
  head: () => ({ meta: [{ title: "Patient Records · MED-AI" }] }),
  component: RecordsPage,
});

function statusBadge(status: string | null) {
  if (!status) return <Badge variant="outline">Pending</Badge>;
  if (status === "baseline_established")
    return <Badge className="bg-primary/15 text-primary border-primary/30" variant="outline">Baseline Established</Badge>;
  if (status === "showing_improvement")
    return <Badge className="bg-[color:var(--color-success)]/15 text-[color:var(--color-success-foreground)] border-[color:var(--color-success)]/40" variant="outline">Showing Improvement</Badge>;
  return <Badge className="bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning-foreground)] border-[color:var(--color-warning)]/40" variant="outline">No Improvement</Badge>;
}

function RecordsPage() {
  const patient = useActivePatient((s) => s.patient);
  const setSessionId = useActivePatient((s) => s.setSessionId);
  const list = useServerFn(listSessionsForPatient);
  const create = useServerFn(createSession);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions", patient?.id],
    queryFn: () => list({ data: { patient_id: patient!.id } }),
    enabled: !!patient,
  });

  const newSessionMut = useMutation({
    mutationFn: () => create({ data: { patient_id: patient!.id } }),
    onSuccess: ({ session }) => {
      setSessionId(session.id);
      qc.invalidateQueries({ queryKey: ["sessions", patient!.id] });
      toast.success("Session started");
      navigate({ to: "/consultation" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!patient) {
    return (
      <div className="max-w-2xl mx-auto mt-10 text-center">
        <Card className="rounded-3xl">
          <CardContent className="py-12">
            <p className="text-muted-foreground">No active patient. Use the search bar above to pick one.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const total = sessions.length;
  const improving = sessions.filter((s) => s.progress_status === "showing_improvement").length;
  const baseline = sessions.filter((s) => s.progress_status === "baseline_established").length;
  const noImp = sessions.filter((s) => s.progress_status === "no_improvement").length;
  const progressPct = total ? Math.round(((improving + baseline) / total) * 100) : 0;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Active patient header */}
      <Card className="rounded-3xl border-primary/20 bg-card shadow-sm">
        <CardContent className="py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase text-muted-foreground tracking-wider">Active patient</div>
            <h2 className="text-2xl font-semibold mt-1">{patient.full_name}</h2>
            <div className="text-sm text-muted-foreground mt-1">
              {patient.gender ?? "—"} · {patient.age ?? "?"} yrs · {patient.primary_concern ?? "—"}
            </div>
          </div>
          <Button className="rounded-full" onClick={() => newSessionMut.mutate()} disabled={newSessionMut.isPending}>
            <FilePlus className="h-4 w-4 mr-1.5" /> New Session
          </Button>
        </CardContent>
      </Card>

      {/* Treatment status */}
      <Card className="rounded-3xl">
        <CardHeader><CardTitle className="text-lg">Overall treatment progress</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-muted-foreground">{total} session{total === 1 ? "" : "s"}</div>
            <div className="text-sm font-medium">{progressPct}%</div>
          </div>
          <Progress value={progressPct} />
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge variant="outline">Baseline {baseline}</Badge>
            <Badge variant="outline" className="text-[color:var(--color-success-foreground)] border-[color:var(--color-success)]/40">Improving {improving}</Badge>
            <Badge variant="outline" className="text-[color:var(--color-warning-foreground)] border-[color:var(--color-warning)]/40">No improvement {noImp}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card className="rounded-3xl">
        <CardHeader><CardTitle className="text-lg">Clinical timeline</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {sessions.length === 0 && (
            <p className="text-muted-foreground text-sm py-4 text-center">No sessions yet.</p>
          )}
          {sessions.map((s) => (
            <SessionItem key={s.id} session={s} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SessionItem({ session }: { session: any }) {
  const [open, setOpen] = useState(false);
  const [xrayOpen, setXrayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [xrayUrl, setXrayUrl] = useState<string | null>(null);
  const getUrl = useServerFn(getXraySignedUrl);

  async function viewXray() {
    if (!session.xray_image_path) return;
    const { url } = await getUrl({ data: { path: session.xray_image_path } });
    setXrayUrl(url);
    setXrayOpen(true);
  }

  return (
    <div className="rounded-2xl border p-4 bg-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">
            {new Date(session.session_date).toLocaleString()}
          </div>
          <div className="mt-1 flex items-center gap-2">
            {statusBadge(session.progress_status)}
            {session.next_session_time && (
              <Badge variant="outline">Next: {new Date(session.next_session_time).toLocaleDateString()}</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {session.xray_image_path && (
            <Button size="sm" variant="outline" className="rounded-full" onClick={viewXray}>
              <ImageIcon className="h-3.5 w-3.5 mr-1" /> X-Ray
            </Button>
          )}
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
          </Button>
        </div>
      </div>

      {session.summary && (
        <div className="mt-3 text-sm">
          <div className="text-xs font-medium uppercase text-muted-foreground">Summary</div>
          <p className="mt-1">{session.summary}</p>
        </div>
      )}
      {session.soap && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2 text-sm">
          {(["S", "O", "A", "P"] as const).map((k) => (
            <div key={k} className="rounded-xl bg-muted/50 p-2">
              <div className="text-xs font-semibold text-primary">{k}</div>
              <p className="text-xs mt-1">{(session.soap as any)[k] ?? "—"}</p>
            </div>
          ))}
        </div>
      )}
      {session.doctor_notes && (
        <div className="mt-3 text-sm">
          <div className="text-xs font-medium uppercase text-muted-foreground">Doctor notes</div>
          <p>{session.doctor_notes}</p>
        </div>
      )}
      {session.prescribed_medicine && (
        <div className="mt-2 text-sm">
          <div className="text-xs font-medium uppercase text-muted-foreground">Prescribed</div>
          <p>{session.prescribed_medicine}</p>
        </div>
      )}

      {(session.doctor_transcript || session.patient_transcript) && (
        <>
          <button
            className="mt-3 text-xs text-primary inline-flex items-center"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
            View details
          </button>
          {open && (
            <div className="mt-2 space-y-2 text-xs">
              {session.doctor_transcript && (
                <div className="rounded-lg bg-muted/50 p-2">
                  <div className="font-semibold">Doctor transcript</div>
                  <p className="mt-1 whitespace-pre-wrap">{session.doctor_transcript}</p>
                </div>
              )}
              {session.patient_transcript && (
                <div className="rounded-lg bg-muted/50 p-2">
                  <div className="font-semibold">Patient transcript</div>
                  <p className="mt-1 whitespace-pre-wrap">{session.patient_transcript}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Dialog open={xrayOpen} onOpenChange={setXrayOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>X-Ray & AI result</DialogTitle></DialogHeader>
          {xrayUrl && <img src={xrayUrl} alt="x-ray" className="w-full rounded-xl" />}
          {session.xray_top_disease && (
            <div className="mt-2">
              <div className="text-xs uppercase text-muted-foreground">Top finding</div>
              <div className="font-semibold">{session.xray_top_disease}</div>
            </div>
          )}
          {Array.isArray(session.xray_findings) && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {session.xray_findings.map((f: any) => (
                <div key={f.label} className="flex items-center justify-between text-xs">
                  <span>{f.label}</span>
                  <div className="flex items-center gap-2 w-1/2">
                    <Progress value={Math.round(f.confidence * 100)} />
                    <span className="w-10 text-right">{Math.round(f.confidence * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EditSessionDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        session={session}
      />
    </div>
  );
}

function EditSessionDialog({
  open,
  onOpenChange,
  session,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  session: any;
}) {
  const [notes, setNotes] = useState(session.doctor_notes ?? "");
  const [meds, setMeds] = useState(session.prescribed_medicine ?? "");
  const [next, setNext] = useState(
    session.next_session_time ? new Date(session.next_session_time).toISOString().slice(0, 16) : "",
  );
  const edit = useServerFn(editPastSession);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () =>
      edit({
        data: {
          id: session.id,
          doctor_notes: notes,
          prescribed_medicine: meds,
          next_session_time: next ? new Date(next).toISOString() : null,
        },
      }),
    onSuccess: () => {
      toast.success("Session updated");
      qc.invalidateQueries({ queryKey: ["sessions"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit session</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Doctor notes</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Prescribed medicine</Label><Textarea rows={3} value={meds} onChange={(e) => setMeds(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Next session</Label><Input type="datetime-local" value={next} onChange={(e) => setNext(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
