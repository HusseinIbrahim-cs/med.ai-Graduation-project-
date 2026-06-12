import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useActivePatient } from "@/store/activePatient";
import { useSessionStore } from "@/store/sessionDraft";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { updateSessionWrapUp } from "@/lib/sessions.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function EndSessionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const sessionId = useActivePatient((s) => s.sessionId);
  const patient = useActivePatient((s) => s.patient);
  const setSessionId = useActivePatient((s) => s.setSessionId);
  const qc = useQueryClient();

  const wrapUp = useSessionStore((s) => s.wrapUp);
  const setWrapUp = useSessionStore((s) => s.setWrapUp);
  const resetDraft = useSessionStore((s) => s.resetDraft);
  const { notes, meds, nextTime } = wrapUp;
  const [status, setStatus] = useState<"showing_improvement" | "no_improvement" | "">("");
  const [needsStatus, setNeedsStatus] = useState(false);

  const wrap = useServerFn(updateSessionWrapUp);

  // When opening, check if this is patient's first session (count > 1 means status required)
  async function onOpenChangeWrapper(o: boolean) {
    if (o && patient) {
      const { count } = await supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .eq("patient_id", patient.id);
      setNeedsStatus((count ?? 0) > 1);
    }
    onOpenChange(o);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error("No active session");
      if (needsStatus && !status) throw new Error("Select a progress status");
      await wrap({
        data: {
          id: sessionId,
          doctor_notes: notes,
          prescribed_medicine: meds,
          next_session_time: nextTime ? new Date(nextTime).toISOString() : null,
          progress_status: needsStatus ? (status as "showing_improvement" | "no_improvement") : null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Session saved");
      setSessionId(null);
      qc.invalidateQueries({ queryKey: ["sessions"] });
      onOpenChange(false);
      resetDraft();
      setStatus("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChangeWrapper}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Wrap-up session</DialogTitle>
          <DialogDescription>
            Add doctor notes, medications, and schedule the next visit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Doctor notes</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setWrapUp({ notes: e.target.value })}
              placeholder="Clinical observations, follow-ups…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Prescribed medicine</Label>
            <Textarea
              rows={3}
              value={meds}
              onChange={(e) => setWrapUp({ meds: e.target.value })}
              placeholder="Medication, dosage, frequency…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Next session</Label>
            <Input
              type="datetime-local"
              value={nextTime}
              onChange={(e) => setWrapUp({ nextTime: e.target.value })}
            />
          </div>
          {needsStatus && (
            <div className="space-y-2">
              <Label>Progress status</Label>
              <RadioGroup value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="showing_improvement" id="s1" />
                  <Label htmlFor="s1" className="font-normal">Showing improvement</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="no_improvement" id="s2" />
                  <Label htmlFor="s2" className="font-normal">No improvement</Label>
                </div>
              </RadioGroup>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save & End Session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
