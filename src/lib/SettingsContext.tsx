import { createContext, useContext, useMemo, useState } from 'react';
import { loadSettings, saveSettings, type AppSettings, DEFAULT_SETTINGS } from './store';

interface SettingsContextValue {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

const DEFAULT_VALUE: SettingsContextValue = {
  settings: DEFAULT_SETTINGS,
  updateSetting: () => {},
};

const SettingsContext = createContext<SettingsContextValue>(DEFAULT_VALUE);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      return next;
    });
  }

  const value = useMemo(() => ({ settings, updateSetting }), [settings]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
