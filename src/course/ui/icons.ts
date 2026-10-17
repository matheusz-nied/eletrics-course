import { ICONS } from '../../components/icons';

/**
 * Interface icons used only by the course experience, drawn like the site set
 * (src/components/icons.ts): 24×24, lines in `currentColor`.
 */
export const COURSE_ICONS = {
  buscar: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.8-4.8"/>',
  progresso: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  baixar: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  enviar: '<path d="M12 15V3M7 8l5-5 5 5M4 21h16"/>',
  lixeira: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  offline: '<path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M12 19h.01"/>',
  expandir: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  recolher: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  refazer: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.7M4 4v4.7h4.7"/>',
  cima: '<path d="M6 15l6-6 6 6"/>',
  baixo: '<path d="M6 9l6 6 6-6"/>',
  arrastar: '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>',
  x: '<path d="M7 7l10 10M17 7L7 17"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  medir:
    '<path d="M3 17l4-4 3 3 7-7 4 4"/><path d="M14 9h3v3"/>',
  imagem: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5L5 20"/>',
} as const satisfies Record<string, string>;

export const ALL_ICONS = { ...ICONS, ...COURSE_ICONS };

export type CourseIconName = keyof typeof ALL_ICONS;
