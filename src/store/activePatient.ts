import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface ActivePatient {
  id: string;
  full_name: string;
  age: number | null;
  gender: string | null;
  primary_concern: string | null;
}

interface State {
  patient: ActivePatient | null;
  sessionId: string | null;
  setPatient: (p: ActivePatient | null) => void;
  setSessionId: (id: string | null) => void;
  clear: () => void;
}

export const useActivePatient = create<State>()(
  persist(
    (set) => ({
      patient: null,
      sessionId: null,
      setPatient: (patient) => set({ patient }),
      setSessionId: (sessionId) => set({ sessionId }),
      clear: () => set({ patient: null, sessionId: null }),
    }),
    {
      name: "medai-active-patient",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? sessionStorage : (undefined as unknown as Storage),
      ),
    },
  ),
);
