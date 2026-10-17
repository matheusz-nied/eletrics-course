/**
 * The site's icon set: 24×24 line icons drawn with `currentColor`.
 * Each value is the inner markup of an `<svg viewBox="0 0 24 24">`.
 *
 * Module and track YAML files pick their icon by name (`icone: motor`), so a
 * name here is part of the content schema: add names, don't rename them.
 */
export const ICONS = {
  // Interface
  'seta-esquerda': '<path d="M15 18l-6-6 6-6"/>',
  'seta-direita': '<path d="M9 18l6-6-6-6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  lua: '<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  nivel: '<path d="M5 20v-4M12 20v-9M19 20V5"/>',
  alvo: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  lista: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  livro: '<path d="M4 19V5a2 2 0 0 1 2-2h14v14H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  rascunho: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>',
  construcao: '<path d="M3 21h18M6 21l5-17h2l5 17M8.2 14h7.6M9.6 9h4.8"/>',
  trilha:
    '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>',
  perigo:
    '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
  atencao: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
  dica: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V16h5v-.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z"/>',
  nota: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5h.01"/>',
  seguranca:
    '<path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z"/><path d="M12.8 7.5L10 12.5h4l-2.8 5"/>',
  aprofundar: '<path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5"/>',
  // Subjects (modules and tracks)
  inicio: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5 5-2z"/>',
  raio: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
  circuito:
    '<path d="M4 9V5h4.5M15.5 5H20v14H4v-4"/><path d="M8.5 5l1.2-2 2.3 4 2.3-4 1.2 2"/><path d="M1.5 9.5h5M2.8 12.5h2.4"/>',
  multimetro:
    '<rect x="5.5" y="2" width="13" height="20" rx="2"/><rect x="8" y="4.5" width="8" height="4" rx=".5"/><circle cx="12" cy="13.5" r="2.5"/><path d="M9 19h.01M15 19h.01"/>',
  resistor: '<path d="M2 12h4l1.5-3 3 6 3-6 3 6 1.5-3h4"/>',
  ima: '<path d="M5 3v9a7 7 0 0 0 14 0V3h-4.5v9a2.5 2.5 0 0 1-5 0V3H5zM5 7.5h4.5M14.5 7.5H19"/>',
  senoide: '<path d="M2 12c1.7-4.7 3.3-7 5-7s3.3 2.3 5 7 3.3 7 5 7 3.3-2.3 5-7"/>',
  casa: '<path d="M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-5h4v5"/>',
  motor:
    '<rect x="2.5" y="6.5" width="14" height="11" rx="2"/><path d="M16.5 12h5M6 6.5V4h7v2.5M6 10.5h7M6 13.5h7"/>',
  diodo: '<path d="M2 12h6M16 12h6M8 6v12l8-6-8-6zM16 6v12"/>',
  bateria:
    '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 10.5v3M6 12h4M8 10v4M13 12h3"/>',
  logica: '<path d="M5 5h6a7 7 0 0 1 0 14H5V5zM2 9h3M2 15h3M18 12h4"/>',
  chip: '<rect x="6" y="6" width="12" height="12" rx="1.5"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  antena:
    '<circle cx="12" cy="12" r="1.5"/><path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7"/>',
  placa:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h4l3 3v7M17 7v4"/><circle cx="14" cy="17" r=".5"/><circle cx="17" cy="11" r=".5"/><circle cx="7" cy="12" r="1.5"/>',
  lupa: '<circle cx="10.5" cy="10.5" r="7"/><path d="M21 21l-5.5-5.5M6.5 10.5h1.5l1-2 2 4 1-2h2"/>',
  portao:
    '<path d="M2 20h20M4 20V8h12v12M7 8v12M10 8v12M13 8v12M18.5 14H22m-1.5-1.5L22 14l-1.5 1.5"/>',
  ferramenta:
    '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4 2.5-2.5z"/>',
} as const satisfies Record<string, string>;

export type IconName = keyof typeof ICONS;

export const ICON_NAMES = Object.keys(ICONS) as [IconName, ...IconName[]];
