import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Mic, Square, Loader2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { updateSessionAiData } from "@/lib/sessions.functions";
import { useActivePatient } from "@/store/activePatient";

const WEBHOOK = "https://61f15548.kube-ops.com/webhook/1d39a0c7-c2f3-4eab-9ff0-1aa745bfeaa6";

export const Route = createFileRoute("/_authenticated/consultation")({
  head: () => ({ meta: [{ title: "Clinical Assistant · MED-AI" }] }),
  component: ConsultationPage,
});

function ConsultationPage() {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);
  const sessionId = useActivePatient((s) => s.sessionId);
  const update = useServerFn(updateSessionAiData);
  const navigate = useNavigate();

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => chunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: chunks.current[0]?.type || "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        await sendToWebhook(blob);
      };
      mr.start();
      recorder.current = mr;
      setRecording(true);
    } catch (e: any) {
      toast.error(e.message ?? "Could not start recording");
    }
  }

  function stop() {
    recorder.current?.stop();
    setRecording(false);
  }

  async function sendToWebhook(blob: Blob) {
    if (!sessionId) {
      toast.error("Start a session first (open Patient Records → New Session)");
      return;
    }
    setProcessing(true);
    try {
      const form = new FormData();
      form.append("file", blob, "recording.webm");
      const res = await fetch(WEBHOOK, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
      const json = await res.json();
      // Expected: [{output},{S,O,A,P},{doctor,topic,confidence}]
      const summary = json?.[0]?.output ?? null;
      const soap = json?.[1] ?? null;
      await update({
        data: {
          id: sessionId,
          summary,
          soap,
        },
      });
      toast.success("Session AI data saved");
      navigate({ to: "/summary" });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to process recording");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clinical assistant</h1>
        <p className="text-sm text-muted-foreground">Record the consultation; AI extracts SOAP notes and a summary.</p>
      </div>

      <Card className="rounded-3xl">
        <CardHeader><CardTitle className="text-lg">Session recording</CardTitle></CardHeader>
        <CardContent className="flex flex-col items-center py-10 gap-4">
          <div className={`h-28 w-28 rounded-full flex items-center justify-center transition-all ${
            recording ? "bg-destructive/20 animate-pulse" : "bg-primary/10"
          }`}>
            <Mic className={`h-10 w-10 ${recording ? "text-destructive" : "text-primary"}`} />
          </div>
          <div className="flex gap-3">
            {!recording && !processing && (
              <Button className="rounded-full" onClick={start}>
                <Mic className="h-4 w-4 mr-1.5" /> Start recording
              </Button>
            )}
            {recording && (
              <Button variant="destructive" className="rounded-full" onClick={stop}>
                <Square className="h-4 w-4 mr-1.5" /> Stop & process
              </Button>
            )}
            {processing && (
              <Button disabled className="rounded-full">
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Processing…
              </Button>
            )}
          </div>
          {audioUrl && !processing && (
            <audio src={audioUrl} controls className="mt-2 w-full max-w-md" />
          )}
          {!sessionId && (
            <p className="text-xs text-muted-foreground">Tip: start a new session from Patient Records first.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
