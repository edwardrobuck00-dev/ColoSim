import { loadSettings, saveSettings, type Keybinds, type Settings } from "@sim/storage";
import { create } from "zustand";

interface SettingsState {
  settings: Settings;
  update: (patch: Partial<Omit<Settings, "keybinds" | "version">>) => void;
  setKeybind: (action: keyof Keybinds, code: string) => void;
  resetAll: () => void;
}

/** User settings. Loaded synchronously at startup and written through to localStorage. */
export const useSettingsStore = create<SettingsState>((set, get) => {
  const commit = (settings: Settings) => {
    saveSettings(settings);
    set({ settings });
  };
  return {
    settings: loadSettings(),
    update: (patch) => commit({ ...get().settings, ...patch }),
    setKeybind: (action, code) => {
      const s = get().settings;
      commit({ ...s, keybinds: { ...s.keybinds, [action]: code } });
    },
    resetAll: () => {
      localStorage.removeItem("sim.settings");
      set({ settings: loadSettings() });
    },
  };
});
