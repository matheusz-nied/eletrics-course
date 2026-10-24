/**
 * Lesson 12.6: the path of "turn on the light from the phone" in a smart
 * home. The phone app reaches the ESP32 smart relay in the wall box through
 * the router, either through the maker's cloud on the internet or through a
 * local server (Home Assistant); the wall switch is wired straight to the
 * relay's input. Which links work under each failure, the typical latency
 * and the explanation the widget shows. Pure, tested in caminho.test.ts.
 */

export type Modo = 'nuvem' | 'local';
/** What the relay does when the power comes back (a real setting of many smart relays). */
export type Retorno = 'anterior' | 'desligado';

export type No =
  'celular' | 'roteador' | 'internet' | 'nuvem' | 'servidor' | 'rele' | 'lampada' | 'interruptor';

export type Meio = 'wifi' | 'cabo' | 'internet' | 'dados' | 'fio';

export interface Condicoes {
  modo: Modo;
  internetCaiu: boolean;
  wifiDesligado: boolean;
  faltaEnergia: boolean;
  foraDeCasa: boolean;
}

export const CONDICOES_INICIAIS: Condicoes = {
  modo: 'nuvem',
  internetCaiu: false,
  wifiDesligado: false,
  faltaEnergia: false,
  foraDeCasa: false,
};

export interface Trecho {
  de: No;
  para: No;
  meio: Meio;
  /** Typical time of this hop, processing included (ms). */
  ms: number;
}

const t = (de: No, para: No, meio: Meio, ms: number): Trecho => ({ de, para, meio, ms });

/** Typical totals, for the text (ms). */
export const LATENCIA_TIPICA = {
  local: { de: 50, ate: 200 },
  nuvem: { de: 300, ate: 1500 },
} as const;

/** The route of a command sent from the app, before checking what is broken. */
export function rotaDoApp(c: Condicoes): Trecho[] {
  const fim = [t('roteador', 'rele', 'wifi', 15), t('rele', 'lampada', 'fio', 15)];
  if (c.modo === 'local') {
    if (c.foraDeCasa)
      return [t('celular', 'internet', 'dados', 60), t('internet', 'roteador', 'internet', 30)];
    return [
      t('celular', 'roteador', 'wifi', 15),
      t('roteador', 'servidor', 'cabo', 5),
      t('servidor', 'roteador', 'cabo', 35),
      ...fim,
    ];
  }
  // Without Wi-Fi at home the phone falls back to mobile data on its own.
  const pelosDados = c.foraDeCasa || c.wifiDesligado;
  const ida = pelosDados
    ? [t('celular', 'internet', 'dados', 120)]
    : [t('celular', 'roteador', 'wifi', 15), t('roteador', 'internet', 'internet', 40)];
  return [
    ...ida,
    t('internet', 'nuvem', 'internet', 60),
    t('nuvem', 'internet', 'internet', 300),
    t('internet', 'roteador', 'internet', 60),
    ...fim,
  ];
}

export const ROTA_INTERRUPTOR: readonly Trecho[] = [
  t('interruptor', 'rele', 'fio', 10),
  t('rele', 'lampada', 'fio', 15),
];

export type Falha = 'energia' | 'wifi' | 'internet' | 'sem-acesso-remoto';

/** What goes dark in a power cut (the phone has a battery; the cloud is elsewhere). */
const PRECISA_DE_ENERGIA = new Set<No>(['roteador', 'servidor', 'rele', 'lampada']);

/** Why a hop does not work, or null when it does. */
export function falhaDoTrecho(tr: Trecho, c: Condicoes): Falha | null {
  if (c.faltaEnergia && (PRECISA_DE_ENERGIA.has(tr.de) || PRECISA_DE_ENERGIA.has(tr.para)))
    return 'energia';
  if (tr.meio === 'wifi' && c.wifiDesligado) return 'wifi';
  // The router does not let connections from outside reach the local server.
  if (c.modo === 'local' && tr.de === 'internet' && tr.para === 'roteador')
    return 'sem-acesso-remoto';
  const tocaInternet = tr.meio === 'internet' && (tr.de === 'roteador' || tr.para === 'roteador');
  if (tocaInternet && c.internetCaiu) return 'internet';
  return null;
}

export type Origem = 'app' | 'interruptor';

export interface Resultado {
  origem: Origem;
  caminho: Trecho[];
  chegou: boolean;
  /** Index of the hop where the command stopped. */
  paradaEm: number | null;
  falha: Falha | null;
  /** Typical time until the lamp changes (ms), when it arrives. */
  latenciaMs: number;
  /** Why, in pt-BR. */
  explicacao: string;
}

function explicar(origem: Origem, falha: Falha | null, c: Condicoes, ms: number): string {
  if (origem === 'interruptor') {
    if (falha === 'energia')
      return 'Faltou energia: o relé inteligente está desligado e não lê o interruptor, e a lâmpada também não teria energia. Nada funciona até a energia voltar.';
    return 'O interruptor da parede está ligado direto à entrada do relé: o ESP32 lê o interruptor e liga o relé na hora, sem passar pelo Wi-Fi nem pela internet.';
  }
  switch (falha) {
    case 'energia':
      return 'Faltou energia: o roteador, o relé e a lâmpada estão desligados. Nenhum comando funciona, nem pelo app nem pelo interruptor.';
    case 'wifi':
      return c.modo === 'nuvem' && !c.foraDeCasa
        ? 'O celular até manda o comando pelos dados móveis e ele chega à nuvem, mas o relé inteligente se conecta pelo Wi-Fi: sem Wi-Fi, a nuvem não tem como avisá-lo. O interruptor da parede continua funcionando, porque está ligado direto à entrada do relé.'
        : 'O relé inteligente se conecta pelo Wi-Fi. Sem Wi-Fi, nenhum comando do app chega até ele. O interruptor da parede continua funcionando, porque está ligado direto à entrada do relé.';
    case 'internet':
      return c.foraDeCasa
        ? 'O comando chega à nuvem pelos dados móveis, mas a casa está sem internet: a nuvem não alcança o relé. O interruptor da parede continua funcionando.'
        : 'Sem internet, o comando pela nuvem não chega. O app do fabricante precisa do servidor dele, mesmo com o celular e o relé na mesma casa. O interruptor da parede continua funcionando porque está ligado direto à entrada do relé.';
    case 'sem-acesso-remoto':
      return 'Fora de casa, o celular não está na rede local e não alcança o servidor (o roteador não deixa entrar conexões de fora). Para isso é preciso configurar um acesso remoto, como uma VPN.';
    case null:
      break;
  }
  const s = (ms / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  if (c.modo === 'local')
    return `O comando não sai de casa: celular → roteador → servidor local → relé. Cerca de ${s} s (típico: 50 a 200 ms), e funciona mesmo sem internet.`;
  return `O comando vai até o servidor do fabricante na internet e volta para o relé da sua casa. Cerca de ${s} s (típico: 0,3 a 1,5 s).${c.foraDeCasa ? ' Por isso funciona também fora de casa.' : ''}`;
}

export function enviar(origem: Origem, c: Condicoes): Resultado {
  const caminho = origem === 'app' ? rotaDoApp(c) : [...ROTA_INTERRUPTOR];
  let paradaEm: number | null = null;
  let falha: Falha | null = null;
  for (let i = 0; i < caminho.length; i++) {
    const f = falhaDoTrecho(caminho[i]!, c);
    if (f) {
      paradaEm = i;
      falha = f;
      break;
    }
  }
  const chegou = falha === null;
  const latenciaMs = chegou ? caminho.reduce((a, tr) => a + tr.ms, 0) : 0;
  return {
    origem,
    caminho,
    chegou,
    paradaEm,
    falha,
    latenciaMs,
    explicacao: explicar(origem, falha, c, latenciaMs),
  };
}

/** The lamp and the relay's memory of it. */
export interface Casa {
  lampada: boolean;
  /** State before the power cut, for "volta como estava". */
  antesDaFalta: boolean;
}

export const CASA_INICIAL: Casa = { lampada: false, antesDaFalta: false };

/** A command that arrived: the app sets the state it asks for, the switch toggles. */
export function aplicarComando(casa: Casa, r: Resultado, pedido: boolean): Casa {
  if (!r.chegou) return casa;
  return { ...casa, lampada: r.origem === 'app' ? pedido : !casa.lampada };
}

export function cortarEnergia(casa: Casa): Casa {
  return { lampada: false, antesDaFalta: casa.lampada };
}

export function voltarEnergia(casa: Casa, retorno: Retorno): Casa {
  return { lampada: retorno === 'anterior' ? casa.antesDaFalta : false, antesDaFalta: false };
}

export function explicarRetorno(casa: Casa, retorno: Retorno): string {
  if (retorno === 'anterior')
    return `A energia voltou e o relé religou a lâmpada como estava antes da falta (${casa.lampada ? 'acesa' : 'apagada'}). Ele ainda leva alguns segundos para se reconectar ao Wi-Fi.`;
  return 'A energia voltou e o relé ligou com a lâmpada apagada, como está configurado. Ele ainda leva alguns segundos para se reconectar ao Wi-Fi.';
}
