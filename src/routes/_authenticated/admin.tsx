import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, UserPlus, Shield, Power, Pencil, Trash2, Search } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  listUsers,
  createDoctor,
  createAdmin,
  setUserActive,
  updateUserProfile,
  deleteUser,
} from "@/lib/admin.functions";
import {
  listPatients,
  createPatient,
} from "@/lib/patients.functions";
import { deletePatient, updatePatient } from "@/lib/admin.functions";
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
        <p className="text-muted-foreground text-sm">
          Manage clinical staff and patients.
        </p>
      </div>
      <Tabs defaultValue="users">
        <TabsList className="rounded-full bg-card border shadow-sm">
          <TabsTrigger value="users" className="rounded-full">Users (Patients)</TabsTrigger>
          <TabsTrigger value="doctors" className="rounded-full">Doctors</TabsTrigger>
          <TabsTrigger value="admins" className="rounded-full">Admins</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4"><PatientsPanel /></TabsContent>
        <TabsContent value="doctors" className="mt-4"><RolePanel role="doctor" /></TabsContent>
        <TabsContent value="admins" className="mt-4"><RolePanel role="admin" /></TabsContent>
      </Tabs>
    </div>
  );
}

function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        className="pl-9 rounded-full bg-background"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function PatientsPanel() {
  const list = useServerFn(listPatients);
  const del = useServerFn(deletePatient);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["patients"], queryFn: () => list() });
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return data;
    return data.filter(
      (p: any) =>
        p.full_name?.toLowerCase().includes(t) ||
        p.phone_number?.toLowerCase().includes(t) ||
        p.patient_code?.toLowerCase().includes(t),
    );
  }, [data, q]);

  const delMut = useMutation({
    mutationFn: (patient_id: string) => del({ data: { patient_id } }),
    onSuccess: () => {
      toast.success("Patient deleted");
      qc.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="rounded-3xl bg-card shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="text-lg">Patients</CardTitle>
        <NewPatientDialog />
      </CardHeader>
      <CardContent className="space-y-3">
        <SearchBar value={q} onChange={setQ} placeholder="Search patients..." />
        <div className="divide-y">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">No patients</p>
          )}
          {filtered.map((p: any) => (
            <div key={p.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{p.full_name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {p.gender ?? "—"} · {p.age ?? "?"} · {p.phone_number ?? "—"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <EditPatientButton patient={p} />
                <DeleteButton
                  label={p.full_name}
                  onConfirm={() => delMut.mutate(p.id)}
                />
              </div>
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
      navigate({ to: "/admin" });
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
              <Input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="e.g. +1 555 123 4567" />
            </div>
            <div className="space-y-1.5">
              <Label>PIN</Label>
              <Input
                inputMode="numeric"
                value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/[^0-9]/g, "").slice(0, 6) })}
                placeholder="e.g. 1234"
              />
            </div>
          </div>
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

function EditPatientButton({ patient }: { patient: any }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: patient.full_name ?? "",
    age: String(patient.age ?? ""),
    gender: patient.gender ?? "",
    primary_concern: patient.primary_concern ?? "",
    phone_number: patient.phone_number ?? "",
  });
  const upd = useServerFn(updatePatient);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () =>
      upd({
        data: {
          patient_id: patient.id,
          full_name: form.full_name,
          age: Number(form.age) || 0,
          gender: form.gender || "Other",
          primary_concern: form.primary_concern,
          phone_number: form.phone_number,
        },
      }),
    onSuccess: () => {
      toast.success("Patient updated");
      qc.invalidateQueries({ queryKey: ["patients"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-full">
          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit patient</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Age</Label><Input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></div>
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
          <div className="space-y-1.5"><Label>Primary concern</Label><Textarea rows={3} value={form.primary_concern} onChange={(e) => setForm({ ...form, primary_concern: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="rounded-full text-destructive border-destructive/40 hover:bg-destructive/10"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The record will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setOpen(false); onConfirm(); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RolePanel({ role }: { role: "doctor" | "admin" }) {
  const list = useServerFn(listUsers);
  const setActive = useServerFn(setUserActive);
  const del = useServerFn(deleteUser);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["users"], queryFn: () => list() });
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    return (data as any[]).filter((u) => u.roles?.includes(role));
  }, [data, role]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (u: any) =>
        u.full_name?.toLowerCase().includes(t) ||
        u.email?.toLowerCase().includes(t) ||
        u.phone_number?.toLowerCase().includes(t),
    );
  }, [rows, q]);

  const toggleMut = useMutation({
    mutationFn: (vars: { user_id: string; is_active: boolean }) => setActive({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
  const delMut = useMutation({
    mutationFn: (user_id: string) => del({ data: { user_id } }),
    onSuccess: () => {
      toast.success("Account deleted");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="rounded-3xl bg-card shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="text-lg capitalize">{role}s</CardTitle>
        {role === "doctor" ? <NewStaffDialog role="doctor" /> : <NewStaffDialog role="admin" />}
      </CardHeader>
      <CardContent className="space-y-3">
        <SearchBar value={q} onChange={setQ} placeholder={`Search ${role}s...`} />
        <div className="divide-y">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">No {role}s</p>
          )}
          {filtered.map((u: any) => (
            <div key={u.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate flex items-center gap-2">
                  {role === "admin" && <Shield className="h-3.5 w-3.5 text-primary" />}
                  {u.full_name || "(no name)"}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {u.email}{u.phone_number ? ` · ${u.phone_number}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {role !== "admin" && (
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
                <EditUserButton user={u} />
                <DeleteButton label={u.full_name || u.email} onConfirm={() => delMut.mutate(u.id)} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EditUserButton({ user }: { user: any }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: user.full_name ?? "",
    email: user.email ?? "",
    phone_number: user.phone_number ?? "",
  });
  const upd = useServerFn(updateUserProfile);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => upd({ data: { user_id: user.id, ...form } }),
    onSuccess: () => {
      toast.success("Account updated");
      qc.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-full">
          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit account</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewStaffDialog({ role }: { role: "doctor" | "admin" }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", phone_number: "" });
  const createDoc = useServerFn(createDoctor);
  const createAdm = useServerFn(createAdmin);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => (role === "admin" ? createAdm({ data: form }) : createDoc({ data: form })),
    onSuccess: () => {
      toast.success(`${role === "admin" ? "Admin" : "Doctor"} created`);
      qc.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
      setForm({ full_name: "", email: "", password: "", phone_number: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full">
          <UserPlus className="h-4 w-4 mr-1.5" />New {role === "admin" ? "Admin" : "Doctor"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add {role}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Phone number</Label><Input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} /></div>
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
