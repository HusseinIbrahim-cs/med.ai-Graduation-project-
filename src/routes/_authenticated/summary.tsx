import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listSessionsForPatient } from "@/lib/sessions.functions";
import { useActivePatient } from "@/store/activePatient";
import { useSessionStore } from "@/store/sessionDraft";
import { AudioRecorder } from "@/components/AudioRecorder";

export const Route = createFileRoute("/_authenticated/summary")({
  head: () => ({ meta: [{ title: "Consultation Summary · MED-AI" }] }),
  component: SummaryPage,
});

function SummaryPage() {
  const patient = useActivePatient((s) => s.patient);
  const sessionId = useActivePatient((s) => s.sessionId);
  const draftAudio = useSessionStore((s) => s.audio);
  const list = useServerFn(listSessionsForPatient);
  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions", patient?.id],
    queryFn: () => list({ data: { patient_id: patient!.id } }),
    enabled: !!patient,
  });
  const session = sessions.find((s) => s.id === sessionId) ?? sessions[0];

  const summary = draftAudio.summary ?? session?.summary ?? null;
  const soap = draftAudio.soap ?? session?.soap ?? null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Consultation summary</h1>
        <p className="text-sm text-muted-foreground">
          {patient
            ? `${patient.full_name}${session ? " · " + new Date(session.session_date ?? session.created_at).toLocaleString() : ""}`
            : "No active patient"}
        </p>
      </div>

      <AudioRecorder />

      {!summary && !soap && (
        <Card className="rounded-3xl">
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            No session to summarize yet — record audio above to generate one.
          </CardContent>
        </Card>
      )}

      {summary && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-lg">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{summary}</p>
          </CardContent>
        </Card>
      )}

      {soap && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(["S", "O", "A", "P"] as const).map((k) => (
            <Card key={k} className="rounded-3xl">
              <CardHeader>
                <CardTitle className="text-base">
                  {k === "S" && "Subjective"}
                  {k === "O" && "Objective"}
                  {k === "A" && "Assessment"}
                  {k === "P" && "Plan"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{(soap as any)[k] ?? "—"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
