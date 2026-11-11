import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { DEFAULT_SETTINGS, mergeSettings, saveUserSettings } from '../services/settings';
import { listenToBackgroundImages } from '../services/background';
const SettingsContext = createContext(null);
export function useSettings() {
  return useContext(SettingsContext);
}
// Appearance/layout preferences, applied app-wide through attributes on <html>
// and saved per-user to Firestore (services/settings.js).
export function SettingsProvider({ children }) {
  const { currentUser, profile } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [backgroundImages, setBackgroundImages] = useState([]);

  // Re-sync when the signed-in user's profile loads.
  useEffect(() => {
    setSettings(mergeSettings(profile?.settings));
  }, [profile]);
  // Listens to the user's background photos; cleared on sign-out.
  useEffect(() => {
    if (!currentUser) {
      setBackgroundImages([]);
      return undefined;
    }
    return listenToBackgroundImages(currentUser.uid, setBackgroundImages);
  }, [currentUser]);
  // These <html> attributes drive the theme/accent/font-size selectors in app.css.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
    root.setAttribute('data-accent', settings.accent);
    root.setAttribute('data-font-size', settings.fontSize);
  }, [settings.theme, settings.accent, settings.fontSize]);
  function updateSettings(partial) {
    const next = { ...settings, ...partial };
    setSettings(next);
    // Best-effort: if the save fails, the change still applies for this session.
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
    <SettingsContext.Provider value={{ settings, updateSettings, moveHomeSection, backgroundImages }}>
      {children}
    </SettingsContext.Provider>
  );
}
