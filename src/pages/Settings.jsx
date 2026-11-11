import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import {
  compressImageForBackground,
  addBackgroundImage,
  removeBackgroundImage
} from '../services/background';
const ACCENTS = [
  { key: 'forest', label: 'Forest & Gold', a: '#1c3d2e', b: '#c99a3c' },
  { key: 'ocean', label: 'Ocean', a: '#0f3a52', b: '#3fa9c9' },
  { key: 'crimson', label: 'Crimson', a: '#5c1f2b', b: '#d98a3d' },
  { key: 'violet', label: 'Violet', a: '#3a2c5c', b: '#c98cd6' }
];
const FONT_SIZES = [
  { key: 'small', label: 'Small' },
  { key: 'default', label: 'Default' },
  { key: 'large', label: 'Large' }
];
const HOME_SECTION_LABELS = { myClubs: 'My clubs', browseClubs: 'Browse clubs' };

const BACKGROUND_MODES = [
  { key: 'off', label: 'Off' },
  { key: 'static', label: 'Static image' },
  { key: 'fade', label: 'Fading slideshow' }
];
export default function Settings() {
  const { currentUser, profile } = useAuth();
  const { settings, updateSettings, moveHomeSection, backgroundImages } = useSettings();
  const [bgUploading, setBgUploading] = useState(false);
  const [bgError, setBgError] = useState(null);
  // Compresses each file in the browser before saving it (see services/background.js).
  async function handleBackgroundUpload(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0 || !currentUser) return;
    setBgError(null);
    setBgUploading(true);
    try {
      for (const file of files) {
        const dataUrl = await compressImageForBackground(file);
        await addBackgroundImage(currentUser.uid, dataUrl);
      }
    } catch (err) {
      setBgError(err.message);
    } finally {
      setBgUploading(false);
    }
  }
  function handleRemoveBackground(imageId) {
    if (!currentUser) return;
    removeBackgroundImage(currentUser.uid, imageId).catch((err) => setBgError(err.message));
    // A deleted photo shouldn't linger as "chosen" in either mode.
    if (settings.backgroundStaticImageId === imageId) {
      updateSettings({ backgroundStaticImageId: null });
    }
    if ((settings.backgroundFadeImageIds || []).includes(imageId)) {
      updateSettings({
        backgroundFadeImageIds: settings.backgroundFadeImageIds.filter((id) => id !== imageId)
      });
    }
  }
  // 'static': a click picks THE background. 'fade': a click toggles it in the rotation.
  function handleThumbClick(imageId) {
    if (settings.backgroundMode === 'static') {
      updateSettings({ backgroundStaticImageId: imageId });
    } else if (settings.backgroundMode === 'fade') {
      const current = settings.backgroundFadeImageIds || [];
      const next = current.includes(imageId)
        ? current.filter((id) => id !== imageId)
        : [...current, imageId];
      updateSettings({ backgroundFadeImageIds: next });
    }
  }
  return (
    <div className="page narrow">
      <h1>Settings</h1>
      <p className="page-subtitle">
        These preferences are saved to your account{profile?.name ? `, ${profile.name}` : ''} - they follow
        you to any device you sign in on, and apply across every page in RamCentral.{' '}
      </p>
      <section className="detail-section">
        <h2>Appearance</h2>
        <h3>Theme</h3>
        <div className="settings-option-row">
          <button
            type="button"
            className={settings.theme === 'light' ? '' : 'secondary'}
            onClick={() => updateSettings({ theme: 'light' })}
          >
            Light
          </button>
          <button
            type="button"
            className={settings.theme === 'dark' ? '' : 'secondary'}
            onClick={() => updateSettings({ theme: 'dark' })}
          >
            Dark
          </button>
        </div>
        <h3>Accent color</h3>
        <div className="settings-swatch-row">
          {ACCENTS.map((accent) => (
            <button
              key={accent.key}

              type="button"
              className={`settings-swatch${settings.accent === accent.key ? ' selected' : ''}`}
              onClick={() => updateSettings({ accent: accent.key })}
              aria-pressed={settings.accent === accent.key}
            >
              <span className="settings-swatch-colors">
                <span style={{ background: accent.a }} />
                <span style={{ background: accent.b }} />
              </span>
              <span>{accent.label}</span>
            </button>
          ))}
        </div>
        <h3>Text size</h3>
        <div className="settings-option-row">
          {FONT_SIZES.map((size) => (
            <button
              key={size.key}
              type="button"
              className={settings.fontSize === size.key ? '' : 'secondary'}
              onClick={() => updateSettings({ fontSize: size.key })}
            >
              {size.label}
            </button>
          ))}
        </div>
      </section>
      <section className="detail-section">
        <h2>Background</h2>
        <p className="page-subtitle">
          Upload your own photos to show behind every page in RamCentral - pick one as a static backdrop, or
          let a chosen few slowly fade between each other. This only ever changes the background - nothing
          else on the page moves or changes.
        </p>
        <div className="settings-option-row">
          {BACKGROUND_MODES.map((mode) => (
            <button
              key={mode.key}
              type="button"
              className={settings.backgroundMode === mode.key ? '' : 'secondary'}
              onClick={() => updateSettings({ backgroundMode: mode.key })}
            >
              {mode.label}
            </button>
          ))}
        </div>
        {settings.backgroundMode !== 'off' && (
          <>
            {bgError && <p className="form-error">{bgError}</p>}
            {backgroundImages.length > 0 ? (
              <>
                <p className="bg-photo-hint">
                  {settings.backgroundMode === 'static'
                    ? 'Click a photo to use it as your background.'
                    : 'Click the photos you want in the fade rotation - pick two or more.'}{' '}
                </p>
                <div className="bg-photo-grid">
                  {backgroundImages.map((img) => {
                    const selected =
                      settings.backgroundMode === 'static'
                        ? settings.backgroundStaticImageId === img.id
                        : (settings.backgroundFadeImageIds || []).includes(img.id);
                    return (
                      <div
                        key={img.id}
                        className={`bg-photo-thumb${selected ? ' selected' : ''}`}
                        style={{
                          backgroundImage: `url(${img.dataUrl})`
                        }}
                        role="button"
                        tabIndex={0}
                        aria-pressed={selected}
                        aria-label={selected ? 'Selected - click to change' : 'Select this photo'}
                        onClick={() => handleThumbClick(img.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleThumbClick(img.id);
                          }
                        }}
                      >
                        {selected && (
                          <span className="bg-photo-thumb-check" aria-hidden="true">
                            {' '}
                            &#10003;
                          </span>
                        )}
                        <button
                          type="button"
                          className="bg-photo-thumb-remove"

                          aria-label="Remove this photo"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveBackground(img.id);
                          }}
                        >
                          &times;
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="bg-photo-empty">No photos uploaded yet - add some below.</p>
            )}
            <label className={`bg-upload-button${bgUploading ? ' disabled' : ''}`}>
              {bgUploading ? 'Uploading...' : 'Upload photos'}
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={bgUploading}
                onChange={handleBackgroundUpload}
              />
            </label>
          </>
        )}
      </section>
      <section className="detail-section">
        <h2>Home page layout</h2>
        <p className="page-subtitle"></p>
        {settings.homeLayout.map((key, i) => (
          <div key={key} className="member-row">
            <span>{HOME_SECTION_LABELS[key] || key}</span>
            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                disabled={i === 0}
                onClick={() => moveHomeSection(key, -1)}
                aria-label={`Move ${HOME_SECTION_LABELS[key] || key} up`}
              >
                &uarr;
              </button>
              <button
                type="button"
                className="secondary"
                disabled={i === settings.homeLayout.length - 1}
                onClick={() => moveHomeSection(key, 1)}
                aria-label={`Move ${HOME_SECTION_LABELS[key] || key} down`}
              >
                &darr;
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
