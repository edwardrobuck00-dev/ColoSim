import { create } from "zustand";
import type { TabId } from "../input/keybinds";

/** A ready-made event log filter (used when a statistic links to its events). */
export type LogPreset = "all" | "player-hits" | "misses" | "taken" | "blocked" | "fire" | "prayer" | "consumables" | "specials" | "boss" | "deaths";

interface UiState {
  analyticsOpen: boolean;
  analyticsTab: "stats" | "log" | "tick";
  logPreset: LogPreset;
  setAnalytics: (open: boolean, tab?: "stats" | "log" | "tick", preset?: LogPreset) => void;
  /** The open interface tab. */
  tab: TabId;
  /** Text shown at the top-left of the game view, describing what a click would do. */
  hoverText: string | null;
  setTab: (tab: TabId) => void;
  setHoverText: (text: string | null) => void;
}

/** Interface state shared by the side panel, the key handler and the game view. */
export const useUiStore = create<UiState>()((set) => ({
  tab: "inventory",
  analyticsOpen: false,
  analyticsTab: "stats",
  logPreset: "all",
  setAnalytics: (analyticsOpen, tab, preset) =>
    set((s) => ({ analyticsOpen, analyticsTab: tab ?? s.analyticsTab, logPreset: preset ?? (tab === "log" ? s.logPreset : s.logPreset) })),
  hoverText: null,
  setTab: (tab) => set({ tab }),
  setHoverText: (hoverText) => set((s) => (s.hoverText === hoverText ? s : { hoverText })),
}));
