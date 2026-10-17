/**
 * What a typical autoranging digital multimeter shows (and what happens to it)
 * for each selector position, red-lead jack and thing the probes touch. Pure,
 * so lesson 3.1's trainer can be unit-tested (rules.test.ts).
 *
 * The meter modeled here is the common handheld kind: input resistance of
 * 10 MΩ on the voltage ranges, a 400 mA fused jack and a 10 A fused jack whose
 * shunts sit permanently between the jack and COM (so a current jack across a
 * voltage source is a short whatever the selector says), CAT III 600 V.
 * Values are typical, for teaching, not from a manufacturer.
 */

export type Fn = 'off' | 'vdc' | 'vac' | 'ohm' | 'cont' | 'ma' | 'a';
export type Jack = '10a' | 'ma' | 'vohm';
export type Target =
  'ar' | 'pilha' | 'bateria9' | 'tomada' | 'resistor' | 'fio' | 'serie-lampada' | 'serie-led';

export const FUNCTIONS: { id: Fn; label: string; symbol: string }[] = [
  { id: 'off', label: 'Desligado', symbol: 'OFF' },
  { id: 'vdc', label: 'Tensão contínua', symbol: 'V⎓' },
  { id: 'vac', label: 'Tensão alternada', symbol: 'V~' },
  { id: 'ohm', label: 'Resistência', symbol: 'Ω' },
  { id: 'cont', label: 'Continuidade e diodo', symbol: '·)))' },
  { id: 'ma', label: 'Corrente em miliampères', symbol: 'mA' },
  { id: 'a', label: 'Corrente até 10 A', symbol: 'A' },
];

export const JACKS: { id: Jack | 'com'; label: string; short: string; detail: string }[] = [
  {
    id: '10a',
    label: '10A',
    short: 'corrente até 10 A',
    detail: 'corrente até 10 A, com fusível de 10 A',
  },
  {
    id: 'ma',
    label: 'mA',
    short: 'corrente até 400 mA',
    detail: 'corrente até 400 mA, com fusível de 400 mA',
  },
  { id: 'com', label: 'COM', short: 'comum', detail: 'comum: a ponta preta fica sempre aqui' },
  {
    id: 'vohm',
    label: 'VΩ',
    short: 'tensão e resistência',
    detail: 'tensão, resistência, continuidade e diodo',
  },
];

export const TARGETS: { id: Target; label: string; detail: string }[] = [
  { id: 'ar', label: 'Nada (pontas no ar)', detail: 'As pontas não tocam em nada.' },
  { id: 'pilha', label: 'Polos de uma pilha AA', detail: 'Pilha alcalina nova, 1,5 V nominal.' },
  {
    id: 'bateria9',
    label: 'Polos de uma bateria de 9 V',
    detail: 'Bateria alcalina nova.',
  },
  {
    id: 'tomada',
    label: 'Furos de uma tomada de 127 V',
    detail: 'Fase e neutro de uma tomada energizada.',
  },
  {
    id: 'resistor',
    label: 'Terminais de um resistor de 4,7 kΩ',
    detail: 'Resistor solto, fora do circuito.',
  },
  { id: 'fio', label: 'As duas pontas de um fio', detail: 'Um fio inteiro, sem emenda.' },
  {
    id: 'serie-lampada',
    label: 'Em série com uma lâmpada de 12 V e 5 W',
    detail: 'O circuito foi aberto e as pontas fecham o caminho no lugar do fio.',
  },
  {
    id: 'serie-led',
    label: 'Em série com um LED (20 mA)',
    detail: 'LED com resistor numa fonte de 5 V, aberto para medir a corrente.',
  },
];

export type Status = 'off' | 'ok' | 'info' | 'warn' | 'danger';

export interface Reading {
  /** Characters for the display: digits with ".", " OL", "----" or "" (blank). */
  digits: string;
  /** Unit with prefix shown at the right of the display: "V", "mA", "kΩ". */
  unit: string;
  /** Small flags at the top of the display. */
  flags: string[];
  /** Continuity beeper on. */
  beep: boolean;
  status: Status;
  /** What is going on, in pt-BR, for the student. */
  message: string;
  /** The fuse of this jack blows now. */
  blows?: 'ma' | '10a';
  /** The lamp or LED in a series target lights (current flows through the meter). */
  loadOn?: boolean;
}

export interface MeterState {
  fn: Fn;
  red: Jack;
  target: Target;
  /** Fuses already blown. */
  blown: { ma: boolean; '10a': boolean };
}

const SOURCES: Record<string, { volts: number; r: number; name: string }> = {
  pilha: { volts: 1.58, r: 0.15, name: 'a pilha' },
  bateria9: { volts: 9.42, r: 1.7, name: 'a bateria' },
  tomada: { volts: 127, r: 0.3, name: 'a tomada' },
};

/** Shunt plus fuse resistance of each current jack (typical). */
const JACK_R: Record<'ma' | '10a', number> = { ma: 1.2, '10a': 0.02 };
const JACK_LIMIT: Record<'ma' | '10a', number> = { ma: 0.4, '10a': 10 };

const SERIES: Record<string, { volts: number; amps: number; name: string }> = {
  'serie-lampada': { volts: 12, amps: 0.417, name: 'a lâmpada' },
  'serie-led': { volts: 5, amps: 0.02, name: 'o LED' },
};

/** 4-digit autorange display: 1.580 V, 127.0 V, 4.700 kΩ, 20.00 mA. */
export function displayValue(
  value: number,
  unit: string,
  noPrefix = false,
): { digits: string; unit: string } {
  const abs = Math.abs(value);
  let scale = 1;
  let prefix = '';
  if (noPrefix) {
    // The 10 A range shows amperes with three decimals: 0.417 A.
  } else if (unit === 'Ω') {
    if (abs >= 1e6) [scale, prefix] = [1e6, 'M'];
    else if (abs >= 1e3) [scale, prefix] = [1e3, 'k'];
  } else if (abs > 0 && abs < 1) {
    [scale, prefix] = [1e-3, 'm'];
  }
  const v = value / scale;
  const intDigits = Math.max(1, Math.floor(Math.log10(Math.max(Math.abs(v), 1))) + 1);
  const decimals = Math.max(0, 4 - intDigits);
  const sign = v < 0 ? '-' : ' ';
  return { digits: sign + Math.abs(v).toFixed(decimals), unit: prefix + unit };
}

type Rest = Omit<Reading, 'digits' | 'unit' | 'flags'>;

function show(value: number, unit: string, flags: string[], rest: Rest, noPrefix = false): Reading {
  return { ...displayValue(value, unit, noPrefix), flags, ...rest };
}

const OL = (unit: string, flags: string[], rest: Rest): Reading => ({
  digits: ' OL',
  unit,
  flags,
  ...rest,
});

export function read(s: MeterState): Reading {
  const { fn, red, target, blown } = s;
  const source = SOURCES[target];
  const series = SERIES[target];
  const flags =
    fn === 'vdc' || fn === 'ma' || fn === 'a'
      ? ['AUTO', 'DC']
      : fn === 'vac'
        ? ['AUTO', 'AC']
        : fn === 'off'
          ? []
          : ['AUTO'];

  // A current jack across a voltage source is a short through the shunt,
  // whatever the selector says (the shunt is wired between the jack and COM).
  if (red !== 'vohm' && source) {
    const jack = red;
    const jackName = jack === 'ma' ? 'mA' : '10A';
    if (blown[jack]) {
      return {
        digits: fn === 'off' ? '' : fn === 'ma' || fn === 'a' ? ' 0.000' : ' 0.000',
        unit: fn === 'ma' ? 'mA' : fn === 'a' ? 'A' : fn === 'off' ? '' : 'V',
        flags,
        beep: false,
        status: 'warn',
        message: `O fusível do borne ${jackName} já está queimado, então nada passa por ele. Troque o fusível (pelo mesmo valor) e tire a ponta vermelha do borne de corrente antes de encostar numa fonte.`,
      };
    }
    const current = source.volts / (source.r + JACK_R[jack]);
    if (current > JACK_LIMIT[jack] * 1.5 || target === 'tomada') {
      const arc =
        target === 'tomada'
          ? ' Na tomada isso é um curto na rede: um arco elétrico com centenas de ampères. Multímetros baratos, sem fusível de alta capacidade, podem explodir na mão.'
          : '';
      return {
        digits: fn === 'off' ? '' : ' 0.000',
        unit: fn === 'ma' ? 'mA' : fn === 'a' ? 'A' : fn === 'off' ? '' : 'V',
        flags,
        beep: false,
        status: 'danger',
        blows: jack,
        message: `Curto-circuito! Com a ponta vermelha no borne ${jackName}, o multímetro é praticamente um fio entre os polos de ${source.name}: passou ${
          current >= 10
            ? `mais de ${Math.floor(current)} A`
            : `cerca de ${current.toFixed(1).replace('.', ',')} A`
        } e o fusível de ${jack === 'ma' ? '400 mA' : '10 A'} queimou. Isso acontece mesmo com o seletor em tensão: o caminho é pelo borne.${arc}`,
      };
    }
    // 10 A jack on a small battery: a sustained short the fuse does not catch.
    if (fn === 'a') {
      return show(
        current,
        'A',
        flags,
        {
          beep: false,
          status: 'danger',
          message: `Curto-circuito em ${source.name}: o borne de 10 A deixa passar cerca de ${current
            .toFixed(1)
            .replace('.', ',')} A, e o fusível de 10 A não queima. ${
            source.name === 'a pilha' ? 'A pilha' : 'A bateria'
          } esquenta rápido e pode vazar. Corrente se mede em série com uma carga, nunca direto nos polos.`,
        },
        true,
      );
    }
    return {
      digits: fn === 'off' ? '' : ' 0.000',
      unit: fn === 'ma' ? 'mA' : fn === 'off' ? '' : 'V',
      flags,
      beep: false,
      status: 'danger',
      message: `Curto-circuito em ${source.name}: a ponta vermelha está no borne de 10 A, que é praticamente um fio. Passam cerca de ${current
        .toFixed(1)
        .replace(
          '.',
          ',',
        )} A e ${source.name} esquenta, mesmo com o seletor fora de corrente. Volte a ponta vermelha para o VΩ.`,
    };
  }

  if (fn === 'off') {
    return {
      digits: '',
      unit: '',
      flags,
      beep: false,
      status: 'off',
      message: 'Multímetro desligado. Gire o seletor para escolher o que medir.',
    };
  }

  // Current functions.
  if (fn === 'ma' || fn === 'a') {
    const want: Jack = fn === 'ma' ? 'ma' : '10a';
    const unit = fn === 'ma' ? 'mA' : 'A';
    if (red !== want) {
      const where = fn === 'ma' ? 'mA' : '10A';
      return {
        digits: ' 0.000',
        unit,
        flags,
        beep: false,
        status: 'info',
        loadOn: !!series && red !== 'vohm',
        message:
          red === 'vohm'
            ? `O seletor está em corrente, mas a ponta vermelha está no VΩ. A corrente não passa pelo medidor de corrente: mude a ponta vermelha para o borne ${where}.`
            : `O seletor e o borne não combinam: para a posição ${unit} do seletor, a ponta vermelha vai no borne ${where}.`,
      };
    }
    if (blown[want]) {
      return {
        digits: ' 0.000',
        unit,
        flags,
        beep: false,
        status: 'warn',
        message: `O fusível do borne ${want === 'ma' ? 'mA' : '10A'} está queimado: o multímetro mostra zero e ${
          series ? `${series.name} fica apagado` : 'nada passa'
        }. Troque o fusível pelo mesmo valor e tipo.`,
      };
    }
    if (!series) {
      return {
        digits: ' 0.000',
        unit,
        flags,
        beep: false,
        status: 'info',
        message:
          'Zero: para medir corrente, o multímetro precisa ficar em série, no caminho da corrente. Escolha um dos alvos "Em série".',
      };
    }
    if (want === 'ma' && series.amps > JACK_LIMIT.ma) {
      return OL('mA', flags, {
        beep: false,
        status: 'warn',
        loadOn: true,
        message: `${series.name[0]!.toUpperCase()}${series.name.slice(1)} puxa cerca de 0,42 A, mais que os 400 mA do borne mA: o visor mostra OL e o fusível corre risco. Corrente acima de 400 mA se mede no borne 10A, com o seletor em A.`,
      });
    }
    return show(
      series.amps,
      'A',
      flags,
      {
        beep: false,
        status: 'ok',
        loadOn: true,
        message:
          want === '10a' && series.amps < 0.1
            ? `Certo, ${series.name} acende e o visor mostra a corrente. Para correntes pequenas como esta, o borne mA mostra mais casas decimais.`
            : `Certo: multímetro em série, ponta vermelha no borne de corrente e seletor em ${unit}. A corrente atravessa o multímetro e ${series.name} acende.`,
      },
      want === '10a',
    );
  }

  // Voltage, resistance and continuity: the red lead must be in VΩ.
  if (red !== 'vohm') {
    return {
      digits: ' 0.000',
      unit: fn === 'vdc' || fn === 'vac' ? 'V' : 'Ω',
      flags,
      beep: false,
      status: 'warn',
      loadOn: !!series && !blown[red],
      message: `A ponta vermelha está no borne de corrente (${red === 'ma' ? 'mA' : '10A'}). Para tensão, resistência e continuidade ela vai no VΩ. Deixar a ponta no borne de corrente é o erro que mais queima fusível de multímetro.`,
    };
  }

  if (fn === 'vdc' || fn === 'vac') {
    const ac = fn === 'vac';
    if (source) {
      if (target === 'tomada') {
        return ac
          ? show(127, 'V', flags, {
              beep: false,
              status: 'ok',
              message:
                'Certo: 127 V eficazes entre fase e neutro. Medir a tomada exige multímetro com categoria CAT II ou maior, pontas em bom estado e dedos atrás das proteções das pontas.',
            })
          : show(0, 'V', flags, {
              beep: false,
              status: 'warn',
              message:
                'Quase zero na tomada? O seletor está em tensão contínua (V⎓): a média da senoide da rede é zero. Para a tomada, use V~. Nunca conclua "sem tensão" sem conferir o modo.',
            });
      }
      return ac
        ? show(0, 'V', flags, {
            beep: false,
            status: 'warn',
            message: `No modo V~, ${source.name} mostra zero: ela é de tensão contínua. Use V⎓.`,
          })
        : show(source.volts, 'V', flags, {
            beep: false,
            status: 'ok',
            message: `Certo: ${source.volts.toFixed(2).replace('.', ',')} V. Tensão se mede em paralelo, com as pontas nos dois pontos. Invertendo as pontas, aparece um sinal de menos.`,
          });
    }
    if (series) {
      return ac
        ? show(0, 'V', flags, {
            beep: false,
            status: 'info',
            message:
              'O circuito é de corrente contínua, então o modo V~ mostra zero. Repare também que o voltímetro em série deixa a carga apagada.',
          })
        : show(series.volts, 'V', flags, {
            beep: false,
            status: 'warn',
            message: `Em série, o voltímetro mostra a tensão inteira da fonte (${series.volts} V) e ${series.name} fica apagado: os 10 MΩ do multímetro funcionam como um circuito aberto. Tensão se mede em paralelo.`,
          });
    }
    return show(0, 'V', flags, {
      beep: false,
      status: 'info',
      message:
        target === 'ar'
          ? 'Zero, ou alguns milivolts oscilando: com as pontas no ar não há nada para medir.'
          : 'Zero: um resistor solto ou um fio não têm tensão própria. Tensão só existe com uma fonte no circuito.',
    });
  }

  // Resistance and continuity.
  const cont = fn === 'cont';
  const unit = 'Ω';
  if (source) {
    const danger = target === 'tomada';
    return {
      digits: danger ? ' OL' : '----',
      unit,
      flags,
      beep: false,
      status: danger ? 'danger' : 'warn',
      message: danger
        ? 'Nunca meça resistência ou continuidade numa tomada. Multímetros com boa proteção só mostram uma leitura sem sentido; os mais simples podem queimar. Resistência se mede sempre com o circuito desligado.'
        : `Leitura sem sentido: o ohmímetro funciona injetando uma pequena corrente própria, e a tensão de ${source.name} atrapalha a medida. Resistência e continuidade se medem com o circuito desligado.`,
    };
  }
  if (series) {
    return {
      digits: '----',
      unit,
      flags,
      beep: false,
      status: 'warn',
      message:
        'Leitura sem sentido: o circuito está energizado. Desligue a fonte antes de medir resistência ou continuidade.',
    };
  }
  if (target === 'ar') {
    return OL(cont ? 'Ω' : 'MΩ', flags, {
      beep: false,
      status: 'info',
      message:
        'OL (overload, fora da escala): resistência maior do que o multímetro consegue medir. Com as pontas no ar, é o ar entre elas.',
    });
  }
  if (target === 'fio') {
    return show(0.2, unit, flags, {
      beep: cont,
      status: 'ok',
      message: cont
        ? 'Bipe! Continuidade: o fio está inteiro. O valor (cerca de 0,2 Ω) é quase todo das próprias pontas de prova.'
        : 'Cerca de 0,2 Ω: o fio está inteiro. Encoste uma ponta na outra para ver quanto é das próprias pontas e desconte.',
    });
  }
  // Resistor of 4,7 kΩ.
  return cont
    ? OL(unit, flags, {
        beep: false,
        status: 'info',
        message:
          'Sem bipe: no modo continuidade o multímetro só apita abaixo de algumas dezenas de ohms, e 4,7 kΩ é bem mais que isso. Para saber o valor, use a posição Ω.',
      })
    : show(4700, unit, flags, {
        beep: false,
        status: 'ok',
        message:
          'Certo: 4,70 kΩ, com o resistor fora do circuito. Medido ainda soldado na placa, outros componentes em paralelo mudariam a leitura.',
      });
}
