/**
 * Lesson 3.6: a 30 V / 5 A bench power supply without UI. With the output on,
 * it holds the set voltage (CV) while the load takes less than the current
 * limit, and holds the limit (CC), lowering the voltage, when the load would
 * take more. Loads are steady-state models: the lamp uses the same filament
 * balance as the engine's lamp device; the LED is a typical red LED.
 */

export const V_MAX = 30;
export const I_MAX = 5;

export type LoadId = 'nada' | 'lampada' | 'resistor-1k' | 'resistor-10' | 'led' | 'curto';

export const LOADS: { id: LoadId; label: string; detail: string }[] = [
  { id: 'nada', label: 'Nada ligado', detail: 'Bornes livres.' },
  { id: 'lampada', label: 'Lâmpada de 12 V e 5 W', detail: 'Lâmpada incandescente de carro.' },
  { id: 'resistor-1k', label: 'Resistor de 1 kΩ (¼ W)', detail: 'Resistor comum de protoboard.' },
  { id: 'resistor-10', label: 'Resistor de 10 Ω (5 W)', detail: 'Resistor de fio, de potência.' },
  {
    id: 'led',
    label: 'LED vermelho sem resistor',
    detail: 'LED comum: 20 mA típico, cerca de 2 V; queima acima de umas poucas dezenas de mA.',
  },
  { id: 'curto', label: 'Curto (fio entre os bornes)', detail: 'Um pedaço de fio de 0,02 Ω.' },
];

export interface SupplyState {
  vSet: number;
  iLimit: number;
  on: boolean;
  load: LoadId;
  /** The load already burned (until it is replaced). */
  burned?: boolean;
}

export type Status = 'off' | 'ok' | 'info' | 'warn' | 'danger';

export interface SupplyReading {
  mode: 'off' | 'cv' | 'cc';
  v: number;
  i: number;
  /** Power in the load (W). */
  p: number;
  /** 0–1 light of the lamp or LED. */
  glow: number;
  status: Status;
  message: string;
  /** The load burns in this state. */
  burns?: boolean;
}

// Lamp: same constants as src/engine/devices/lamp.ts.
const KELVIN = 273.15;
const T0 = 25 + KELVIN;
const T_RATED = 2700;
const T_BURN = 3300;
const LAMP_V = 12;
const LAMP_P = 5;
const R_HOT = LAMP_V ** 2 / LAMP_P;
const K = LAMP_P / (T_RATED ** 4 - T0 ** 4);

/** Filament temperature with voltage `v` across it, in equilibrium. */
export function lampTemperature(v: number): number {
  if (v <= 0) return T0;
  let lo = T0;
  let hi = 8000;
  for (let n = 0; n < 80; n++) {
    const t = (lo + hi) / 2;
    const r = R_HOT * Math.pow(t / T_RATED, 1.2);
    if (v ** 2 / r > K * (t ** 4 - T0 ** 4)) lo = t;
    else hi = t;
  }
  return (lo + hi) / 2;
}

const LED_VF = 1.75;
const LED_R = 12;
const LED_MAX = 0.03;
const LED_BURN = 0.05;
const SHORT_R = 0.02;

/** Steady current the load takes at voltage `v`. */
export function loadCurrent(load: LoadId, v: number, burned = false): number {
  if (burned || v <= 0) return 0;
  switch (load) {
    case 'nada':
      return 0;
    case 'lampada': {
      const t = lampTemperature(v);
      return v / (R_HOT * Math.pow(t / T_RATED, 1.2));
    }
    case 'resistor-1k':
      return v / 1000;
    case 'resistor-10':
      return v / 10;
    case 'led':
      return Math.max(0, (v - LED_VF) / LED_R);
    case 'curto':
      return v / SHORT_R;
  }
}

/** Output voltage where the load takes exactly `i` (the load current grows with voltage). */
function voltageFor(load: LoadId, i: number, vMax: number): number {
  let lo = 0;
  let hi = vMax;
  for (let n = 0; n < 80; n++) {
    const v = (lo + hi) / 2;
    if (loadCurrent(load, v) < i) lo = v;
    else hi = v;
  }
  return (lo + hi) / 2;
}

const fmt = (x: number, digits: number) =>
  x.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const volts = (v: number) => `${fmt(v, v < 10 ? 2 : 1)} V`;
const amps = (i: number) => (i < 1 ? `${fmt(i * 1000, i < 0.1 ? 1 : 0)} mA` : `${fmt(i, 2)} A`);
const watts = (p: number) => `${fmt(p, p < 1 ? 2 : 1)} W`;

export function read(s: SupplyState): SupplyReading {
  const vSet = Math.min(Math.max(s.vSet, 0), V_MAX);
  const iLimit = Math.min(Math.max(s.iLimit, 0), I_MAX);
  if (!s.on) {
    return {
      mode: 'off',
      v: 0,
      i: 0,
      p: 0,
      glow: 0,
      status: 'off',
      message: `Saída desligada. O visor mostra o que está ajustado: ${volts(vSet)} e limite de ${amps(iLimit)}. Ajuste os dois antes de ligar a saída.`,
    };
  }
  const burned = !!s.burned;
  const want = loadCurrent(s.load, vSet, burned);
  const cc = want > iLimit;
  const v = cc ? voltageFor(s.load, iLimit, vSet) : vSet;
  const i = cc ? iLimit : want;
  const p = v * i;
  const base = { mode: cc ? ('cc' as const) : ('cv' as const), v, i, p, glow: 0 };

  if (burned) {
    return {
      ...base,
      status: 'info',
      message: `A peça queimou e virou um circuito aberto: nenhuma corrente passa, e a fonte mostra os ${volts(v)} ajustados no modo CV. Troque a peça e baixe o limite de corrente antes de ligar de novo.`,
    };
  }

  const ccText = `Modo CC (corrente constante): a carga puxaria ${amps(want)} com ${volts(vSet)}, mais que o limite de ${amps(iLimit)}. A fonte baixou a tensão para ${volts(v)} e segura a corrente no limite.`;
  const cvText = `Modo CV (tensão constante): a fonte mantém ${volts(v)} e a carga puxa ${amps(i)}, abaixo do limite de ${amps(iLimit)}.`;

  switch (s.load) {
    case 'nada':
      return {
        ...base,
        status: 'info',
        message: `Sem carga, a corrente é zero e a fonte fica em CV com ${volts(v)} nos bornes.`,
      };
    case 'curto':
      return {
        ...base,
        status: 'ok',
        message: `Curto na saída, e nada queima: a fonte foi para CC, segura a corrente em ${amps(i)} e a tensão cai para quase zero (${volts(v)}). Sem o limite, essa corrente seria enorme.`,
      };
    case 'lampada': {
      const t = lampTemperature(v);
      const glow = Math.min(1, Math.pow(t / T_RATED, 8.8));
      if (t > T_BURN) {
        return {
          ...base,
          glow: 1,
          status: 'danger',
          burns: true,
          message: `${volts(v)} numa lâmpada de 12 V: o filamento passa do limite e a lâmpada queima.`,
        };
      }
      const look =
        glow > 0.9 ? 'acesa' : glow > 0.05 ? 'acesa, mais fraca' : 'só com o filamento morno';
      return {
        ...base,
        glow,
        status: cc ? 'info' : 'ok',
        message: `${cc ? ccText : cvText} Lâmpada ${look}.`,
      };
    }
    case 'led': {
      const glow = Math.min(1, i / 0.02);
      if (i > LED_BURN) {
        return {
          ...base,
          glow: 1,
          status: 'danger',
          burns: true,
          message: `${amps(i)} num LED feito para 20 mA: ele brilha forte por um instante e queima. Para testar um LED na fonte, o limite de corrente precisa estar em 20 mA ou menos antes de ligar.`,
        };
      }
      if (i > LED_MAX) {
        return {
          ...base,
          glow,
          status: 'warn',
          message: `${cc ? ccText : cvText} São ${amps(i)}, acima do que o LED aguenta por muito tempo. Baixe o limite para 20 mA.`,
        };
      }
      return {
        ...base,
        glow,
        status: cc ? 'ok' : 'info',
        message: cc
          ? `${ccText} O LED fica com ${volts(v)} e acende certo: o limite de corrente fez o papel do resistor.`
          : `${cvText} Com tensão tão baixa o LED mal conduz.`,
      };
    }
    case 'resistor-1k':
    case 'resistor-10': {
      const rating = s.load === 'resistor-1k' ? 0.25 : 5;
      const name = s.load === 'resistor-1k' ? 'resistor de ¼ W' : 'resistor de 5 W';
      if (p > rating * 1.5) {
        return {
          ...base,
          status: 'danger',
          burns: true,
          message: `${cc ? ccText : cvText} O ${name} está dissipando ${watts(p)}: esquenta até queimar.`,
        };
      }
      if (p > rating) {
        return {
          ...base,
          status: 'warn',
          message: `${cc ? ccText : cvText} São ${watts(p)}, acima dos ${watts(rating)} do resistor: ele esquenta além do limite.`,
        };
      }
      return {
        ...base,
        status: cc ? 'info' : 'ok',
        message: `${cc ? ccText : cvText} O resistor dissipa ${watts(p)}.`,
      };
    }
  }
}
