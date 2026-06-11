import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Activity } from "lucide-react";
import { searchPatients } from "@/lib/patients.functions";
import { useActivePatient } from "@/store/activePatient";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/welcome")({
  head: () => ({ meta: [{ title: "Welcome · MED-AI" }] }),
  component: WelcomePage,
});

function WelcomePage() {
  const navigate = useNavigate();
  const search = useServerFn(searchPatients);
  const [q, setQ] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["welcome-search", q],
    queryFn: () => search({ data: { q } }),
    enabled: q.length > 0,
  });
  const setPatient = useActivePatient((s) => s.setPatient);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
      <div className="h-16 w-16 rounded-3xl bg-primary text-primary-foreground flex items-center justify-center mb-5">
        <Activity className="h-8 w-8" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">Welcome to MED-AI</h1>
      <p className="text-muted-foreground mt-2">Search for a patient to start.</p>
      <div className="relative w-full mt-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          autoFocus
          placeholder="Search patient by name or ID..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-12 h-14 rounded-full text-base shadow-sm"
        />
      </div>
      {q && (
        <div className="w-full mt-4 rounded-2xl border bg-card overflow-hidden">
          {data.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No matches</div>
          ) : (
            data.map((p) => (
              <button
                key={p.id}
                className="w-full text-left p-4 hover:bg-accent border-b last:border-0 flex items-center justify-between"
                onClick={() => {
                  setPatient({ id: p.id, full_name: p.full_name, age: p.age, gender: p.gender, primary_concern: p.primary_concern });
                  navigate({ to: "/records" });
                }}
              >
                <div>
                  <div className="font-medium">{p.full_name}</div>
                  <div className="text-xs text-muted-foreground">{p.gender ?? "—"} · {p.age ?? "?"}</div>
                </div>
                {p.patient_code && <span className="text-xs text-muted-foreground">{p.patient_code}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
