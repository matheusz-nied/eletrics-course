/**
 * Firmware of the generic gate central CD-1 (docs/plano/05-portao.md,
 * sections 3 and 5.2), loaded by the `mcu` device as
 * `params.firmware = "m16/central-generica"`.
 *
 * This file is the electrical side of the program: which pin is which, the
 * pull-ups (an open contact reads high, a closed one low), the ADC scales,
 * and the outputs. The logic is in src/lessons/m16/central/controller.ts.
 */
import {
  CONFIG,
  fatorLimite,
  initialState,
  nivelForca,
  stepCentral,
  tempoPausa,
  type CentralInputs,
  type CentralState,
  type ControleCadastrado,
} from '../central/controller';
import { defineFirmware, type FirmwarePin, type PinValue } from '../central/firmware-api';

/** Microcontroller supply and ADC reference (V). */
export const VCC = 5;

/**
 * Current sensor on the motor common: a shunt and an amplifier give this
 * many volts per ampere (RMS) at the CORRENTE pin, 10 A at full scale.
 */
export const SENSOR_CORRENTE_V_POR_A = 0.5;

const PINS: FirmwarePin[] = [
  { name: 'FCA', kind: 'digital-in', pullUp: true, label: 'Fim de curso de abertura' },
  { name: 'FCF', kind: 'digital-in', pullUp: true, label: 'Fim de curso de fechamento' },
  { name: 'BOT', kind: 'digital-in', pullUp: true, label: 'Botoeira' },
  { name: 'FOTO', kind: 'digital-in', pullUp: true, label: 'Fotocélula (contato NF)' },
  { name: 'PROG', kind: 'digital-in', pullUp: true, label: 'Botão PROG' },
  { name: 'J1', kind: 'digital-in', pullUp: true, label: 'Jumper J1 FOTO' },
  { name: 'J2', kind: 'digital-in', pullUp: true, label: 'Jumper J2 AUT' },
  { name: 'INV', kind: 'digital-in', pullUp: true, label: 'DIP 1 INV' },
  { name: 'LUZ', kind: 'digital-in', pullUp: true, label: 'DIP 2 LUZ' },
  { name: 'PAUSA', kind: 'analog-in', label: 'Trimpot PAUSA' },
  { name: 'FORCA', kind: 'analog-in', label: 'Trimpot FORÇA' },
  { name: 'CORRENTE', kind: 'analog-in', label: 'Sensor de corrente do motor' },
  { name: 'K1', kind: 'digital-out', label: 'Bobina do relé K1 (ABRE)' },
  { name: 'K2', kind: 'digital-out', label: 'Bobina do relé K2 (FECHA)' },
  { name: 'TRIAC', kind: 'phase-out', label: 'Disparo do TRIAC (força)' },
  { name: 'TRAVA', kind: 'digital-out', label: 'Trava eletromagnética' },
  { name: 'AUX', kind: 'digital-out', label: 'Relé auxiliar (luz de garagem)' },
  { name: 'BUZZER', kind: 'digital-out', label: 'Buzzer' },
  { name: 'LED_PROG', kind: 'digital-out', label: 'LED PROG' },
];

/** A contact to GND (closed, fitted, DIP on) pulls the pin low. Unconnected reads high. */
function low(pins: Record<string, PinValue>, name: string): boolean {
  return pins[name] === false;
}

function volts(pins: Record<string, PinValue>, name: string): number {
  const v = pins[name];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** The pins as the program sees them. */
export function readPins(
  pins: Record<string, PinValue>,
  rf: CentralInputs['rf'] = [],
): CentralInputs {
  return {
    fca: low(pins, 'FCA'),
    fcf: low(pins, 'FCF'),
    botoeira: low(pins, 'BOT'),
    feixeLivre: low(pins, 'FOTO'),
    prog: low(pins, 'PROG'),
    j1: low(pins, 'J1'),
    j2: low(pins, 'J2'),
    inv: low(pins, 'INV'),
    luz: low(pins, 'LUZ'),
    pausa: volts(pins, 'PAUSA') / VCC,
    forca: volts(pins, 'FORCA') / VCC,
    corrente: volts(pins, 'CORRENTE') / SENSOR_CORRENTE_V_POR_A,
    rf,
  };
}

export default defineFirmware<CentralState>({
  id: 'm16/central-generica',
  title: 'Central genérica CD-1',
  description:
    'Programa da central de portão do curso: abre, para no fim de curso, fecha sozinha depois da pausa, volta a abrir com a fotocélula ou com obstáculo, cadastra controles e desliga o motor se o percurso passar de 40 s.',
  period: 0.01,
  vcc: VCC,
  pins: PINS,
  init: (memory) => initialState(memory as { controles: ControleCadastrado[] } | undefined),
  persist: (state) => ({ controles: state.memoria.controles }),
  step(state, input) {
    const inputs = readPins(input.pins, input.rf);
    const { state: next, outputs, events } = stepCentral(state, inputs, input.dt);
    const pausa = tempoPausa(inputs.pausa);
    const ref = next.esforco.referencia;
    return {
      state: next,
      pins: {
        K1: outputs.k1,
        K2: outputs.k2,
        TRIAC: outputs.triac,
        TRAVA: outputs.trava,
        AUX: outputs.aux,
        BUZZER: outputs.buzzer,
        LED_PROG: outputs.ledProg,
      },
      readouts: {
        estado: next.estado,
        sentido: next.ultimoSentido,
        motor: next.motor.fase,
        fotocelula: inputs.j1 ? 'ignorada' : inputs.feixeLivre ? 'livre' : 'interrompida',
        controles: next.memoria.controles.length,
        cadastro: next.prog.modo === 'cadastro',
        fechamentoAutomatico: inputs.j2 && pausa > 0,
        pausa,
        pausaRestante:
          next.estado === 'ABERTO' && inputs.j2 && pausa > 0 ? Math.max(0, pausa - next.tPausa) : 0,
        tempoPercurso: next.tMovimento,
        forca: nivelForca(inputs.forca),
        corrente: inputs.corrente,
        limiteCorrente: ref === null ? 0 : ref * fatorLimite(inputs.forca),
        tempoMaximo: CONFIG.tempoMaximo,
      },
      events,
    };
  },
});
