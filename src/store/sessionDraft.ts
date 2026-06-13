import { create } from "zustand";
import type { XrayPrediction } from "@/lib/xrayApi";

export interface XrayDraft {
  file: File | null;
  fileName: string | null;
  preview: string | null;
  result: XrayPrediction | null;
}

export interface AudioDraft {
  blob: Blob | null;
  audioUrl: string | null;
  recording: boolean;
  processing: boolean;
  summary: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  soap: any | null;
}

export interface WrapUpDraft {
  notes: string;
  meds: string;
  nextTime: string;
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

interface SessionDraftState {
  patientKey: string | null;
  xray: XrayDraft;
  audio: AudioDraft;
  wrapUp: WrapUpDraft;
  chatHistory: ChatMessage[];
  setXray: (patch: Partial<XrayDraft>) => void;
  setAudio: (patch: Partial<AudioDraft>) => void;
  setWrapUp: (patch: Partial<WrapUpDraft>) => void;
  setChatHistory: (msgs: ChatMessage[]) => void;
  appendChatMessage: (msg: ChatMessage) => void;
  clearChatHistory: () => void;
  resetDraft: () => void;
  ensurePatient: (patientId: string | null) => void;
}

const emptyXray: XrayDraft = { file: null, fileName: null, preview: null, result: null };
const emptyAudio: AudioDraft = {
  blob: null,
  audioUrl: null,
  recording: false,
  processing: false,
  summary: null,
  soap: null,
};
const emptyWrapUp: WrapUpDraft = { notes: "", meds: "", nextTime: "" };

export const useSessionStore = create<SessionDraftState>((set, get) => ({
  patientKey: null,
  xray: emptyXray,
  audio: emptyAudio,
  wrapUp: emptyWrapUp,
  chatHistory: [],
  setXray: (patch) => set((s) => ({ xray: { ...s.xray, ...patch } })),
  setAudio: (patch) => set((s) => ({ audio: { ...s.audio, ...patch } })),
  setWrapUp: (patch) => set((s) => ({ wrapUp: { ...s.wrapUp, ...patch } })),
  setChatHistory: (msgs) => set({ chatHistory: msgs }),
  appendChatMessage: (msg) =>
    set((s) => ({ chatHistory: [...s.chatHistory, msg] })),
  clearChatHistory: () => set({ chatHistory: [] }),
  resetDraft: () =>
    set({ xray: emptyXray, audio: emptyAudio, wrapUp: emptyWrapUp, chatHistory: [] }),
  ensurePatient: (patientId) => {
    const current = get().patientKey;
    if (current !== patientId) {
      set({
        patientKey: patientId,
        xray: emptyXray,
        audio: emptyAudio,
        wrapUp: emptyWrapUp,
        chatHistory: [],
      });
    }
  },
}));
