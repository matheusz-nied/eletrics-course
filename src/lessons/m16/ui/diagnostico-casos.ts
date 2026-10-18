/**
 * Cases of the diagnosis exercise of lesson 16.9 (DiagnosticoPortao.tsx):
 * the resident's complaint, the fault the central virtual runs, the causes
 * to choose from with their feedback, and the readings of the "Medições"
 * panel. Pure data and functions, so __tests__/diagnostico.test.ts checks
 * that every fault really shows its symptom and every reading is right,
 * without React. Winding, capacitor and battery values are typical
 * (src/lessons/m16/FONTES.md), not a manufacturer's.
 */
import type { Grupo } from './CentralVirtual';
import {
  CentralController,
  type CentralOptions,
  type CentralSnapshot,
  type WidgetFaults,
} from './central-controller';

// Measurements

export type MedicaoId =
  | 'tensao-rede'
  | 'fusivel'
  | 'capacitor'
  | 'enrolamentos'
  | 'ima-reed'
  | 'foto'
  | 'bateria'
  | 'antena'
  | 'desbloqueio'
  | 'trilho';

export interface Medicao {
  id: MedicaoId;
  /** What is measured, as a button label. */
  nome: string;
  /** Instrument and how, in one line. */
  como: string;
}

export const MEDICOES: readonly Medicao[] = [
  {
    id: 'tensao-rede',
    nome: 'Tensão entre F e N',
    como: 'Multímetro em V~, nos bornes de entrada da central.',
  },
  {
    id: 'fusivel',
    nome: 'Continuidade do fusível',
    como: 'Multímetro em continuidade, com o fusível fora do porta-fusível.',
  },
  {
    id: 'capacitor',
    nome: 'Capacitância do capacitor',
    como: 'Multímetro em capacitância, com o capacitor descarregado e um fio solto.',
  },
  {
    id: 'enrolamentos',
    nome: 'Resistência entre os fios do motor',
    como: 'Multímetro em Ω, com os três fios do motor soltos da central.',
  },
  {
    id: 'ima-reed',
    nome: 'Ímã encostado no sensor de fim de curso',
    como: 'Encoste um ímã no sensor, por fora da tampa, e olhe os LEDs FCA e FCF.',
  },
  {
    id: 'foto',
    nome: 'Tensão entre FOTO e GND',
    como: 'Multímetro em V⎓, com o caminho da fotocélula livre.',
  },
  {
    id: 'bateria',
    nome: 'Tensão da bateria do controle',
    como: 'Multímetro em V⎓ nos polos da bateria (12 V nominais, típico desses controles).',
  },
  {
    id: 'antena',
    nome: 'Olhar a antena da central',
    como: 'Inspeção: o fio da antena, o comprimento e a solda na placa.',
  },
  {
    id: 'desbloqueio',
    nome: 'Olhar a alavanca do desbloqueio',
    como: 'Inspeção: a chave ou alavanca do desbloqueio, no motor.',
  },
  {
    id: 'trilho',
    nome: 'Empurrar o portão à mão',
    como: 'Com o desbloqueio aberto, correr o portão de uma ponta à outra.',
  },
];

/** What the measurement depends on besides the fault, from the central's snapshot. */
export interface ContextoMedicao {
  /** Circuit breaker of the gate on. */
  disjuntor: boolean;
  /** The board is powered (breaker on and fuse good). */
  energizada: boolean;
  /** Someone is standing in the photocell beam. */
  feixeInterrompido: boolean;
}

export function contextoDe(snap: CentralSnapshot): ContextoMedicao {
  return {
    disjuntor: snap.disjuntor,
    energizada: snap.energizada,
    feixeInterrompido: snap.env.feixeInterrompido,
  };
}

export interface Leitura {
  texto: string;
  /**
   * The measurement was not made, or does not mean anything as it was made
   * (live circuit for an ohmmeter, board without power, someone in the
   * beam): the text says what to do first.
   */
  bloqueada: boolean;
}

const nf1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nfm = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

const DESLIGUE_ANTES =
  'Desligue o disjuntor e confirme a ausência de tensão antes. Continuidade, resistência e capacitância só se medem com o circuito desenergizado: com tensão, a leitura não vale e o multímetro pode queimar.';

/** The reading of `id` on a gate with `faults`, in the situation `ctx`. */
export function medir(id: MedicaoId, faults: WidgetFaults, ctx: ContextoMedicao): Leitura {
  const ok = (texto: string): Leitura => ({ texto, bloqueada: false });
  const antes = (texto: string): Leitura => ({ texto, bloqueada: true });
  switch (id) {
    case 'tensao-rede':
      return ctx.disjuntor
        ? ok('127 V entre F e N: a energia chega aos bornes da central.')
        : ok('0 V entre F e N: com o disjuntor desligado, a entrada está sem tensão.');
    case 'fusivel':
      if (ctx.disjuntor) return antes(DESLIGUE_ANTES);
      return faults.fusivelQueimado
        ? ok('OL, sem bipe: o fusível está aberto (queimado).')
        : ok('Bipe e 0,1 Ω: o fusível está inteiro.');
    case 'capacitor':
      if (ctx.disjuntor) {
        return antes(
          'Desligue o disjuntor, descarregue o capacitor e solte um dos fios dele antes de medir a capacitância.',
        );
      }
      return faults.capacitorAberto
        ? ok('0,0 µF, quando a etiqueta diz 40 µF: o capacitor está aberto.')
        : ok('39,2 µF, perto dos 40 µF da etiqueta: o capacitor está bom.');
    case 'enrolamentos':
      if (ctx.disjuntor) return antes(DESLIGUE_ANTES);
      return ok(
        `COM–ABRE ${nf1.format(4.8)} Ω, COM–FECHA ${nf1.format(4.9)} Ω, ABRE–FECHA ${nf1.format(9.7)} Ω (estimativa para um motor de 127 V). A maior leitura é a soma das outras duas: os enrolamentos estão inteiros. Como os dois são iguais, a resistência não diz qual fio abre e qual fecha.`,
      );
    case 'ima-reed':
      if (!ctx.disjuntor) {
        return antes(
          'Ligue o disjuntor para este teste: os LEDs FCA e FCF só acendem com a placa alimentada. O sensor é de baixa tensão; encoste o ímã por fora, sem mexer nos bornes.',
        );
      }
      if (!ctx.energizada) {
        return antes(
          'Nenhum LED acende, nem o REDE: a placa está sem alimentação. Este teste só vale com a central funcionando.',
        );
      }
      return faults.reedDefeituoso
        ? ok(
            'Nenhum LED de fim de curso acende, nem com o ímã encostado no sensor: o reed não está fechando (ou o fio dele está partido).',
          )
        : ok(
            'Com o ímã encostado no sensor, o LED de fim de curso acende (FCA ou FCF, conforme o lado): sensor e conector estão bons.',
          );
    case 'foto':
      if (!ctx.disjuntor) {
        return antes(
          'Ligue o disjuntor: a fotocélula e a entrada FOTO são alimentadas pela própria central.',
        );
      }
      if (!ctx.energizada) {
        return antes(
          '0 V entre FOTO e GND, mas também 0 V entre +12V e GND: a placa está sem alimentação, então essa leitura não diz nada sobre a fotocélula.',
        );
      }
      if (ctx.feixeInterrompido) {
        return antes(
          '5 V e o LED FOTO apagado, mas há uma pessoa no feixe. Tire a pessoa do caminho e meça de novo com o feixe livre.',
        );
      }
      return faults.fotocelulaDesalinhada || faults.semFotocelula
        ? ok(
            '5 V entre FOTO e GND com o caminho livre, e o LED FOTO apagado: o contato NF do receptor está aberto. O receptor não está vendo o feixe.',
          )
        : ok(
            '0 V entre FOTO e GND e o LED FOTO aceso: o contato NF do receptor está fechado, o feixe chega.',
          );
    case 'bateria':
      return faults.bateriaFraca
        ? ok(
            `${nf1.format(8.6)} V numa bateria de 12 V: fraca. Quando o botão é apertado, a tensão cai ainda mais.`,
          )
        : ok(`${nf1.format(12.2)} V numa bateria de 12 V: carga boa.`);
    case 'antena':
      return ok('Fio de cerca de 17 cm, inteiro, esticado e bem soldado na placa.');
    case 'desbloqueio':
      return faults.desbloqueado
        ? ok(
            'A alavanca do desbloqueio está na posição aberta: o redutor está solto do pinhão, e o motor gira sem puxar o portão.',
          )
        : ok('A alavanca está na posição travada: motor e portão estão engatados.');
    case 'trilho': {
      if (ctx.disjuntor) {
        return antes(
          'Desligue o disjuntor antes de abrir o desbloqueio e empurrar o portão: com a central ligada, um comando pode girar o pinhão perto da sua mão.',
        );
      }
      const extra = faults.atritoExtra;
      if (extra) {
        return ok(
          `Solto do motor, o portão corre leve até perto de ${nfm.format(extra.de)} m de abertura. Entre ${nfm.format(extra.de)} m e ${nfm.format(extra.ate)} m fica pesado: um trecho do trilho está amassado e sujo. Depois volta a correr leve.`,
        );
      }
      return faults.desbloqueado
        ? ok('O desbloqueio já estava aberto. O portão corre leve e por igual em todo o percurso.')
        : ok(
            'O portão corre leve e por igual em todo o percurso. Trave o desbloqueio de novo depois do teste.',
          );
    }
  }
}

// Causes and cases

export const CAUSAS = {
  semEnergia: 'Falta energia na entrada (disjuntor desarmado ou cabo partido)',
  fusivel: 'Fusível da central queimado',
  capacitor: 'Capacitor do motor aberto ou fraco',
  enrolamento: 'Enrolamento do motor queimado (aberto)',
  travado: 'Portão preso no trilho ou nas roldanas',
  desbloqueio: 'Desbloqueio manual aberto',
  pinhao: 'Pinhão gasto ou fora da cremalheira',
  fios: 'Fios ABRE e FECHA trocados na central',
  conectorFc: 'Conector do fim de curso invertido (FCA no lugar de FCF)',
  rele: 'Relé de sentido da central com defeito',
  reed: 'Sensor reed do fim de curso com defeito',
  imas: 'Ímãs do fim de curso fora do lugar',
  foto: 'Fotocélula desalinhada',
  automatico: 'Fechamento automático desligado (J2 retirado ou PAUSA no mínimo)',
  bateria: 'Bateria do controle fraca',
  antena: 'Antena da central solta ou partida',
  cadastro: 'Controle apagado da memória da central',
  atrito: 'Trecho pesado no trilho, com a FORÇA baixa demais',
} as const;

export type CausaId = keyof typeof CAUSAS;

export interface CasoDiagnostico {
  id: string;
  /** What the resident says, in their words. */
  queixa: string;
  /** What to do in the central to see the symptom. */
  tarefa: string;
  /** How the central virtual starts. */
  central: Pick<CentralOptions, 'faults' | 'settings' | 'abertura' | 'controleCadastrado'>;
  /** Control groups the case needs; always with 'energia' (the breaker). */
  grupos: Grupo[];
  /** The causes offered, in the order shown. */
  opcoes: CausaId[];
  causa: CausaId;
  /** Right answer: why it is that, how to fix and how to test. */
  explicacao: string;
  /** Each wrong option: the measurement or observation that rules it out. */
  porQueNao: Partial<Record<CausaId, string>>;
}

export const CASOS: readonly CasoDiagnostico[] = [
  {
    id: 'fusivel-queimado',
    queixa:
      'O portão morreu de vez: não obedece ao controle nem à botoeira. Na central, nenhuma luzinha acesa. A luz da casa está normal.',
    tarefa:
      'Aperte o controle e a botoeira e olhe os LEDs da placa. Depois meça: o que dá para medir com o disjuntor ligado, e o que só com ele desligado?',
    central: { faults: { fusivelQueimado: true } },
    grupos: ['comandos', 'energia'],
    opcoes: ['semEnergia', 'bateria', 'fusivel', 'capacitor'],
    causa: 'fusivel',
    explicacao:
      'A rede chega à central (127 V entre F e N), mas a placa não liga: o fusível abriu. Com o disjuntor desligado, a continuidade do fusível dá OL. Conserto: troque por um fusível do mesmo tamanho e da mesma corrente (na CD-1, 5×20 mm de 10 A), nunca por um maior. Antes de religar, procure por que ele queimou: meça os enrolamentos e o capacitor com tudo desligado. Teste: ligue o disjuntor, veja o LED REDE aceso e dê um comando.',
    porQueNao: {
      semEnergia:
        'A tensão entre F e N, medida com o disjuntor ligado, separa as duas causas: ela dá 127 V. A energia chega aos bornes; o defeito está depois deles, dentro da placa.',
      bateria:
        'A botoeira também não funciona, e ela não depende do controle. Além disso, o LED REDE apagado mostra que a placa inteira está sem alimentação.',
      capacitor:
        'Com o capacitor aberto a placa liga normalmente e o motor zumbe quando recebe o comando. Aqui nem o LED REDE acende. O capacitor não alimenta a placa.',
    },
  },
  {
    id: 'capacitor-aberto',
    queixa:
      'Quando aperto o controle, dá para ouvir o motor zumbindo, mas o portão não sai do lugar. Na semana passada ele já demorava para começar a andar.',
    tarefa:
      'Dê um comando e observe o motor e a corrente no painel. Quanto tempo a central insiste antes de desistir? (Use a velocidade 5×.)',
    central: { faults: { capacitorAberto: true } },
    grupos: ['comandos', 'energia'],
    opcoes: ['enrolamento', 'desbloqueio', 'capacitor', 'travado'],
    causa: 'capacitor',
    explicacao:
      'O capacitor cria a segunda corrente, defasada, que faz o campo girar. Aberto, o motor recebe uma corrente só: zumbe, esquenta e não parte. Com o disjuntor desligado, a capacitância dá quase zero em vez dos 40 µF da etiqueta. Conserto: descarregue e troque o capacitor por outro com o mesmo valor em µF e a mesma tensão (VCA) da etiqueta. Teste: o portão sai andando suave, sem zumbido. A central desistiu depois de 40 s sem fim de curso (ERRO): é o tempo máximo de percurso, que protege o motor travado.',
    porQueNao: {
      enrolamento:
        'Um enrolamento aberto também deixa o motor sem partida, mas a resistência entre os fios do motor separa as duas causas: com um enrolamento aberto, uma das leituras daria OL. Aqui as três são normais.',
      desbloqueio:
        'Com o desbloqueio aberto, o motor gira solto e não zumbe parado. E a alavanca está travada.',
      travado:
        'Portão preso também faz o motor zumbir parado. Para separar, desligue o disjuntor e empurre o portão à mão com o desbloqueio aberto: ele corre leve. O problema está no motor.',
    },
  },
  {
    id: 'fios-invertidos',
    queixa:
      'O técnico trocou a central ontem. Hoje cedo o portão ficou parado no meio e, quando apertei o controle para abrir, ele fechou. Depois ficou forçando contra o fim.',
    tarefa:
      'O portão está no meio e a central acabou de ligar sem saber a posição: o primeiro comando deveria abrir. Aperte o controle e veja para onde ele vai. Quer testar um conserto? O DIP INV está nos ajustes.',
    central: { faults: { fiosInvertidos: true }, abertura: 0.5 },
    grupos: ['comandos', 'ajustes', 'energia'],
    opcoes: ['conectorFc', 'fios', 'capacitor', 'rele'],
    causa: 'fios',
    explicacao:
      'Quem decide o sentido é o enrolamento que recebe a fase direto. A central liga o K1 (ABRE), mas o fio que está no borne ABRE é o do enrolamento que fecha: ABRE e FECHA foram trocados na instalação. A resistência não ajuda aqui, porque os dois enrolamentos são iguais; quem mostra o erro é o primeiro comando. Conserto: desligue o disjuntor, confirme a ausência de tensão e troque os fios ABRE e FECHA de borne, ou ligue o DIP INV. Teste: com o portão no meio e a central recém-ligada, o primeiro comando tem que abrir.',
    porQueNao: {
      conectorFc:
        'Com FCA e FCF trocados no conector, o motor sai para o lado certo e erra só na hora de parar. Aqui ele já sai no sentido errado, com a central mostrando "Abrindo" e o relé K1 ligado.',
      capacitor:
        'Sem capacitor o motor não parte, só zumbe. Aqui ele gira bem, só que para o lado errado.',
      rele: 'A central mostra o estado "Abrindo" e o relé K1 ligado: ela manda abrir, e o relé obedece. Quem gira ao contrário é o motor, porque a fase chega ao enrolamento do outro sentido.',
    },
  },
  {
    id: 'fotocelula-desalinhada',
    queixa:
      'O portão abre normal, mas não fecha mais: nem sozinho, nem pelo controle. Ontem um caminhão de entrega encostou no pilar da frente.',
    tarefa:
      'Abra o portão e espere o fechamento automático (a pausa está em 30 s). Depois tente fechar pelo controle e leia o que a central registrou.',
    central: { faults: { fotocelulaDesalinhada: true } },
    grupos: ['comandos', 'seguranca', 'energia'],
    opcoes: ['reed', 'automatico', 'bateria', 'foto'],
    causa: 'foto',
    explicacao:
      'A central só fecha com o feixe livre. Com o receptor desalinhado, o contato NF dele fica aberto, como se houvesse alguém no caminho: a tensão entre FOTO e GND fica em 5 V com o caminho livre, e o LED FOTO, apagado. Conserto: realinhe o transmissor e o receptor (muitos receptores têm um LED que mostra o alinhamento) e firme o suporte que levou a batida. Nunca coloque o J1 ou um fio no lugar da fotocélula para "resolver". Teste: LED FOTO aceso; durante o fechamento, interrompa o feixe e veja o portão voltar a abrir.',
    porQueNao: {
      reed: 'Com o fim de curso ruim, o portão erraria o lugar de parar. Aqui ele para aberto no ímã, com o LED FCA aceso, e a central registra outra coisa: "Fotocélula interrompida".',
      automatico:
        'Com o fechamento automático desligado, o controle ainda fecharia o portão. Aqui nem o controle fecha, e o registro da central diz por quê.',
      bateria:
        'O controle chega à central: ele abriu o portão, e o registro mostra o comando de fechar. A central é que se recusa a fechar.',
    },
  },
  {
    id: 'bateria-fraca',
    queixa:
      'O controle só funciona quando estou quase encostado no portão. Antes ele abria lá da esquina.',
    tarefa:
      'Aperte o controle com ele longe da central. Depois marque "Controle perto da central" e aperte de novo. E a botoeira, funciona?',
    central: { faults: { bateriaFraca: true } },
    grupos: ['comandos', 'energia'],
    opcoes: ['antena', 'bateria', 'cadastro'],
    causa: 'bateria',
    explicacao:
      'Com a bateria fraca, o controle transmite um sinal mais fraco, e o receptor só entende de perto. A tensão da bateria deu bem menos que os 12 V nominais. Conserto: troque a bateria por uma do mesmo modelo, com a polaridade certa. Teste: o controle volta a funcionar de longe. Se todos os controles da casa perderem alcance ao mesmo tempo, aí a suspeita passa a ser a antena ou o receptor da central.',
    porQueNao: {
      antena:
        'A antena solta também diminui o alcance, mas o de todos os controles. A inspeção mostra a antena inteira e bem soldada, e a bateria deste controle mede bem abaixo de 12 V.',
      cadastro:
        'Um controle apagado da memória não funcionaria nem de perto. Este funciona quando está perto: ele está cadastrado.',
    },
  },
  {
    id: 'desbloqueio-aberto',
    queixa:
      'Ontem faltou luz e a gente precisou tirar o carro. Agora, quando aperto o controle, o motor gira normal, mas o portão não sai do lugar. Depois de um tempo a central apita e uma luz fica piscando.',
    tarefa:
      'Dê um comando e observe o motor, a corrente e o portão. Use a velocidade 5× para ver o que acontece aos 40 s.',
    central: { faults: { desbloqueado: true } },
    grupos: ['comandos', 'energia'],
    opcoes: ['capacitor', 'reed', 'desbloqueio', 'pinhao'],
    causa: 'desbloqueio',
    explicacao:
      'O motor gira, mas o redutor está solto do pinhão: o desbloqueio ficou aberto depois que o portão foi aberto à mão na falta de energia. Como o portão não chega ao fim de curso, a central desliga o motor aos 40 s e entra em ERRO (LED PROG piscando e buzzer). Conserto: desligue o disjuntor, feche o desbloqueio e mova o portão um pouco à mão até o pinhão engatar. Teste: ligue o disjuntor e dê um comando; depois de um ERRO, o próximo comando abre.',
    porQueNao: {
      capacitor:
        'Sem capacitor o motor zumbe parado. Aqui ele gira: a corrente fica baixa, perto da corrente sem carga, e o painel não mostra zumbido.',
      reed: 'O ERRO aparece porque a central não viu o fim de curso em 40 s, mas o portão nem saiu do lugar: o fim de curso não explica isso. E o ímã encostado no sensor acende o LED normalmente.',
      pinhao:
        'Pinhão gasto também deixa o motor girar sem levar o portão. Antes de abrir o motor, confira o mais simples: a alavanca do desbloqueio. Ela está aberta.',
    },
  },
  {
    id: 'reed-defeituoso',
    queixa:
      'O portão abre, bate lá no fim e dá uma recuadinha. Quando mando fechar, ele vai até o fim, bate e volta a abrir sozinho. Não fica fechado de jeito nenhum.',
    tarefa:
      'Abra o portão até o fim e depois mande fechar. Observe os LEDs FCA e FCF quando ele chega a cada ponta, e leia o registro da central.',
    central: { faults: { reedDefeituoso: true } },
    grupos: ['comandos', 'energia'],
    opcoes: ['foto', 'imas', 'reed', 'atrito'],
    causa: 'reed',
    explicacao:
      'Sem o sinal do fim de curso, a central não sabe onde o portão termina. Ela só para porque, ao bater no batente, a corrente sobe e ela entende como obstáculo; no fechamento, obstáculo faz o portão voltar a abrir. Num portão sem batente firme, o motor andaria até o tempo máximo de 40 s, e a central daria ERRO. Os LEDs FCA e FCF nunca acendem, nem com o ímã encostado no sensor. Conserto: desligue o disjuntor, troque o sensor (ou conserte o fio e o conector) e confira com o ímã que os LEDs acendem. Teste: o portão para nas duas pontas pelo fim de curso, sem bater.',
    porQueNao: {
      foto: 'Com a fotocélula desalinhada o portão nem começaria a fechar. Aqui ele fecha até o fim, e a central registra obstáculo, não fotocélula. A tensão entre FOTO e GND é 0 V: o feixe chega.',
      imas: 'Ímã fora do lugar também faz o portão bater no fim. Para separar, encoste um ímã no sensor: se o LED acendesse, o sensor estaria bom e bastaria mover os ímãs. Aqui nenhum LED acende.',
      atrito:
        'Com um trecho pesado no trilho o portão pararia no meio, sempre no mesmo lugar. Aqui ele só para quando bate nas pontas, e empurrado à mão corre leve.',
    },
  },
  {
    id: 'atrito-forca-baixa',
    queixa:
      'De uns dias para cá, o portão para sozinho no meio da abertura, sempre no mesmo lugar, e volta um pouquinho. Não tem ninguém na frente.',
    tarefa:
      'Abra o portão e veja onde ele para. Leia o registro e olhe a FORÇA nos ajustes. Quer testar um conserto? Mexa na FORÇA, mas pense no que precisa ser consertado primeiro.',
    central: {
      faults: { atritoExtra: { de: 2, ate: 3, forca: 80 } },
      settings: { forca: 0.25 },
    },
    grupos: ['comandos', 'ajustes', 'energia'],
    opcoes: ['foto', 'atrito', 'reed', 'capacitor'],
    causa: 'atrito',
    explicacao:
      'A central compara a corrente do motor com a do começo do percurso. No trecho pesado do trilho, a corrente passa do limite que a FORÇA baixa permite, e ela entende como obstáculo: para e recua na abertura, volta a abrir no fechamento. Conserto: primeiro o trilho (limpar, desamassar, conferir as roldanas); depois ajuste a FORÇA para o mínimo que move o portão com folga. Subir a FORÇA sem consertar o trilho esconde o defeito e deixa o portão empurrar com mais força uma pessoa ou um carro antes de reverter. Teste: o portão faz o percurso inteiro nos dois sentidos, e o teste de obstáculo continua revertendo.',
    porQueNao: {
      foto: 'A fotocélula só age no fechamento. Aqui o portão também para quando está abrindo, sempre no mesmo trecho, e a central registra obstáculo. A tensão entre FOTO e GND é 0 V.',
      reed: 'Um fim de curso com defeito faz o portão errar nas pontas. Aqui ele para no meio, sempre perto de 2 m, e o ímã encostado no sensor acende o LED.',
      capacitor:
        'Um capacitor fraco também tira força do motor. A capacitância separa as duas causas: ela dá perto dos 40 µF da etiqueta. E, empurrado à mão, o portão fica pesado justo no trecho onde para.',
    },
  },
];

/** A fresh central virtual for a case. */
export function criarCentral(caso: CasoDiagnostico): CentralController {
  return new CentralController({ ...caso.central });
}
