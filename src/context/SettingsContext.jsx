import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { DEFAULT_SETTINGS, mergeSettings, saveUserSettings } from '../services/settings';

const SettingsContext = createContext(null);
export function useSettings() {
  return useContext(SettingsContext);
}
// Appearance/layout preferences, applied globally (every page, via
export function SettingsProvider({ children }) {
  const { currentUser, profile } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  // Re-sync local state whenever the signed-in user's profile (re)loads -
  useEffect(() => {
    setSettings(mergeSettings(profile?.settings));
  }, [profile]);
  // The part that actually makes this apply "across every tab": these
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
    root.setAttribute('data-accent', settings.accent);
    root.setAttribute('data-font-size', settings.fontSize);
  }, [settings.theme, settings.accent, settings.fontSize]);
  function updateSettings(partial) {
    const next = { ...settings, ...partial };
    setSettings(next);
    if (currentUser) saveUserSettings(currentUser.uid, next).catch(() => {});
  }
  function moveHomeSection(key, direction) {
    const order = [...settings.homeLayout];
    const i = order.indexOf(key);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    updateSettings({ homeLayout: order });
  }
  return (
    <SettingsContext.Provider value={{ settings, updateSettings, moveHomeSection }}>
      {children}
    </SettingsContext.Provider>
  );
}