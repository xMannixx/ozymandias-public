import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getSettings, toggleKillSwitch as toggleKillSwitchApi, updateSettings } from "@/api/settings";

export type AppMode = "guardian" | "autopilot" | "kill-switch";
export type RuntimeMode = Exclude<AppMode, "kill-switch">;

type ModeContextValue = {
  mode: AppMode;
  runtimeMode: RuntimeMode;
  setMode: (mode: AppMode) => void;
  killSwitch: boolean;
  toggleKillSwitch: (active: boolean) => Promise<void>;
};

const ModeContext = createContext<ModeContextValue | undefined>(undefined);

type ModeProviderProps = {
  children: ReactNode;
};

export function ModeProvider({ children }: ModeProviderProps): JSX.Element {
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>("guardian");
  const [killSwitch, setKillSwitch] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const settings = await getSettings();
        if (!isMounted) {
          return;
        }
        setRuntimeMode(settings.mode);
        setKillSwitch(settings.kill_switch);
      } catch {
        if (!isMounted) {
          return;
        }
        // Fallback for offline / unavailable backend.
        setRuntimeMode("guardian");
        setKillSwitch(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const setMode = useCallback((nextMode: AppMode) => {
    if (nextMode === "kill-switch") {
      setKillSwitch(true);
      return;
    }

    setRuntimeMode(nextMode);
    void (async () => {
      try {
        const settings = await updateSettings({ mode: nextMode });
        setRuntimeMode(settings.mode);
        setKillSwitch(settings.kill_switch);
      } catch {
        // Keep optimistic local mode to avoid interrupting UX.
      }
    })();
  }, []);

  const toggleKillSwitch = useCallback(async (active: boolean) => {
    setKillSwitch(active);
    try {
      const settings = await toggleKillSwitchApi(active);
      setRuntimeMode(settings.mode);
      setKillSwitch(settings.kill_switch);
    } catch {
      // Keep optimistic local switch state if backend update fails.
    }
  }, []);

  const mode: AppMode = killSwitch ? "kill-switch" : runtimeMode;
  const value = useMemo<ModeContextValue>(
    () => ({ mode, runtimeMode, setMode, killSwitch, toggleKillSwitch }),
    [killSwitch, mode, runtimeMode, setMode, toggleKillSwitch],
  );
  return createElement(ModeContext.Provider, { value }, children);
}

export function useMode(): ModeContextValue {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error("useMode must be used within ModeProvider");
  }
  return context;
}
