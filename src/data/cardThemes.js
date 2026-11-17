// Club card backgrounds a President / Co-President (or Staff) can pick.
// Stored on the club doc as `cardTheme` (the id).
// - Colors and Images: plain CSS classes in app.css (`.card-theme-<id>`).
// - Pictures: a generated gradient + one pattern + one big icon, made the
// same way as the event backgrounds. The background is set inline (see
// cardThemeStyle) and the icon is drawn by CardThemeIcon.
export const CARD_THEMES = [
 { id: 'default', label: 'White', group: 'Colors' },
 { id: 'sage', label: 'Sage', group: 'Colors' },
 { id: 'sky', label: 'Sky', group: 'Colors' },
 { id: 'blush', label: 'Blush', group: 'Colors' },
 { id: 'sand', label: 'Sand', group: 'Colors' },
 { id: 'lavender', label: 'Lavender', group: 'Colors' },
 { id: 'forest', label: 'Forest', group: 'Colors' },
 { id: 'navy', label: 'Navy', group: 'Colors' },
 { id: 'charcoal', label: 'Charcoal', group: 'Colors' },
 { id: 'sunset', label: 'Sunset', group: 'Images' },
 { id: 'ocean', label: 'Ocean', group: 'Images' },
 { id: 'aurora', label: 'Aurora', group: 'Images' },
 { id: 'dots', label: 'Dots', group: 'Images' },
 { id: 'stripes', label: 'Stripes', group: 'Images' },
 { id: 'grid', label: 'Grid', group: 'Images' }
];
// [id, label, icon, hue, pattern]. The icon is a lucide-react icon name.
const PICTURES = [
 ['pic-trophy', 'Champions', 'Trophy', 38, 'rays'],
 ['pic-dumbbell', 'Fitness', 'Dumbbell', 8, 'stripes'],
 ['pic-bike', 'Cycling', 'Bike', 150, 'sunset'],
 ['pic-music', 'Music', 'Music', 285, 'glow'],
 ['pic-mic', 'Open mic', 'Mic', 335, 'bokeh'],
 ['pic-guitar', 'Band', 'Guitar', 18, 'stripes'],
 ['pic-code', 'Coding', 'Code', 170, 'grid'],
 ['pic-cpu', 'Hardware', 'Cpu', 145, 'dots'],
 ['pic-rocket', 'Startup', 'Rocket', 260, 'rays'],
 ['pic-book', 'Reading', 'BookOpen', 28, 'glow'],
 ['pic-science', 'Science', 'Microscope', 275, 'dots'],
 ['pic-idea', 'Ideas', 'Lightbulb', 215, 'bokeh'],
 ['pic-palette', 'Art', 'Palette', 12, 'bokeh'],
 ['pic-camera', 'Photography', 'Camera', 215, 'grid'],
 ['pic-film', 'Film', 'Film', 275, 'rays'],
 ['pic-drama', 'Theater', 'Drama', 345, 'stripes'],
 ['pic-food', 'Food', 'Utensils', 22, 'checks'],
 ['pic-coffee', 'Coffee', 'Coffee', 28, 'glow'],
 ['pic-party', 'Social', 'PartyPopper', 330, 'bokeh'],
 ['pic-heart', 'Service', 'HeartHandshake', 350, 'glow'],
 ['pic-leaf', 'Nature', 'Leaf', 125, 'dots'],
 ['pic-mountain', 'Outdoors', 'Mountain', 150, 'sunset'],
 ['pic-globe', 'Cultural', 'Globe', 205, 'sunset'],
 ['pic-game', 'Gaming', 'Gamepad2', 265, 'grid'],
 ['pic-work', 'Career', 'Briefcase', 30, 'glow']
];
const hsl = (h, s, l, a = 1) => `hsl(${((h % 360) + 360) % 360} ${s}% ${l}% / ${a})`;
// One gradient plus one pattern layer, tinted by the hue.
function backdrop(H, pattern) {
 const base = `linear-gradient(135deg, ${hsl(H, 58, 14)}, ${hsl(H + 18, 62, 30)})`;
 const hi = hsl(H + 25, 85, 62, 0.55);
 const layers = {
 glow: [`radial-gradient(circle at 68% 50%, ${hsl(H + 20, 90, 56, 0.85)}, transparent 62%)`],
 stripes: [
 `repeating-linear-gradient(-35deg, ${hsl(H + 10, 70, 45, 0.5)} 0 12px, transparent 12px 26px)`
 ],
 dots: [`radial-gradient(${hsl(H + 30, 90, 75, 0.6)} 2px, transparent 2.6px) 0 0 / 18px 18px`],
 grid: [
 'linear-gradient(rgba(255,255,255,.09) 1px, transparent 1px) 0 0 / 22px 22px',
 'linear-gradient(90deg, rgba(255,255,255,.09) 1px, transparent 1px) 0 0 / 22px 22px'
 ],
 rays: [
 'repeating-conic-gradient(from 0deg at 72% 50%, rgba(255,255,255,.11) 0deg 7deg, transparent 7deg 18deg)'
 ],
 checks: [
 'conic-gradient(rgba(255,255,255,.1) 25%, transparent 0 50%, rgba(255,255,255,.1) 0 75%, transparent 0) 0 0 / 34px 34px'
 ],
 bokeh: [
 `radial-gradient(circle at 18% 30%, ${hi} 0 9%, transparent 10%)`,
 `radial-gradient(circle at 80% 22%, ${hsl(H + 60, 85, 65, 0.4)} 0 12%, transparent 13%)`,
 `radial-gradient(circle at 62% 80%, ${hi} 0 15%, transparent 16%)`,
 `radial-gradient(circle at 30% 85%, ${hsl(H - 30, 80, 60, 0.35)} 0 8%, transparent 9%)`
 ],
 sunset: [
 `linear-gradient(180deg, ${hsl(H, 70, 38)} 0%, ${hsl(H + 30, 80, 60)} 70%, ${hsl(H + 50, 90, 72)} 100%)`
 ]
 };
 return [...(layers[pattern] || []), base].join(', ');
}
const PICTURE_BY_ID = Object.fromEntries(
 PICTURES.map(([id, label, icon, hue, pattern]) => [id, { label, icon, hue, pattern }])
);
PICTURES.forEach(([id, label]) => CARD_THEMES.push({ id, label, group: 'Pictures' }));
export const isPictureTheme = (id) => !!PICTURE_BY_ID[id];
// Name of the lucide icon for a picture theme (or null).
export const cardThemeIconName = (id) => (PICTURE_BY_ID[id] ? PICTURE_BY_ID[id].icon : null);
// Inline style carrying the generated background (or undefined).
export function cardThemeStyle(id) {
 const t = PICTURE_BY_ID[id];
 return t ? { background: backdrop(t.hue, t.pattern) } : undefined;
}
export function cardThemeClass(id) {
 if (isPictureTheme(id)) return ' card-theme card-theme-picture';
 // Ids that aren't a real option (old seed data like 'sunrise') get the plain card,
 // otherwise the dark theme text would sit on no background and vanish.
 return id && id !== 'default' && CARD_THEMES.some((t) => t.id === id) ? ` card-theme card-theme-${id}` : '';
}