import { useEffect, useMemo, useState } from 'react';
import { useSettings } from '../context/SettingsContext';
const FADE_INTERVAL_MS = 9000;
// Shows the user's chosen photo(s) as a faint layer behind the app.
// Renders nothing when backgroundMode is 'off' or no photo is chosen.
export default function BackgroundLayer() {
  const { settings, backgroundImages } = useSettings();
  const [activeIndex, setActiveIndex] = useState(0);
  // Photos to show: 'static' = the chosen one (or the first upload);
  // 'fade' = the chosen set (or every upload if none is chosen).
  const activeImages = useMemo(() => {
    if (settings.backgroundMode === 'static') {
      const chosen = backgroundImages.find((img) => img.id === settings.backgroundStaticImageId);
      if (chosen) return [chosen];
      return backgroundImages.length > 0 ? [backgroundImages[0]] : [];
    }
    if (settings.backgroundMode === 'fade') {
      const ids = settings.backgroundFadeImageIds || [];
      const chosen = backgroundImages.filter((img) => ids.includes(img.id));
      return chosen.length > 0 ? chosen : backgroundImages;
    }
    return [];
  }, [
    settings.backgroundMode,
    settings.backgroundStaticImageId,
    settings.backgroundFadeImageIds,
    backgroundImages
  ]);
  // Keep the active index valid if the list shrinks.
  useEffect(() => {
    if (activeIndex >= activeImages.length) setActiveIndex(0);
  }, [activeImages.length, activeIndex]);
  useEffect(() => {
    if (settings.backgroundMode !== 'fade' || activeImages.length < 2) return undefined;
    const id = setInterval(() => {
      setActiveIndex((i) => (i + 1) % activeImages.length);
    }, FADE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [settings.backgroundMode, activeImages.length]);
  if (settings.backgroundMode === 'off' || activeImages.length === 0) return null;
  return (
    <div className="app-background-layer" aria-hidden="true">
      {activeImages.map((img, i) => (
        <div
          key={img.id}
          className={`app-background-photo${i === activeIndex ? ' active' : ''}`}
          style={{ backgroundImage: `url(${img.dataUrl})` }}
        />
      ))}
    </div>
  );
}
