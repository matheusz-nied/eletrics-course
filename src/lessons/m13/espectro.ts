/**
 * Lesson 13.1: the electromagnetic spectrum. Frequency → wavelength, the band
 * a frequency belongs to and the everyday things that use it. Pure, tested in
 * espectro.test.ts; drawn by Espectro.tsx.
 *
 * Band edges: radio up to 300 GHz (ITU), infrared down to about 750 nm, light
 * from about 750 nm (400 THz) to 380 nm (790 THz), ultraviolet to about 10 nm
 * (30 PHz), X-rays to about 0,01 nm (3·10¹⁹ Hz is already gamma territory;
 * the two overlap and are told apart by their origin, not by a sharp edge).
 */
import { formatNumber, NBSP } from '../m00/formato';

/** Speed of light in vacuum (m/s); radio waves in air are 0,03 % slower. */
export const C = 299_792_458;

/** Wavelength (m) of a wave of frequency `f` (Hz). */
export function wavelength(f: number): number {
  return C / f;
}

/** Quarter of the wavelength (m): the length of the simplest wire antenna. */
export function quarterWave(f: number): number {
  return wavelength(f) / 4;
}

export interface Band {
  id: string;
  name: string;
  /** Lower and upper frequency (Hz). */
  from: number;
  to: number;
  /** Color of the band in the ruler (CSS). */
  color: string;
  /** One sentence for the student. */
  note: string;
}

export const BANDS: Band[] = [
  {
    id: 'radio',
    name: 'Ondas de rádio',
    from: 1,
    to: 300e9,
    color: 'var(--espectro-radio)',
    note: 'Atravessam paredes e contornam obstáculos tanto melhor quanto maior o comprimento de onda. Levam rádio, TV, celular, Wi-Fi e o controle do portão.',
  },
  {
    id: 'infravermelho',
    name: 'Infravermelho',
    from: 300e9,
    to: 400e12,
    color: 'var(--espectro-ir)',
    note: 'O calor que você sente de uma chapa quente. Nossos olhos não veem, mas a câmera do celular vê um pouco. É a luz do controle da TV.',
  },
  {
    id: 'visivel',
    name: 'Luz visível',
    from: 400e12,
    to: 790e12,
    color: 'var(--espectro-luz)',
    note: 'A faixa estreita que os olhos enxergam: do vermelho, perto de 750 nm, ao violeta, perto de 380 nm.',
  },
  {
    id: 'ultravioleta',
    name: 'Ultravioleta',
    from: 790e12,
    to: 30e15,
    color: 'var(--espectro-uv)',
    note: 'Queima a pele e desbota as cores. Cada fóton já tem energia para quebrar moléculas.',
  },
  {
    id: 'raios-x',
    name: 'Raios X e gama',
    from: 30e15,
    to: 1e21,
    color: 'var(--espectro-x)',
    note: 'Atravessam o corpo e são ionizantes: arrancam elétrons dos átomos. Por isso o técnico de radiologia sai da sala.',
  },
];

/** Radio sub-bands (ITU names), shown under "Ondas de rádio". */
export const RADIO_BANDS: { name: string; from: number; to: number }[] = [
  { name: 'ELF a VLF (frequências muito baixas)', from: 1, to: 30e3 },
  { name: 'LF (ondas longas)', from: 30e3, to: 300e3 },
  { name: 'MF (ondas médias)', from: 300e3, to: 3e6 },
  { name: 'HF (ondas curtas)', from: 3e6, to: 30e6 },
  { name: 'VHF', from: 30e6, to: 300e6 },
  { name: 'UHF', from: 300e6, to: 3e9 },
  { name: 'SHF (micro-ondas)', from: 3e9, to: 30e9 },
  { name: 'EHF (ondas milimétricas)', from: 30e9, to: 300e9 },
];

export interface Example {
  id: string;
  label: string;
  /** Frequency (Hz). */
  f: number;
  note: string;
}

/** Everyday uses, in frequency order. */
export const EXAMPLES: Example[] = [
  {
    id: 'rede',
    label: 'Rede elétrica',
    f: 60,
    note: 'A tomada não é uma antena: a onda de 60 Hz teria 5.000 km, e quase nada escapa dos fios.',
  },
  {
    id: 'am',
    label: 'Rádio AM',
    f: 1e6,
    note: 'Ondas médias, de cerca de 0,5 a 1,7 MHz. A antena da emissora é uma torre de dezenas de metros.',
  },
  {
    id: 'fm',
    label: 'Rádio FM',
    f: 100e6,
    note: 'De 88 a 108 MHz. A antena telescópica do rádio, esticada, tem perto de um quarto de onda: 75 cm.',
  },
  {
    id: 'portao',
    label: 'Controle de portão',
    f: 433.92e6,
    note: 'A faixa de 433 MHz dos controles de portão, alarmes e sensores sem fio. Um quarto de onda dá a antena de 17 cm da central.',
  },
  {
    id: 'celular',
    label: 'Celular 4G',
    f: 700e6,
    note: 'Uma das faixas do 4G no Brasil fica em 700 MHz. O celular usa várias outras, até alguns gigahertz.',
  },
  {
    id: 'wifi',
    label: 'Wi-Fi 2,4 GHz e Bluetooth',
    f: 2.44e9,
    note: 'A mesma faixa do forno de micro-ondas. Antenas de poucos centímetros, muitas vezes desenhadas na própria placa.',
  },
  {
    id: 'wifi5',
    label: 'Wi-Fi 5 GHz',
    f: 5.5e9,
    note: 'Mais canais e mais velocidade que o 2,4 GHz, mas atravessa pior as paredes.',
  },
  {
    id: 'controle-tv',
    label: 'Controle da TV (infravermelho)',
    f: C / 940e-9,
    note: 'O LED do controle da TV emite em cerca de 940 nm, um pouco além do vermelho que vemos.',
  },
  {
    id: 'vermelho',
    label: 'Luz vermelha',
    f: C / 650e-9,
    note: 'O LED vermelho de 650 nm. Comprimento de onda menor que um centésimo de um fio de cabelo.',
  },
  {
    id: 'azul',
    label: 'Luz azul',
    f: C / 450e-9,
    note: 'O LED azul (e o branco, que é um LED azul com uma camada de fósforo amarelo).',
  },
  {
    id: 'uv',
    label: 'Ultravioleta do sol',
    f: C / 300e-9,
    note: 'O UV-B, perto de 300 nm, é o que queima a pele na praia.',
  },
  {
    id: 'raio-x',
    label: 'Raio X do dentista',
    f: 1.5e18,
    note: 'Comprimento de onda do tamanho de um átomo. Passa pela pele e para nos dentes e ossos.',
  },
];

/** Frequency limits of the explorer (Hz). */
export const F_MIN = 10;
export const F_MAX = 1e20;

export function bandOf(f: number): Band {
  return BANDS.find((b) => f >= b.from && f < b.to) ?? BANDS[BANDS.length - 1]!;
}

export function radioBandOf(f: number): string | undefined {
  return RADIO_BANDS.find((b) => f >= b.from && f < b.to)?.name;
}

const F_PREFIXES: [number, string][] = [
  [1e18, 'E'],
  [1e15, 'P'],
  [1e12, 'T'],
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
];

/** "433,92 MHz", "2,44 GHz", "319 THz", "60 Hz". */
export function formatFrequency(f: number): string {
  const [scale, prefix] = F_PREFIXES.find(([s]) => f >= s * 0.9995) ?? F_PREFIXES.at(-1)!;
  const v = f / scale;
  // Round values (433,92 MHz) keep their decimals; the rest get three digits.
  const exact = Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;
  return `${exact ? formatNumber(v, 2) : sig3(v)}${NBSP}${prefix}Hz`;
}

/** Three significant figures, pt-BR. */
function sig3(v: number): string {
  const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return formatNumber(Number(v.toPrecision(3)), digits);
}

/** "5.000 km", "3 m", "69,1 cm", "12,3 cm", "940 nm". */
export function formatLength(m: number): string {
  const units: [number, string][] = [
    [1e3, 'km'],
    [1, 'm'],
    [1e-2, 'cm'],
    [1e-3, 'mm'],
    [1e-6, 'µm'],
    [1e-9, 'nm'],
    [1e-12, 'pm'],
  ];
  const [scale, unit] = units.find(([s]) => m >= s * 0.9995) ?? units.at(-1)!;
  return `${sig3(m / scale)}${NBSP}${unit}`;
}

/** Something familiar of about the size of `m` meters. */
export function sizeOf(m: number): string {
  if (m >= 100e3) return 'do tamanho de um estado inteiro';
  if (m >= 1e3) return 'do tamanho de um bairro';
  if (m >= 10) return 'do tamanho de um prédio';
  if (m >= 1) return 'do tamanho de uma pessoa';
  if (m >= 0.1) return 'entre um palmo e um braço';
  if (m >= 0.01) return 'do tamanho de uma moeda';
  if (m >= 1e-3) return 'do tamanho de um grão de arroz';
  if (m >= 1e-6) return 'menor que a espessura de um fio de cabelo';
  if (m >= 1e-9) return 'do tamanho de um vírus';
  return 'do tamanho de um átomo, ou menor';
}

/** Position (0 to 1) of `f` on the logarithmic ruler. */
export function rulerPosition(f: number): number {
  const lo = Math.log10(F_MIN);
  const hi = Math.log10(F_MAX);
  return Math.min(1, Math.max(0, (Math.log10(f) - lo) / (hi - lo)));
}
