/**
 * Lesson 12.3: the physics behind the sensor lab (LaboratorioSensores.tsx).
 * Typical values of the common hobby modules (HC-SR501, HC-SR04, FC-51,
 * ACS712, SCT-013), never one manufacturer's guaranteed figure; the lesson
 * text calls them "típico". Pure, unit-tested in sensores.test.ts.
 */

/* Presence (PIR, HC-SR501 style) */

/** Typical HC-SR501: 3,3 V output, "tempo" trimpot from about 3 s to 5 min, about 2,5 s blocked after each pulse. */
export const PIR = {
  /** Output level when it detects (V). */
  saida: 3.3,
  /** After the output goes low it ignores movement for about this long (s). */
  bloqueio: 2.5,
  tempoMinimo: 3,
  tempoMaximo: 300,
  /** The person walks across the room at this rate (fraction of the scene per s). */
  passo: 0.3,
} as const;

/** Positions of the "tempo" trimpot offered in the lab (s). */
export const PIR_TEMPOS = [3, 5, 10, 30, 60, 300] as const;

/** H: a new movement restarts the time (repeat trigger). L: the pulse runs to the end (single trigger). */
export type PirModo = 'H' | 'L';

/**
 * The Fresnel lens splits the field into zones; the dual pyroelectric
 * element only reacts when heat moves from one zone to another. Field from
 * 10 % to 90 % of the scene, 8 zones.
 */
export const PIR_CAMPO = { de: 0.1, ate: 0.9, zonas: 8 } as const;

/** Zone of a position (0 to 1 across the scene), or null outside the field. */
export function zonaPir(x: number): number | null {
  const { de, ate, zonas } = PIR_CAMPO;
  if (x < de || x > ate) return null;
  return Math.min(zonas - 1, Math.floor(((x - de) / (ate - de)) * zonas));
}

/** True when moving from `antes` to `depois` changes the infrared the sensor sees. */
export function pirDetecta(antes: number, depois: number): boolean {
  const a = zonaPir(antes);
  const b = zonaPir(depois);
  return a !== b;
}

export interface PirEstado {
  saida: boolean;
  /** Time the output still stays high (s). */
  restante: number;
  /** Time still blocked after the last pulse (s). */
  bloqueio: number;
}

export const PIR_INICIAL: PirEstado = { saida: false, restante: 0, bloqueio: 0 };

/** One step of the module's timer: `detectou` is a change seen during this step. */
export function pirPasso(
  s: PirEstado,
  dt: number,
  detectou: boolean,
  tempo: number,
  modo: PirModo,
): PirEstado {
  let { saida, restante, bloqueio } = s;
  if (detectou && bloqueio <= 0) {
    if (!saida) {
      saida = true;
      restante = tempo;
    } else if (modo === 'H') restante = tempo;
  }
  if (saida) {
    restante -= dt;
    if (restante <= 1e-9) {
      saida = false;
      restante = 0;
      bloqueio = PIR.bloqueio;
    }
  } else bloqueio = Math.max(0, bloqueio - dt);
  return { saida, restante, bloqueio };
}

/* Distance (ultrasound, HC-SR04 style) */

export const HCSR04 = {
  /** Trigger pulse the program sends (s). */
  trig: 10e-6,
  /** Burst the module sends: 8 cycles at 40 kHz. */
  ciclos: 8,
  frequencia: 40_000,
  /** Typical range (m). */
  minimo: 0.02,
  maximo: 4,
  /** With no echo, ECHO drops after about this long (s, typical). */
  timeout: 0.038,
  /** Speed of sound the usual program assumes (m/s, about 20 °C). */
  vPrograma: 343,
} as const;

/** Speed of sound in air (m/s) at a temperature (°C): about 331,3 + 0,606·T. */
export function velocidadeSom(celsius: number): number {
  return 331.3 + 0.606 * celsius;
}

export type Superficie = 'dura' | 'macia';

export interface LeituraUltrassom {
  /** Real speed of sound (m/s). */
  v: number;
  eco: boolean;
  /** Why there is no echo. */
  motivo?: 'longe' | 'macia';
  /** Width of the ECHO pulse (µs); the timeout when there is no echo. */
  larguraUs: number;
  /** What the program computes, d = t × 0,0343 / 2 (cm); null without echo. */
  dPrograma: number | null;
  /** Program minus real distance (cm). */
  erroCm: number | null;
}

/** The HC-SR04 at a distance (cm) and temperature (°C). */
export function ultrassom(dCm: number, celsius: number, superficie: Superficie): LeituraUltrassom {
  const v = velocidadeSom(celsius);
  const semEco = (motivo: 'longe' | 'macia'): LeituraUltrassom => ({
    v,
    eco: false,
    motivo,
    larguraUs: HCSR04.timeout * 1e6,
    dPrograma: null,
    erroCm: null,
  });
  if (superficie === 'macia') return semEco('macia');
  if (dCm > HCSR04.maximo * 100) return semEco('longe');
  const larguraUs = ((2 * dCm) / 100 / v) * 1e6;
  const dPrograma = distanciaDoPrograma(larguraUs);
  return { v, eco: true, larguraUs, dPrograma, erroCm: dPrograma - dCm };
}

/** The line of the program: d = t × 0,0343 / 2, with t in µs and d in cm. */
export function distanciaDoPrograma(larguraUs: number): number {
  return (larguraUs * (HCSR04.vPrograma / 1e4)) / 2;
}

/* Obstacle (reflective infrared, FC-51 / TCRT5000 style) */

/** Share of the infrared each surface sends back (typical). */
export const REFLETANCIA = { branco: 0.9, cinza: 0.45, preto: 0.08 } as const;
export type Cor = keyof typeof REFLETANCIA;

/**
 * Reference distance of the reflection model (cm): with the trimpot halfway
 * a white surface is seen up to 15 cm (typical FC-51 range: about 2 to 30 cm).
 */
export const IR_DREF = 15 * Math.sqrt(0.5 / REFLETANCIA.branco);
/** Strong sunlight adds this much infrared to the phototransistor (fraction of full scale). */
export const IR_SOL = 0.7;
/** Module supply, and so the OUT high level (V). */
export const IR_VCC = 5;

/** Reflected light at the phototransistor, 0 to 1 (falls with the square of the distance). */
export function luzRefletida(dCm: number, cor: Cor, sol = false): number {
  const refl = REFLETANCIA[cor] * (IR_DREF / Math.max(dCm, 0.5)) ** 2;
  return Math.min(1, refl + (sol ? IR_SOL : 0));
}

/** Comparator threshold for a sensitivity (trimpot) from 0 to 1. */
export function limiteIR(sensibilidade: number): number {
  return 0.9 - 0.8 * Math.min(1, Math.max(0, sensibilidade));
}

/** Farthest distance a surface is seen (cm), without sunlight. */
export function alcanceIR(cor: Cor, sensibilidade: number): number {
  return IR_DREF * Math.sqrt(REFLETANCIA[cor] / limiteIR(sensibilidade));
}

export interface LeituraIR {
  luz: number;
  limite: number;
  /** The comparator flips: obstacle seen. */
  detecta: boolean;
  /** OUT pin voltage: active low. */
  saidaV: number;
}

export function infravermelho(
  dCm: number,
  cor: Cor,
  sensibilidade: number,
  sol: boolean,
): LeituraIR {
  const luz = luzRefletida(dCm, cor, sol);
  const limite = limiteIR(sensibilidade);
  const detecta = luz > limite;
  return { luz, limite, detecta, saidaV: detecta ? 0 : IR_VCC };
}

/* Current (ACS712 in series, or SCT-013 clamp) */

export const REDE_V = 127;
export const REDE_HZ = 60;

export interface Carga {
  id: string;
  nome: string;
  watts: number;
}

export const CARGAS: readonly Carga[] = [
  { id: 'led', nome: 'Lâmpada LED 9 W', watts: 9 },
  { id: 'ventilador', nome: 'Ventilador 60 W', watts: 60 },
  { id: 'liquidificador', nome: 'Liquidificador 400 W', watts: 400 },
  { id: 'ferro', nome: 'Ferro de passar 1.000 W', watts: 1000 },
  { id: 'chuveiro', nome: 'Chuveiro 5.500 W', watts: 5500 },
];

/** 10-bit ADC at 5 V, as on an Arduino Uno. */
export const ADC = { vref: 5, passos: 1024 } as const;
export const LSB = ADC.vref / ADC.passos;

/** ACS712 of 5 A: 2,5 V at 0 A, 185 mV/A, measures up to ±5 A (typical). */
export const ACS712 = { zero: 2.5, sensibilidade: 0.185, faixa: 5 } as const;
/** SCT-013 of 100 A : 50 mA (ratio 2000), 33 Ω burden, biased at 2,5 V by a divider. */
export const SCT013 = { relacao: 2000, carga: 33, zero: 2.5, faixa: 100 } as const;

export type TipoSensor = 'hall' | 'alicate';

/** Current from the power, assuming power factor 1 (A RMS). */
export function correnteDaCarga(watts: number, volts = REDE_V): number {
  return watts / volts;
}

/** Sensor volts per ampere at the ADC pin. */
export function voltsPorAmpere(tipo: TipoSensor): number {
  return tipo === 'hall' ? ACS712.sensibilidade : SCT013.carga / SCT013.relacao;
}

/** Current that moves the ADC by one step (A). */
export function correntePorPasso(tipo: TipoSensor): number {
  return LSB / voltsPorAmpere(tipo);
}

/** Voltage at the ADC pin for an instantaneous current (V), held between 0 and 5 V. */
export function tensaoNoPino(tipo: TipoSensor, amperes: number): number {
  const v = 2.5 + amperes * voltsPorAmpere(tipo);
  return Math.min(ADC.vref, Math.max(0, v));
}

/** Instantaneous current of a sine with this RMS value at time t (A). */
export function correnteInstantanea(irms: number, t: number): number {
  return irms * Math.SQRT2 * Math.sin(2 * Math.PI * REDE_HZ * t);
}

/** The program samples for 100 ms (6 cycles of 60 Hz) at 2.000 samples per second. */
export const AMOSTRAGEM = { taxa: 2000, n: 200 } as const;

/** ADC readings over the sampling window. */
export function amostrar(tipo: TipoSensor, irms: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < AMOSTRAGEM.n; k++) {
    const v = tensaoNoPino(tipo, correnteInstantanea(irms, k / AMOSTRAGEM.taxa));
    out.push(Math.min(ADC.passos - 1, Math.max(0, Math.round(v / LSB))));
  }
  return out;
}

/** What the program computes: i = (leitura − 512) × 5/1024 ÷ (V/A), then the RMS (A). */
export function rmsDoPrograma(tipo: TipoSensor, leituras: readonly number[]): number {
  if (leituras.length === 0) return 0;
  const k = LSB / voltsPorAmpere(tipo);
  let soma = 0;
  for (const c of leituras) {
    const i = (c - ADC.passos / 2) * k;
    soma += i * i;
  }
  return Math.sqrt(soma / leituras.length);
}

export interface LeituraCorrente {
  irms: number;
  ipico: number;
  /** Peak swing at the ADC pin around 2,5 V (V), before clipping. */
  vpico: number;
  /** Largest and smallest reading. */
  min: number;
  max: number;
  /** The current is beyond what the sensor measures. */
  foraDaFaixa: boolean;
  rmsPrograma: number;
  porPasso: number;
}

export function analisarCorrente(tipo: TipoSensor, watts: number): LeituraCorrente {
  const irms = correnteDaCarga(watts);
  const ipico = irms * Math.SQRT2;
  const vpico = ipico * voltsPorAmpere(tipo);
  const leituras = amostrar(tipo, irms);
  const foraDaFaixa = tipo === 'hall' ? ipico > ACS712.faixa : irms > SCT013.faixa || vpico > 2.5;
  return {
    irms,
    ipico,
    vpico,
    min: Math.min(...leituras),
    max: Math.max(...leituras),
    foraDaFaixa,
    rmsPrograma: rmsDoPrograma(tipo, leituras),
    porPasso: correntePorPasso(tipo),
  };
}
