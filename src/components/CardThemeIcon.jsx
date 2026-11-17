import {
 Trophy,
 Dumbbell,
 Bike,
 Music,
 Mic,
 Guitar,
 Code,
 Cpu,
 Rocket,
 BookOpen,
 Microscope,
 Lightbulb,
 Palette,
 Camera,
 Film,
 Drama,
 Utensils,
 Coffee,
 PartyPopper,
 HeartHandshake,
 Leaf,
 Mountain,
 Globe,
 Gamepad2,
 Briefcase
} from 'lucide-react';
import { cardThemeIconName } from '../data/cardThemes';
// Only the icons the Pictures backgrounds use.
const ICONS = {
 Trophy,
 Dumbbell,
 Bike,
 Music,
 Mic,
 Guitar,
 Code,
 Cpu,
 Rocket,
 BookOpen,
 Microscope,
 Lightbulb,
 Palette,
 Camera,
 Film,
 Drama,
 Utensils,
 Coffee,
 PartyPopper,
 HeartHandshake,
 Leaf,
 Mountain,
 Globe,
 Gamepad2,
 Briefcase
};
// The big, soft icon on a "Pictures" card background. Renders nothing for
// every other theme.
export default function CardThemeIcon({ themeId }) {
 const name = cardThemeIconName(themeId);
 const Icon = name ? ICONS[name] : null;
 if (!Icon) return null;
 return <Icon className="card-theme-icon" aria-hidden="true" strokeWidth={1.6} />;
}