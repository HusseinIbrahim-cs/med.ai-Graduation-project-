
# MED-AI Implementation Plan

## 1. Backend (Lovable Cloud / Supabase)

Enable Lovable Cloud, then apply one migration:

**Enums & tables**
- `app_role` enum: `admin`, `doctor`, `patient`
- `progress_status` enum: `baseline_established`, `showing_improvement`, `no_improvement`
- `profiles` (id uuid PK -> auth.users, full_name, email, patient_code text unique nullable, is_active bool, created_at)
- `user_roles` (id, user_id, role) — separate table for security
- `patients` (id uuid PK, full_name, age int, gender, primary_concern, created_by uuid, created_at)
- `sessions` (id, patient_id FK, session_date, insurance_provider, progress_status enum, next_session_time, doctor_notes, prescribed_medicine, summary, soap jsonb, doctor_transcript, patient_transcript, xray_image_path, xray_top_disease, xray_findings jsonb, created_by, created_at)
- Storage bucket `xray-images` (private)

**Security**
- `has_role(uuid, app_role)` SECURITY DEFINER function
- RLS on all tables; GRANTs to authenticated + service_role
- Admins: full CRUD on profiles/patients/sessions
- Doctors: read all patients/sessions, insert/update sessions
- Patients: read only their own patient row + sessions (matched via `profiles.patient_code` ↔ a `patient_id` link on profile)
- Storage policies on `xray-images` bucket for authenticated roles

**Seed**
- Migration seeds admin auth user `admin@med.ai.com` / `password2004` via `auth.users` insert + assigns `admin` role

## 2. Authentication

- `/auth` page with **Staff / Patient** toggle
  - Staff: email + password (Supabase email/password)
  - Patient: Patient ID (code) + PIN — resolves code to synthetic email `patient-<code>@medai.local`, then password sign-in
- Integration-managed `_authenticated/route.tsx` gate
- Post-login redirect by role (server fn returns role):
  - admin → `/admin`
  - doctor → `/welcome`
  - patient → `/records` (sidebar limited to Patient Records + Clinical Assistant)

## 3. Routes

```
src/routes/
  index.tsx              -> redirect to /auth or by role
  auth.tsx               -> Staff/Patient login toggle
  _authenticated/
    route.tsx            -> managed gate
    admin.tsx            -> Admin dashboard (manage users + patients)
    welcome.tsx          -> Doctor welcome w/ central search
    records.tsx          -> Patient Records (active patient required)
    diagnosis.tsx        -> AI Chest X-Ray
    consultation.tsx     -> Clinical Assistant (audio recording + NLP)
    summary.tsx          -> Consultation Summary (post-recording results)
    settings.tsx         -> Profile/Settings
```

## 4. Shared Layout

- `AppShell`: left sidebar (role-filtered) + top header (logo, patient search, End Session, notifications, user, Sign Out)
- `ActivePatientContext` (Zustand or React context) — holds selected patient across routes; header search uses server fn `searchPatients` and `setActivePatient`
- "End Session" only enabled when an active session exists in context

## 5. Server Functions (`src/lib/*.functions.ts`)

- `auth.functions.ts`: `getMyRole`, `signOut`
- `patients.functions.ts`: `listPatients`, `searchPatients(q)`, `createPatient`, `getPatient(id)`
- `sessions.functions.ts`: `listSessionsForPatient`, `createSession` (returns id; sets progress to `baseline_established` silently if first), `updateSessionAiData`, `updateSessionWrapUp`, `editPastSession`
- `admin.functions.ts`: `createDoctor`, `createPatientUser` (creates auth user + profile + role, links patient_code), `deactivateUser`
- `xray.functions.ts`: `uploadXrayImage` → returns storage path; `attachXrayToSession`
- All privileged ones use `requireSupabaseAuth` + `has_role` check; admin-only load `client.server` inside handler

## 6. Feature Pages

**Admin Dashboard**
- Tabs: Users (doctors+patients) and Patients
- "New Patient" modal (Full Name, Age, Gender, Primary Concern) → calls `createPatient`, sets active, navigates to `/records`
- "New Doctor" / "New Patient User" modals for account creation
- Activate/deactivate toggles

**Doctor Welcome (`/welcome`)**
- Large central search bar → on select, set active patient → navigate `/records`

**Patient Records (`/records`)**
- Active patient header card
- "New Session" button → creates session row, navigates to `/consultation` keeping context
- Treatment Status card (counts by `progress_status`)
- Clinical Timeline: list of past sessions
  - Renders `summary` + `soap` (S/O/A/P)
  - "View Details" expander → shows `doctor_transcript` + `patient_transcript`
  - "View X-Ray & Result" button (if `xray_image_path`) → modal with signed URL image + findings/top disease
  - "Edit Session" modal: doctor_notes, prescribed_medicine, next_session_time

**AI Diagnosis (`/diagnosis`)**
- Drag & drop uploader (react-dropzone)
- `src/lib/xrayApi.ts` using `@gradio/client` (exact code provided)
- On result: top disease card + findings list with confidence bars
- "Attach to current session": uploads to `xray-images` bucket, calls `attachXrayToSession` with path + results JSON
- (Grad-CAM overlay: if Space returns a heatmap image, display side-by-side; otherwise show original + findings only — current API contract doesn't include heatmap, will show findings overlay UI placeholder)

**Clinical Assistant / Consultation (`/consultation`)**
- MediaRecorder Record/Stop buttons
- On stop: POST audio blob to `https://61f15548.kube-ops.com/webhook/1d39a0c7-c2f3-4eab-9ff0-1aa745bfeaa6` (multipart form)
- Parse JSON array: `summary` = item[0].output, `soap` = item[1], extras stored in soap jsonb
- Navigate to `/summary` showing SOAP + transcripts

**End Session flow** (header button)
- Saves AI data (summary/soap/transcripts) to current session via `updateSessionAiData`
- Opens Wrap-Up modal:
  - Textareas: doctor_notes, prescribed_medicine
  - Datetime picker: next_session_time
  - If session count for patient > 1 (excluding this): radio (Showing Improvement / No Improvement) — required
  - Else: progress silently set to Baseline Established (no UI)
- Save → `updateSessionWrapUp` → clear active session, navigate `/records`

## 7. Design System

- Tailwind v4 tokens in `src/styles.css`:
  - Primary: soft mint/teal (oklch tuned)
  - Background: white/very light mint
  - Foreground: dark gray
  - Accent badge colors (success/info/warn)
- Rounded cards (`rounded-2xl`), soft shadows, generous spacing
- Pill `Badge` variants: baseline (mint), improving (green), no-improvement (amber), info
- shadcn components: card, button, input, dialog, tabs, badge, sidebar, sonner, progress, radio-group, textarea, popover+calendar (datepicker)

## 8. Packages to add

- `@gradio/client`
- (everything else already in template)

## 9. Out of scope (will mock/placeholder)
- Real-time notifications (icon present, no backend)
- Insurance provider source list (free text)
- Grad-CAM heatmap (depends on Space output; will surface if present, else findings-only)

## Technical Notes

- Patient login resolves Patient ID → `profiles.patient_code` via a public RPC `get_email_for_patient_code(text)` (SECURITY DEFINER, returns auth email) so client can call `signInWithPassword({email, password: pin})`.
- All audio/X-ray uploads stream through server fns; service role used only inside handlers via `await import('@/integrations/supabase/client.server')`.
- Active patient kept in Zustand persisted to `sessionStorage` so refresh keeps context but logout clears.
- `attachSupabaseAuth` confirmed in `src/start.ts`.

Ready to switch to build mode and implement.
