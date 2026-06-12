import { useRef } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { updateSessionAiData } from "@/lib/sessions.functions";
import { useActivePatient } from "@/store/activePatient";
import { useSessionStore } from "@/store/sessionDraft";
import { useQueryClient } from "@tanstack/react-query";

const WEBHOOK = "https://61f15548.kube-ops.com/webhook/1d39a0c7-c2f3-4eab-9ff0-1aa745bfeaa6";

export function AudioRecorder() {
  const audio = useSessionStore((s) => s.audio);
  const setAudio = useSessionStore((s) => s.setAudio);
  const { recording, processing, audioUrl } = audio;

  const chunks = useRef<Blob[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);
  const sessionId = useActivePatient((s) => s.sessionId);
  const patient = useActivePatient((s) => s.patient);
  const update = useServerFn(updateSessionAiData);
  const qc = useQueryClient();

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => chunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: chunks.current[0]?.type || "audio/webm" });
        setAudio({ blob, audioUrl: URL.createObjectURL(blob) });
        await sendToWebhook(blob);
      };
      mr.start();
      recorder.current = mr;
      setAudio({ recording: true });
    } catch (e: any) {
      toast.error(e.message ?? "Could not start recording");
    }
  }

  function stop() {
    recorder.current?.stop();
    setAudio({ recording: false });
  }

  async function sendToWebhook(blob: Blob) {
    if (!sessionId) {
      toast.error("Start a session first (open Patient Records → New Session)");
      return;
    }
    setAudio({ processing: true });
    try {
      const form = new FormData();
      form.append("file", blob, "recording.webm");
      const res = await fetch(WEBHOOK, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
      const json = await res.json();
      const summary = json?.[0]?.output ?? null;
      const soap = json?.[1] ?? null;
      setAudio({ summary, soap });
      await update({ data: { id: sessionId, summary, soap } });
      toast.success("Session AI data saved");
      qc.invalidateQueries({ queryKey: ["sessions", patient?.id] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to process recording");
    } finally {
      setAudio({ processing: false });
    }
  }

  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle className="text-lg">Session recording</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center py-10 gap-4">
        <div
          className={`h-28 w-28 rounded-full flex items-center justify-center transition-all ${
            recording ? "bg-destructive/20 animate-pulse" : "bg-primary/10"
          }`}
        >
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
        {audioUrl && !processing && <audio src={audioUrl} controls className="mt-2 w-full max-w-md" />}
        {!sessionId && (
          <p className="text-xs text-muted-foreground">
            Tip: start a new session from Patient Records first.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
