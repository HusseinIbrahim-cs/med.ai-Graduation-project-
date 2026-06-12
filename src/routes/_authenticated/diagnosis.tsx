import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Loader2, Stethoscope, Paperclip } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { analyzeXray, type XrayPrediction } from "@/lib/xrayApi";
import { supabase } from "@/integrations/supabase/client";
import { attachXrayToSession } from "@/lib/sessions.functions";
import { useActivePatient } from "@/store/activePatient";

export const Route = createFileRoute("/_authenticated/diagnosis")({
  head: () => ({ meta: [{ title: "AI Diagnosis · MED-AI" }] }),
  component: DiagnosisPage,
});

function DiagnosisPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<XrayPrediction | null>(null);
  const sessionId = useActivePatient((s) => s.sessionId);
  const attach = useServerFn(attachXrayToSession);

  const analyze = useMutation({
    mutationFn: (f: File) => analyzeXray(f),
    onSuccess: (r) => setResult(r),
    onError: (e: Error) => toast.error(e.message),
  });

  const onDrop = useCallback((files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    analyze.mutate(f);
  }, [analyze]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: false,
  });

  const attachMut = useMutation({
    mutationFn: async () => {
      if (!sessionId || !file || !result) throw new Error("Need active session and result");
      const path = `${sessionId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("xray-images").upload(path, file, { upsert: false });
      if (error) throw new Error(error.message);
      await attach({
        data: {
          session_id: sessionId,
          xray_image_path: path,
          xray_top_disease: result.topDisease,
          xray_findings: result.findings,
        },
      });
    },
    onSuccess: () => toast.success("Attached to session"),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Stethoscope className="h-6 w-6 text-primary" /> AI Diagnosis · Chest X-Ray
        </h1>
        <p className="text-sm text-muted-foreground">Upload an X-ray to analyze.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-3xl">
          <CardHeader><CardTitle className="text-lg">Upload</CardTitle></CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
                isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
            >
              <input {...getInputProps()} />
              {preview ? (
                <img src={preview} alt="preview" className="mx-auto max-h-72 rounded-xl" />
              ) : (
                <>
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="mt-3 text-sm">Drag & drop an X-ray here, or click to browse</p>
                </>
              )}
            </div>
            {result?.imageUrl && (
              <div className="mt-4">
                <div className="text-xs uppercase text-muted-foreground mb-2">Grad-CAM heatmap</div>
                <img
                  src={result.imageUrl}
                  alt="Grad-CAM visualization"
                  className="mx-auto max-h-72 rounded-xl border"
                />
              </div>
            )}
            {file && (
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="truncate">{file.name}</span>
                {sessionId && result && (
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => attachMut.mutate()} disabled={attachMut.isPending}>
                    <Paperclip className="h-3.5 w-3.5 mr-1" /> Attach to session
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader><CardTitle className="text-lg">Findings</CardTitle></CardHeader>
          <CardContent>
            {analyze.isPending && (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Analyzing…
              </div>
            )}
            {result && (
              <div>
                <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4 mb-4">
                  <div className="text-xs uppercase text-muted-foreground">Top prediction</div>
                  <div className="text-xl font-semibold mt-1">{result.topDisease}</div>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                  {result.findings.map((f) => (
                    <div key={f.label}>
                      <div className="flex items-center justify-between text-sm">
                        <span>{f.label}</span>
                        <span className="text-muted-foreground">{Math.round(f.confidence * 100)}%</span>
                      </div>
                      <Progress value={Math.round(f.confidence * 100)} className="mt-1" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!analyze.isPending && !result && (
              <p className="text-muted-foreground text-sm text-center py-12">Upload an image to see results.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
