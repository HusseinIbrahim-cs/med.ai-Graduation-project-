import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send, Loader2, Bot, User as UserIcon, KeyRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useActivePatient } from "@/store/activePatient";
import { listSessionsForPatient } from "@/lib/sessions.functions";

export const Route = createFileRoute("/_authenticated/consultation")({
  head: () => ({ meta: [{ title: "Clinical Assistant · MED-AI" }] }),
  component: ConsultationPage,
});

interface Message {
  role: "user" | "model";
  text: string;
}

const SYSTEM_PROMPT_BASE = `You are MED-AI's Clinical Assistant — a careful, evidence-aware medical assistant
that helps a licensed doctor reason about their current patient. Be concise, structured, and reference
findings explicitly. Never invent data. Always remind the doctor that final clinical judgment is theirs.`;

function buildPatientContext(patient: any, sessions: any[]): string {
  if (!patient) return "No active patient is loaded.";
  const lines: string[] = [];
  lines.push("--- ACTIVE PATIENT CONTEXT ---");
  lines.push(`Name: ${patient.full_name}`);
  lines.push(`Age: ${patient.age ?? "?"}  Gender: ${patient.gender ?? "?"}`);
  if (patient.primary_concern) lines.push(`Primary concern: ${patient.primary_concern}`);
  if (sessions?.length) {
    lines.push(`\nPast sessions (${sessions.length}):`);
    sessions.slice(0, 10).forEach((s, i) => {
      lines.push(`\n[Session ${i + 1} — ${new Date(s.session_date ?? s.created_at).toLocaleDateString()}]`);
      if (s.summary) lines.push(`Summary: ${s.summary}`);
      if (s.xray_top_disease) lines.push(`X-ray finding: ${s.xray_top_disease}`);
      if (s.doctor_notes) lines.push(`Doctor notes: ${s.doctor_notes}`);
      if (s.prescribed_medicine) lines.push(`Prescribed: ${s.prescribed_medicine}`);
      if (s.progress_status) lines.push(`Progress: ${s.progress_status}`);
    });
  }
  lines.push("--- END PATIENT CONTEXT ---");
  return lines.join("\n");
}

function ConsultationPage() {
  const patient = useActivePatient((s) => s.patient);
  const list = useServerFn(listSessionsForPatient);
  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions", patient?.id],
    queryFn: () => list({ data: { patient_id: patient!.id } }),
    enabled: !!patient,
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setApiKey(localStorage.getItem("geminiApiKey"));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text) return;
    const key = localStorage.getItem("geminiApiKey");
    if (!key) {
      toast.error("Add your Gemini API key in Settings first");
      return;
    }
    const nextMessages: Message[] = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const systemInstruction =
        SYSTEM_PROMPT_BASE + "\n\n" + buildPatientContext(patient, sessions);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: nextMessages.map((m) => ({
              role: m.role,
              parts: [{ text: m.text }],
            })),
          }),
        },
      );
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Gemini error ${res.status}: ${errBody.slice(0, 200)}`);
      }
      const json = await res.json();
      const reply: string =
        json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ??
        "(no response)";
      setMessages([...nextMessages, { role: "model", text: reply }]);
    } catch (e: any) {
      toast.error(e.message ?? "Chat request failed");
      setMessages([
        ...nextMessages,
        { role: "model", text: `⚠️ ${e.message ?? "Request failed"}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto h-[calc(100vh-10rem)] flex flex-col">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" /> Clinical assistant
        </h1>
        <p className="text-sm text-muted-foreground">
          {patient
            ? `Asking about ${patient.full_name} — past sessions and findings are loaded into context.`
            : "No active patient — open Patient Records to choose one for patient-specific answers."}
        </p>
      </div>

      {!apiKey && (
        <Card className="rounded-2xl border-dashed border-primary/40 bg-primary/5">
          <CardContent className="py-4 flex items-center gap-3">
            <KeyRound className="h-5 w-5 text-primary" />
            <div className="text-sm flex-1">
              Add your Gemini API key in Settings to chat with the assistant.
            </div>
            <Link to="/settings">
              <Button size="sm" variant="outline" className="rounded-full">
                Open Settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl flex-1 flex flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-12">
              Ask anything about this patient — e.g. <em>"Summarize their progress"</em> or{" "}
              <em>"What differentials should I consider?"</em>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {m.role === "user" ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div
                className={`rounded-2xl px-4 py-2.5 max-w-[80%] text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl px-4 py-2.5 bg-muted text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
              </div>
            </div>
          )}
        </div>
        <div className="border-t p-3 flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask the clinical assistant…"
            rows={2}
            className="resize-none rounded-2xl"
            disabled={loading}
          />
          <Button
            onClick={send}
            disabled={loading || !input.trim()}
            className="rounded-full self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
