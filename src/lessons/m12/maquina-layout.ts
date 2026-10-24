/**
 * Where the states and arrows of the lesson 12.2 diagram go: a landscape
 * layout for wide columns and a portrait one for phones (the same picture
 * turned a quarter, so the student finds the states in the same places
 * relative to each other). Coordinates in SVG units.
 */
import type { Estado } from './maquina-estados';

export interface Ponto {
  x: number;
  y: number;
}

export interface Seta {
  /** Transition id (maquina-estados.ts). */
  id: string;
  /** Start, optional control point (quadratic curve), end. */
  de: Ponto;
  ctrl?: Ponto;
  para: Ponto;
  /** Label centre and its lines; drawn over the arrow with a halo. */
  rotulo: Ponto;
  linhas: string[];
}

export interface Layout {
  largura: number;
  altura: number;
  no: { largura: number; altura: number };
  estados: Record<Estado, Ponto>;
  setas: Seta[];
}

const p = (x: number, y: number): Ponto => ({ x, y });

const ROTULOS: Record<string, string[]> = {
  'fechado-abrindo': ['comando'],
  'abrindo-aberto': ['fim de curso', 'de abertura'],
  'abrindo-parado': ['comando', 'ou obstáculo'],
  'abrindo-erro': ['40 s sem', 'fim de curso'],
  'aberto-fechando': ['comando ou', 'pausa terminou', '(feixe livre)'],
  'fechando-fechado': ['fim de curso', 'de fechamento'],
  'fechando-abrindo': ['comando,', 'fotocélula', 'interrompida', 'ou obstáculo'],
  'fechando-erro': ['40 s sem', 'fim de curso'],
  'parado-abrindo': ['comando', '(ia fechando)'],
  'parado-fechando': ['comando', '(ia abrindo)'],
  'erro-abrindo': ['comando'],
};

/** Point halfway along a straight or quadratic arrow. */
export function meio(de: Ponto, para: Ponto, ctrl?: Ponto): Ponto {
  if (!ctrl) return { x: (de.x + para.x) / 2, y: (de.y + para.y) / 2 };
  return {
    x: 0.25 * de.x + 0.5 * ctrl.x + 0.25 * para.x,
    y: 0.25 * de.y + 0.5 * ctrl.y + 0.25 * para.y,
  };
}

/** An arrow; the label goes halfway along it unless `rotulo` says otherwise. */
function seta(id: string, de: Ponto, para: Ponto, rotulo: Ponto | null, ctrl?: Ponto): Seta {
  return {
    id,
    de,
    para,
    rotulo: rotulo ?? meio(de, para, ctrl),
    linhas: ROTULOS[id] ?? [],
    ...(ctrl ? { ctrl } : {}),
  };
}

/** Landscape: FECHADO left, ABERTO right, ABRINDO on top, FECHANDO below. */
export const LARGO: Layout = {
  largura: 800,
  altura: 500,
  no: { largura: 140, altura: 60 },
  estados: {
    FECHADO: p(84, 250),
    PARADO: p(250, 250),
    ERRO: p(550, 250),
    ABERTO: p(716, 250),
    ABRINDO: p(400, 60),
    FECHANDO: p(400, 440),
  },
  setas: [
    seta('fechado-abrindo', p(84, 216), p(326, 56), p(124, 98), p(84, 56)),
    seta('abrindo-aberto', p(474, 56), p(716, 216), p(676, 98), p(716, 56)),
    seta('aberto-fechando', p(716, 284), p(474, 444), p(668, 404), p(716, 444)),
    seta('fechando-fechado', p(326, 444), p(84, 284), p(132, 402), p(84, 444)),
    seta('fechando-abrindo', p(400, 406), p(400, 94), p(400, 250)),
    seta('abrindo-parado', p(358, 94), p(282, 216), null, p(338, 170)),
    seta('parado-abrindo', p(212, 216), p(334, 80), null, p(210, 100)),
    seta('parado-fechando', p(250, 284), p(346, 406), null, p(262, 386)),
    seta('abrindo-erro', p(442, 94), p(518, 216), null, p(462, 170)),
    seta('erro-abrindo', p(588, 216), p(466, 80), null, p(590, 100)),
    seta('fechando-erro', p(454, 406), p(550, 284), null, p(538, 386)),
  ],
};

/** Portrait: FECHADO on top, ABERTO at the bottom, FECHANDO left, ABRINDO right. */
export const ESTREITO: Layout = {
  largura: 400,
  altura: 760,
  no: { largura: 128, altura: 56 },
  estados: {
    FECHADO: p(200, 40),
    PARADO: p(200, 206),
    ERRO: p(200, 554),
    ABERTO: p(200, 720),
    ABRINDO: p(330, 380),
    FECHANDO: p(70, 380),
  },
  setas: [
    seta('fechado-abrindo', p(264, 40), p(334, 352), p(334, 112), p(334, 40)),
    seta('abrindo-aberto', p(334, 408), p(264, 720), p(334, 648), p(334, 720)),
    seta('aberto-fechando', p(136, 720), p(66, 408), p(68, 640), p(66, 720)),
    seta('fechando-fechado', p(66, 352), p(136, 40), p(66, 120), p(66, 40)),
    seta('fechando-abrindo', p(134, 380), p(266, 380), p(200, 380)),
    seta('abrindo-parado', p(300, 352), p(240, 234), null, p(300, 270)),
    seta('parado-abrindo', p(264, 206), p(374, 352), null, p(380, 210)),
    seta('parado-fechando', p(150, 234), p(90, 352), null, p(100, 270)),
    seta('abrindo-erro', p(300, 408), p(240, 526), null, p(300, 490)),
    seta('erro-abrindo', p(264, 554), p(374, 408), null, p(380, 550)),
    seta('fechando-erro', p(90, 408), p(150, 526), null, p(100, 490)),
  ],
};

/** SVG path of an arrow. */
export function caminho(s: Seta): string {
  const f = (n: number) => Math.round(n * 10) / 10;
  if (s.ctrl)
    return `M${f(s.de.x)} ${f(s.de.y)} Q${f(s.ctrl.x)} ${f(s.ctrl.y)} ${f(s.para.x)} ${f(s.para.y)}`;
  return `M${f(s.de.x)} ${f(s.de.y)} L${f(s.para.x)} ${f(s.para.y)}`;
}
