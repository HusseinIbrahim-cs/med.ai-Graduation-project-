import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, UserPlus, Shield, Power } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { listUsers, createDoctor, setUserActive } from "@/lib/admin.functions";
import { listPatients, createPatient } from "@/lib/patients.functions";
import { useActivePatient } from "@/store/activePatient";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin · MED-AI" }] }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin dashboard</h1>
        <p className="text-muted-foreground text-sm">Manage clinical staff and patients.</p>
      </div>
      <Tabs defaultValue="patients">
        <TabsList className="rounded-full bg-muted/60">
          <TabsTrigger value="patients" className="rounded-full">Patients</TabsTrigger>
          <TabsTrigger value="users" className="rounded-full">Users</TabsTrigger>
        </TabsList>
        <TabsContent value="patients" className="mt-4"><PatientsPanel /></TabsContent>
        <TabsContent value="users" className="mt-4"><UsersPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function PatientsPanel() {
  const list = useServerFn(listPatients);
  const { data = [] } = useQuery({ queryKey: ["patients"], queryFn: () => list() });
  return (
    <Card className="rounded-3xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">All patients</CardTitle>
        <NewPatientDialog />
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {data.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">No patients yet</p>
          )}
          {data.map((p) => (
            <div key={p.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{p.full_name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.gender ?? "—"} · {p.age ?? "?"} · {p.primary_concern ?? ""}
                </div>
              </div>
              {p.phone_number && <Badge variant="secondary">{p.phone_number}</Badge>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function NewPatientDialog({ trigger }: { trigger?: React.ReactNode } = {}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    age: "",
    gender: "",
    primary_concern: "",
    phone_number: "",
    pin: "",
  });
  const create = useServerFn(createPatient);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const setPatient = useActivePatient((s) => s.setPatient);

  const mut = useMutation({
    mutationFn: () =>
      create({
        data: {
          full_name: form.full_name,
          age: Number(form.age),
          gender: form.gender,
          primary_concern: form.primary_concern,
          phone_number: form.phone_number,
          pin: form.pin,
        },
      }),
    onSuccess: (row) => {
      toast.success("Patient created");
      qc.invalidateQueries({ queryKey: ["patients"] });
      setPatient({
        id: row.id,
        full_name: row.full_name,
        age: row.age,
        gender: row.gender,
        primary_concern: row.primary_concern,
      });
      setOpen(false);
      navigate({ to: "/records" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="rounded-full">
            <Plus className="h-4 w-4 mr-1.5" />New Patient
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New patient</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone number</Label>
              <Input
                value={form.phone_number}
                onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                placeholder="e.g. +1 555 123 4567"
              />
            </div>
            <div className="space-y-1.5">
              <Label>PIN (4-6 digits)</Label>
              <Input
                inputMode="numeric"
                value={form.pin}
                onChange={(e) =>
                  setForm({ ...form, pin: e.target.value.replace(/[^0-9]/g, "").slice(0, 6) })
                }
                placeholder="e.g. 1234"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">
            The patient will sign in with their phone number and this PIN.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Age</Label>
              <Input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Primary concern</Label>
            <Textarea rows={3} value={form.primary_concern} onChange={(e) => setForm({ ...form, primary_concern: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UsersPanel() {
  const list = useServerFn(listUsers);
  const setActive = useServerFn(setUserActive);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["users"], queryFn: () => list() });
  const toggleMut = useMutation({
    mutationFn: (vars: { user_id: string; is_active: boolean }) => setActive({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <NewDoctorDialog />
      </div>
      <Card className="rounded-3xl">
        <CardHeader><CardTitle className="text-lg">Users</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y">
            {data.map((u: any) => (
              <div key={u.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{u.full_name || "(no name)"}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {u.email}{u.phone_number ? ` · ${u.phone_number}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {u.roles.map((r: string) => (
                    <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>
                      {r === "admin" && <Shield className="h-3 w-3 mr-1" />}
                      {r}
                    </Badge>
                  ))}
                  {!u.roles.includes("admin") && (
                    <Button
                      size="sm"
                      variant={u.is_active ? "outline" : "default"}
                      className="rounded-full"
                      onClick={() => toggleMut.mutate({ user_id: u.id, is_active: !u.is_active })}
                    >
                      <Power className="h-3 w-3 mr-1" />
                      {u.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NewDoctorDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", phone_number: "" });
  const create = useServerFn(createDoctor);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => create({ data: form }),
    onSuccess: () => {
      toast.success("Doctor created");
      qc.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
      setForm({ full_name: "", email: "", password: "", phone_number: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-full"><UserPlus className="h-4 w-4 mr-1.5" />New Doctor</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add doctor</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Phone number</Label><Input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="e.g. +1 555 123 4567" /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Temporary password</Label><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
