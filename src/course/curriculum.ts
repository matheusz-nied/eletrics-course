/**
 * The planned curriculum (docs/plano/01-curriculo.md): every module and the
 * slug of every lesson, before the content fronts write them.
 *
 * The site uses it to show what is coming ("em breve") on the home page, the
 * module catalog and the tracks, and the track YAML files point to these ids.
 * When a module is published, its YAML and lesson files take over; content
 * fronts keep the slugs below, so the tracks keep pointing to the right lessons
 * (src/course/catalog.ts checks this at build time).
 */
import type { IconName } from '../components/icons';

export interface PlannedLesson {
  /** `m01-eletricidade-do-zero/04-lei-de-ohm` */
  id: string;
  titulo: string;
  /** Lessons marked (A) in the curriculum can be skipped. */
  avancada?: boolean;
}

export interface PlannedModule {
  id: string;
  numero: number;
  parte: 1 | 2 | 3 | 4;
  titulo: string;
  resumo: string;
  icone: IconName;
  aulas: PlannedLesson[];
}

type LessonSpec = [slug: string, titulo: string, avancada?: 'A'];

function mod(
  id: string,
  parte: PlannedModule['parte'],
  titulo: string,
  resumo: string,
  icone: IconName,
  aulas: LessonSpec[],
): PlannedModule {
  const numero = Number(id.slice(1, 3));
  return {
    id,
    numero,
    parte,
    titulo,
    resumo,
    icone,
    aulas: aulas.map(([slug, t, a]) => ({
      id: `${id}/${slug}`,
      titulo: t,
      ...(a ? { avancada: true } : {}),
    })),
  };
}

export const CURRICULUM: PlannedModule[] = [
  // Parte 1 · Fundamentos
  mod(
    'm00-comece-aqui',
    1,
    'Comece aqui',
    'Como o curso funciona, as regras de segurança que valem para tudo e as ferramentas que você vai usar.',
    'inicio',
    [
      ['01-como-usar-este-curso', 'Como usar este curso'],
      ['02-seguranca-em-eletricidade', 'Segurança em eletricidade'],
      ['03-ferramentas-essenciais', 'Ferramentas essenciais'],
    ],
  ),
  mod(
    'm01-eletricidade-do-zero',
    1,
    'Eletricidade do zero',
    'Carga, corrente, tensão, resistência e potência: as grandezas que explicam qualquer circuito.',
    'raio',
    [
      ['01-atomos-eletrons-e-carga', 'Átomos, elétrons e carga'],
      ['02-corrente-eletrica', 'Corrente elétrica'],
      ['03-tensao', 'Tensão'],
      ['04-lei-de-ohm', 'Resistência e Lei de Ohm'],
      ['05-potencia-e-energia', 'Potência e energia'],
      ['06-unidades-e-ordens-de-grandeza', 'Unidades e ordens de grandeza'],
    ],
  ),
  mod(
    'm02-circuitos-cc',
    1,
    'Circuitos de corrente contínua',
    'Série, paralelo, Kirchhoff e divisores: como analisar e prever o que um circuito vai fazer.',
    'circuito',
    [
      ['01-o-circuito-eletrico', 'O circuito elétrico'],
      ['02-associacao-em-serie', 'Associação em série'],
      ['03-associacao-em-paralelo', 'Associação em paralelo'],
      ['04-circuitos-mistos', 'Circuitos mistos'],
      ['05-leis-de-kirchhoff', 'Leis de Kirchhoff'],
      ['06-divisores-de-tensao-e-corrente', 'Divisores de tensão e de corrente'],
      ['07-fontes-reais-e-baterias', 'Fontes reais e baterias'],
      ['08-thevenin-norton-e-superposicao', 'Thévenin, Norton e superposição', 'A'],
      ['09-maxima-transferencia-de-potencia', 'Máxima transferência de potência', 'A'],
    ],
  ),
  mod(
    'm03-medicoes',
    1,
    'Medições e instrumentos',
    'Multímetro, alicate amperímetro, osciloscópio e protoboard: medir certo e com segurança.',
    'multimetro',
    [
      ['01-multimetro', 'O multímetro por dentro e por fora'],
      ['02-medindo-tensao', 'Medindo tensão CC e CA com segurança'],
      ['03-medindo-corrente', 'Medindo corrente'],
      ['04-resistencia-continuidade-e-diodo', 'Resistência, continuidade e teste de diodo'],
      ['05-osciloscopio', 'Osciloscópio'],
      ['06-protoboard-e-fonte-de-bancada', 'Protoboard e fonte de bancada'],
    ],
  ),
  mod(
    'm04-passivos',
    1,
    'Componentes passivos',
    'Resistores, capacitores, indutores, fusíveis, chaves e relés: o que são e como se comportam.',
    'resistor',
    [
      ['01-resistores', 'Resistores'],
      ['02-resistores-variaveis', 'Resistores variáveis'],
      ['03-capacitores', 'Capacitores'],
      ['04-circuito-rc', 'Circuito RC'],
      ['05-indutores-e-circuito-rl', 'Indutores e circuito RL'],
      ['06-fusiveis-e-protecao', 'Fusíveis e proteção'],
      ['07-chaves-botoes-e-reles', 'Chaves, botões e relés'],
    ],
  ),

  // Parte 2 · Eletromagnetismo, corrente alternada e instalações
  mod(
    'm05-magnetismo',
    2,
    'Magnetismo e eletromagnetismo',
    'Ímãs, eletroímãs, indução, transformadores e sensores magnéticos como o fim de curso do portão.',
    'ima',
    [
      ['01-imas-e-campo-magnetico', 'Ímãs e campo magnético'],
      ['02-eletroimas-e-solenoides', 'Eletroímãs e solenoides'],
      ['03-inducao-eletromagnetica', 'Indução eletromagnética'],
      ['04-transformadores', 'Transformadores'],
      ['05-sensores-magneticos', 'Sensores magnéticos'],
      ['06-reles-e-contatores', 'Relés e contatores em detalhe'],
    ],
  ),
  mod(
    'm06-corrente-alternada',
    2,
    'Corrente alternada',
    'A senoide da tomada: valor eficaz, fase, impedância, potência e sistemas trifásicos.',
    'senoide',
    [
      ['01-da-cc-a-ca', 'Da corrente contínua à alternada'],
      ['02-pico-eficaz-e-medio', 'Pico, eficaz (RMS) e médio'],
      ['03-fase-e-fasores', 'Fase e fasores'],
      ['04-reatancia-e-impedancia', 'Reatância e impedância'],
      ['05-potencia-e-fator-de-potencia', 'Potência em CA e fator de potência'],
      ['06-ressonancia-e-filtros', 'Ressonância e filtros', 'A'],
      ['07-monofasico-bifasico-e-trifasico', 'Sistemas monofásico, bifásico e trifásico'],
    ],
  ),
  mod(
    'm07-instalacoes',
    2,
    'Instalações elétricas residenciais',
    'Da rua até a tomada: quadro, disjuntores, DR, fios, tomadas, interruptores e chuveiro.',
    'casa',
    [
      ['01-da-rua-ate-a-tomada', 'Da rua até a tomada'],
      ['02-fase-neutro-e-terra', 'Fase, neutro e terra'],
      ['03-disjuntores-dr-e-dps', 'Disjuntores, DR e DPS'],
      ['04-fios-e-cabos', 'Fios e cabos'],
      ['05-tomadas-e-plugues', 'Tomadas e plugues'],
      ['06-interruptores', 'Interruptores'],
      ['07-iluminacao', 'Iluminação'],
      ['08-chuveiro-eletrico', 'Chuveiro elétrico por dentro'],
    ],
  ),
  mod(
    'm08-motores',
    2,
    'Motores elétricos',
    'Como a eletricidade vira movimento, do motor de brinquedo ao motor do portão.',
    'motor',
    [
      ['01-motor-cc', 'Motor de corrente contínua'],
      ['02-ponte-h-e-pwm', 'Ponte H e PWM'],
      ['03-motor-de-inducao-trifasico', 'Motor de indução trifásico'],
      ['04-motor-monofasico-capacitor', 'Motor monofásico com capacitor'],
      ['05-passo-servo-e-brushless', 'Passo, servo e brushless'],
      ['06-redutores-torque-e-potencia', 'Redutores, torque e potência mecânica'],
    ],
  ),

  // Parte 3 · Eletrônica
  mod(
    'm09-semicondutores',
    3,
    'Semicondutores',
    'Diodos, LEDs, transistores, MOSFETs e TRIACs: os componentes que controlam a corrente.',
    'diodo',
    [
      ['01-juncao-pn', 'Semicondutores e junção PN'],
      ['02-diodo', 'Diodo'],
      ['03-retificadores', 'Retificadores'],
      ['04-leds', 'LEDs'],
      ['05-diodo-zener', 'Diodo Zener e regulação'],
      ['06-transistor-como-chave', 'Transistor bipolar como chave'],
      ['07-transistor-como-amplificador', 'Transistor como amplificador', 'A'],
      ['08-mosfet', 'MOSFET'],
      ['09-tiristores-e-isolamento', 'Tiristores e isolamento'],
    ],
  ),
  mod(
    'm10-fontes',
    3,
    'Fontes de alimentação e energia',
    'Fontes lineares e chaveadas, baterias, nobreak e energia solar.',
    'bateria',
    [
      ['01-fonte-linear', 'Fonte linear completa'],
      ['02-fontes-chaveadas', 'Fontes chaveadas'],
      ['03-baterias-e-nobreak', 'Baterias e nobreak'],
      ['04-energia-solar', 'Energia solar fotovoltaica'],
    ],
  ),
  mod(
    'm11-digital',
    3,
    'Eletrônica digital',
    'Níveis lógicos, portas, debounce, contadores, o 555 e PWM.',
    'logica',
    [
      ['01-analogico-e-digital', 'Analógico × digital'],
      ['02-portas-logicas', 'Portas lógicas'],
      ['03-pull-up-pull-down-e-debounce', 'Pull-up, pull-down e debounce'],
      ['04-flip-flops-contadores-e-memoria', 'Flip-flops, contadores e memória'],
      ['05-ci-555', 'O CI 555'],
      ['06-conversao-ad-da-e-pwm', 'Conversão AD/DA e PWM'],
    ],
  ),
  mod(
    'm12-microcontroladores',
    3,
    'Microcontroladores, sensores e automação',
    'Como um equipamento "pensa": GPIO, máquinas de estado, sensores, atuadores e automação.',
    'chip',
    [
      ['01-o-que-e-um-microcontrolador', 'O que é um microcontrolador'],
      ['02-maquinas-de-estado', 'Máquinas de estado'],
      ['03-sensores', 'Sensores'],
      ['04-atuadores', 'Atuadores'],
      ['05-programando-um-microcontrolador', 'Programando um microcontrolador'],
      ['06-automacao-residencial', 'Automação residencial'],
    ],
  ),
  mod(
    'm13-sem-fio',
    3,
    'Comunicação sem fio e controle remoto',
    'Ondas, antenas e controles remotos de 433 MHz, infravermelho, Bluetooth e Wi-Fi.',
    'antena',
    [
      ['01-ondas-eletromagneticas', 'Ondas eletromagnéticas'],
      ['02-antenas', 'Antenas'],
      ['03-controles-remotos', 'Controles remotos'],
      ['04-infravermelho-bluetooth-e-wifi', 'Infravermelho, Bluetooth e Wi-Fi'],
    ],
  ),

  // Parte 4 · Oficina
  mod(
    'm14-placas',
    4,
    'Placas eletrônicas: leitura, montagem e solda',
    'Ler esquemas, reconhecer cada peça de uma placa, configurar jumpers e soldar bem.',
    'placa',
    [
      ['01-simbolos-e-esquemas', 'Símbolos e leitura de esquemas'],
      ['02-anatomia-da-placa', 'Anatomia de uma placa de circuito impresso'],
      ['03-identificando-componentes', 'Identificando componentes numa placa'],
      ['04-jumpers-e-dip-switches', 'Jumpers, DIP switches e configuração'],
      ['05-soldagem-e-dessoldagem', 'Soldagem e dessoldagem'],
      ['06-bornes-conectores-e-emendas', 'Bornes, conectores e emendas'],
    ],
  ),
  mod(
    'm15-diagnostico',
    4,
    'Diagnóstico e manutenção',
    'Do sintoma à causa: testar componentes e achar o defeito com método.',
    'lupa',
    [
      ['01-metodo-de-diagnostico', 'Método de diagnóstico'],
      ['02-testando-componentes', 'Testando componentes'],
      ['03-defeitos-comuns', 'Defeitos comuns em placas e fontes'],
      ['04-aparelho-que-nao-liga', 'Caso guiado: aparelho que não liga'],
    ],
  ),
  mod(
    'm16-portao',
    4,
    'Projeto real: automatizador de portão',
    'Motor, central, sensores e controle: trocar e ajustar o automatizador com segurança.',
    'portao',
    [
      ['01-anatomia-do-automatizador', 'Anatomia de um automatizador'],
      ['02-o-motor-do-portao', 'O motor do portão'],
      ['03-a-central-por-dentro', 'A central por dentro'],
      ['04-fim-de-curso-e-sensores', 'Fim de curso e sensores'],
      ['05-seguranca-e-acessorios', 'Segurança e acessórios'],
      ['06-controle-remoto-e-receptor', 'Controle remoto e receptor'],
      ['07-trocar-motor-e-central', 'Prática: trocar o motor e a central'],
      ['08-ajustes-e-testes', 'Ajustes e testes finais'],
      ['09-diagnostico-do-portao', 'Diagnóstico de defeitos do portão'],
    ],
  ),
  mod(
    'm17-projetos',
    4,
    'Mais projetos da vida real',
    'Ventilador de teto, interruptor paralelo, fita de LED, fechadura, carro, backup e automação.',
    'ferramenta',
    [
      ['01-ventilador-de-teto', 'Ventilador de teto'],
      ['02-escada-interruptor-paralelo', 'Escada com interruptor paralelo e sensor de presença'],
      ['03-fita-de-led', 'Fita de LED com fonte e dimmer'],
      ['04-fechadura-e-porteiro', 'Fechadura elétrica e porteiro eletrônico'],
      ['05-sistema-eletrico-do-carro', 'Sistema elétrico do carro'],
      ['06-backup-de-energia', 'Backup de energia'],
      ['07-lampada-com-esp32', 'Automatizar uma lâmpada com ESP32 e relé'],
    ],
  ),
];
