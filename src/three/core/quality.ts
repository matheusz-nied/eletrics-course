/**
 * Quality levels of the 3D views (docs/plano/02-arquitetura.md, section 7.4).
 * The level starts from a device guess, drops when the frame rate falls and
 * can be fixed by the student (saved in localStorage).
 */
import { create } from 'zustand';

export type QualityLevel = 'alta' | 'media' | 'baixa';

export const QUALITY_LABELS: Record<QualityLevel, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

export interface QualitySettings {
  /** Device pixel ratio range. */
  dpr: [number, number];
  /** Effect composer (ambient occlusion, bloom, tone mapping as a pass). */
  postprocessing: boolean;
  ao: boolean;
  aoHalfRes: boolean;
  bloom: boolean;
  multisampling: number;
  /** Contact shadow texture size. */
  shadowResolution: number;
  /** HDRI file: `1k` (1024 × 512) or `512` (512 × 256). */
  hdri: '1k' | '512';
}

export const QUALITY: Record<QualityLevel, QualitySettings> = {
  alta: {
    dpr: [1, 2],
    postprocessing: true,
    ao: true,
    aoHalfRes: false,
    bloom: true,
    multisampling: 4,
    shadowResolution: 1024,
    hdri: '1k',
  },
  media: {
    dpr: [1, 1.5],
    postprocessing: true,
    ao: true,
    aoHalfRes: true,
    bloom: true,
    multisampling: 2,
    shadowResolution: 512,
    hdri: '512',
  },
  baixa: {
    dpr: [1, 1],
    postprocessing: false,
    ao: false,
    aoHalfRes: true,
    bloom: false,
    multisampling: 0,
    shadowResolution: 256,
    hdri: '512',
  },
};

const ORDER: QualityLevel[] = ['baixa', 'media', 'alta'];
const STORAGE_KEY = 'curso:v1:qualidade-3d';

interface NavigatorHints {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

/** First guess from the device, before any frame is measured. */
export function guessQuality(): QualityLevel {
  if (typeof navigator === 'undefined') return 'media';
  const hints = navigator as Navigator & NavigatorHints;
  if (hints.connection?.saveData) return 'baixa';
  const cores = navigator.hardwareConcurrency || 4;
  const memory = hints.deviceMemory ?? 8;
  if (cores <= 2 || memory <= 2) return 'baixa';
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (coarse || cores <= 4 || memory <= 4) return 'media';
  return 'alta';
}

function readSaved(): QualityLevel | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && saved in QUALITY ? (saved as QualityLevel) : null;
  } catch {
    return null;
  }
}

function readQueryOverride(): QualityLevel | null {
  if (typeof location === 'undefined') return null;
  const value = new URLSearchParams(location.search).get('qualidade');
  return value && value in QUALITY ? (value as QualityLevel) : null;
}

interface QualityState {
  level: QualityLevel;
  /** The student (or the page URL) chose the level: no automatic changes. */
  fixed: boolean;
  /** Initial guess resolved on the client. */
  ready: boolean;
  init: () => void;
  choose: (level: QualityLevel | 'auto') => void;
  /** Called by the frame-rate monitor. */
  decline: () => void;
  incline: (ceiling: QualityLevel) => void;
}

export const useQuality = create<QualityState>((set, get) => ({
  level: 'media',
  fixed: false,
  ready: false,
  init: () => {
    if (get().ready) return;
    const forced = readQueryOverride() ?? readSaved();
    set({ level: forced ?? guessQuality(), fixed: forced !== null, ready: true });
  },
  choose: (level) => {
    try {
      if (level === 'auto') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, level);
    } catch {
      // Storage blocked: the choice lasts for this page only.
    }
    if (level === 'auto') set({ level: guessQuality(), fixed: false });
    else set({ level, fixed: true });
  },
  decline: () => {
    const { level, fixed } = get();
    const index = ORDER.indexOf(level);
    if (!fixed && index > 0) set({ level: ORDER[index - 1]! });
  },
  incline: (ceiling) => {
    const { level, fixed } = get();
    const index = ORDER.indexOf(level);
    if (!fixed && index < ORDER.indexOf(ceiling)) set({ level: ORDER[index + 1]! });
  },
}));
