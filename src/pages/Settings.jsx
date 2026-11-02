import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

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

export default function Settings() {
  const { profile } = useAuth();
  const { settings, updateSettings, moveHomeSection } = useSettings();

  return (
    <div className="page narrow">
      <h1>Settings</h1>
      <p className="page-subtitle">
        These preferences are saved to your account{profile?.name ? `, ${profile.name}` : ''} - they
        follow you to any device you sign in on, and apply across every page in RamCentral.
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
        <h2>Home page layout</h2>
        <p className="page-subtitle">
          Reorder the sections on your Clubs (Home) page. More pages will get this same control
          over time - Home is the first.
        </p>
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