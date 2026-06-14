import { useEffect, useRef } from "react";
import { Mic, Square, Loader2, Send, RotateCcw } from "lucide-react";
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
  const { recording, processing, audioUrl, blob } = audio;

  const chunks = useRef<Blob[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const sessionId = useActivePatient((s) => s.sessionId);
  const patient = useActivePatient((s) => s.patient);
  const update = useServerFn(updateSessionAiData);
  const qc = useQueryClient();

  useEffect(() => {
    return () => {
      stopVisualizer();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startVisualizer(stream: MediaStream) {
    const AC = (window.AudioContext ||
      (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new AC();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
    sourceRef.current = source;
    draw();
  }

  function stopVisualizer() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    try {
      sourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      audioCtxRef.current?.close();
    } catch {}
    sourceRef.current = null;
    analyserRef.current = null;
    audioCtxRef.current = null;
    const canvas = canvasRef.current;
    const c = canvas?.getContext("2d");
    if (canvas && c) c.clearRect(0, 0, canvas.width, canvas.height);
  }

  function draw() {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const buf = new Uint8Array(analyser.fftSize);
    const w = canvas.width;
    const h = canvas.height;
    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      analyser.getByteTimeDomainData(buf);
      ctx.clearRect(0, 0, w, h);
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "rgba(37, 99, 235, 0.9)");
      grad.addColorStop(1, "rgba(20, 184, 166, 0.9)");
      ctx.lineWidth = 2;
      ctx.strokeStyle = grad;
      ctx.beginPath();
      const slice = w / buf.length;
      let x = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = buf[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += slice;
      }
      ctx.lineTo(w, h / 2);
      ctx.stroke();
    };
    render();
  }

  async function start() {
    try {
      // Reset previous draft
      setAudio({ blob: null, audioUrl: null, summary: null, soap: null });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunks.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => chunks.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        stopVisualizer();
        const b = new Blob(chunks.current, { type: chunks.current[0]?.type || "audio/webm" });
        setAudio({ blob: b, audioUrl: URL.createObjectURL(b), recording: false });
      };
      mr.start();
      recorder.current = mr;
      setAudio({ recording: true });
      startVisualizer(stream);
    } catch (e: any) {
      toast.error(e.message ?? "Could not start recording");
    }
  }

  function stop() {
    recorder.current?.stop();
  }

  function reset() {
    setAudio({ blob: null, audioUrl: null, summary: null, soap: null });
  }

  async function sendToWebhook() {
    if (!blob) return;
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
    <Card className="rounded-3xl bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Session recording</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center py-8 gap-4">
        <div
          className={`h-24 w-24 rounded-full flex items-center justify-center transition-all ${
            recording ? "bg-destructive/15 animate-pulse" : "bg-primary/10"
          }`}
        >
          <Mic className={`h-9 w-9 ${recording ? "text-destructive" : "text-primary"}`} />
        </div>

        <canvas
          ref={canvasRef}
          width={640}
          height={80}
          className={`w-full max-w-md rounded-xl bg-muted/50 ${recording ? "opacity-100" : "opacity-40"}`}
        />

        <div className="flex flex-wrap gap-3 justify-center">
          {!recording && !processing && !blob && (
            <Button className="rounded-full" onClick={start}>
              <Mic className="h-4 w-4 mr-1.5" /> Start recording
            </Button>
          )}
          {recording && (
            <Button variant="destructive" className="rounded-full" onClick={stop}>
              <Square className="h-4 w-4 mr-1.5" /> Stop
            </Button>
          )}
          {!recording && blob && !processing && (
            <>
              <Button className="rounded-full" onClick={sendToWebhook}>
                <Send className="h-4 w-4 mr-1.5" /> Send to AI for Summary
              </Button>
              <Button variant="outline" className="rounded-full" onClick={reset}>
                <RotateCcw className="h-4 w-4 mr-1.5" /> Re-record
              </Button>
            </>
          )}
          {processing && (
            <Button disabled className="rounded-full">
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Processing…
            </Button>
          )}
        </div>

        {audioUrl && !recording && (
          <audio src={audioUrl} controls className="mt-2 w-full max-w-md" />
        )}
        {!sessionId && (
          <p className="text-xs text-muted-foreground">
            Tip: start a new session from Patient Records first.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
