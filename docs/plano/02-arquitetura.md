# 02 · Arquitetura técnica

## 1. Visão geral

O curso é um **site estático** gerado no build e publicado como arquivos (sem servidor, sem banco de dados). Toda a interatividade roda no navegador do aluno:

```
                 ┌─────────────────────────── navegador ───────────────────────────┐
  aula .mdx ──►  │  página Astro (HTML estático)                                    │
                 │    ├─ texto, fórmulas (KaTeX), figuras SVG                        │
                 │    ├─ ilha <Simulation>  ──►  esquemático 2D + instrumentos      │
                 │    │        │                       ▲                             │
                 │    │        ▼                       │ SimFrame (60×/s)            │
                 │    │   motor de simulação (Web Worker, TypeScript puro)          │
                 │    │        │                                                     │
                 │    │        └──► cena 3D ligada (LED brilha, relé estala, motor)  │
                 │    ├─ ilha <Model3D>/<Scene3D>  ──►  React Three Fiber (WebGL)    │
                 │    ├─ ilha <WiringExercise> ──► bancada 3D + motor de simulação   │
                 │    └─ ilha <Quiz>, progresso (localStorage), busca (Pagefind)     │
                 └──────────────────────────────────────────────────────────────────┘
```

Não há backend. O progresso do aluno fica no `localStorage` (com exportar/importar). Se um dia for preciso sincronizar progresso entre aparelhos, dá para adicionar um serviço externo sem mudar o resto da arquitetura.

## 2. Stack e por quê

Versões de referência em outubro de 2026. A Fundação fixa as versões exatas no lockfile.

| Peça | Escolha | Por quê |
|------|---------|---------|
| Framework do site | **Astro 7** + `@astrojs/mdx` + `@astrojs/react` | Site de conteúdo com "ilhas" interativas: o HTML das aulas é estático e rápido; só simulações e 3D carregam JavaScript, e só quando aparecem na tela. Content Collections validam o frontmatter das aulas com schema |
| Linguagem | **TypeScript** estrito | Contratos claros entre frentes que trabalham em paralelo |
| UI interativa | **React 19** | Ecossistema do React Three Fiber |
| 3D | **three.js 0.186** + **@react-three/fiber 9** + **@react-three/drei 10** + **@react-three/postprocessing 3** | Padrão de mercado para 3D na web, PBR, sombras, pós-processamento (bloom para LEDs, oclusão de ambiente) |
| Simulação | **Motor próprio em TypeScript** (Análise Nodal Modificada) num Web Worker | Precisa ser interativo em tempo real (mexer num potenciômetro com o circuito rodando), mostrar componentes queimando e dirigir a cena 3D. ngspice em WebAssembly é preciso, mas funciona em lote e não permite isso. O ngspice nativo entra só nos testes, como referência de precisão |
| Estado compartilhado | **zustand 5** | Liga simulação, controles e cena 3D sem acoplamento |
| Gráficos | **uPlot** | Osciloscópio e gráficos ao vivo a 60 fps |
| Fórmulas | **KaTeX** via `remark-math` + `rehype-katex` | Renderiza no build, sem custo no navegador |
| Estilo | **Tailwind CSS 4** + tokens de design em CSS | Rápido de escrever e consistente |
| Validação de dados | **zod 4** | Schemas de frontmatter, circuitos e cenários |
| Busca | **Pagefind** | Busca estática em português, gerada no build |
| Offline | **@vite-pwa/astro** | Modo oficina funciona sem internet (no quintal, ao lado do portão) |
| Testes | **Vitest** (unidade), **Playwright** (ponta a ponta, Chromium já instalado no ambiente) | Motor testado contra ngspice; páginas testadas no navegador real |
| Qualidade | ESLint, Prettier, `astro check` | |
| Pacotes | **pnpm** | Rápido e determinístico |
| Hospedagem | **GitHub Pages** via GitHub Actions (padrão; ver decisão pendente no README) | Grátis, no mesmo repositório (público), sem conta extra |

Fontes: Inter (texto) e JetBrains Mono (valores e código), servidas pelo próprio site via `@fontsource`.

## 3. Estrutura de pastas e donos

Cada pasta tem uma frente de trabalho dona (ver [04-frentes-de-trabalho.md](04-frentes-de-trabalho.md)). Frentes paralelas não editam os mesmos arquivos.

```
/
├─ CLAUDE.md                     regras para todas as threads (Fundação)
├─ docs/plano/                   este plano (Planejamento; ajustes via coordenador)
├─ astro.config.mjs, package.json, tsconfig.json, vitest.config.ts,
│  playwright.config.ts, eslint/prettier, .github/            (Fundação)
├─ public/
│  ├─ hdri/, textures/           ambientes e texturas CC0 (Kit 3D)
│  └─ models/                    GLB opcionais (Cenas reais)
├─ src/
│  ├─ content.config.ts          schemas das coleções (Fundação)
│  ├─ content/
│  │  ├─ modulos/mNN-*.yaml      metadados de cada módulo (frente de conteúdo do módulo)
│  │  ├─ aulas/mNN-*/NN-*.mdx    aulas (frente de conteúdo do módulo)
│  │  ├─ glossario/*.md          um arquivo por termo (qualquer frente; verificar se já existe)
│  │  └─ trilhas/*.yaml          trilhas (Experiência)
│  ├─ engine/                    motor de simulação, sem DOM (Simulação)
│  │  ├─ contract.ts             contrato público (criado pela Fundação, mantido pela Simulação)
│  │  ├─ format/                 documento de circuito → netlist
│  │  ├─ solver/                 MNA, LU, Newton-Raphson
│  │  ├─ devices/                um arquivo por dispositivo (auto-registro)
│  │  ├─ analysis/               cc, transiente, varredura CA, quase-estático
│  │  └─ runtime/                Web Worker e laço em tempo real
│  ├─ circuit/                   esquemático 2D, controles, instrumentos, áudio, <Simulation> (Esquemático)
│  │  └─ symbols/                um arquivo por tipo de dispositivo (auto-registro)
│  ├─ three/                     kit 3D (Kit 3D)
│  │  ├─ core/                   palco, câmera, luz, qualidade, fallback
│  │  ├─ materials/
│  │  ├─ parts/                  uma peça paramétrica por arquivo (auto-registro)
│  │  ├─ instruments/            multímetro, alicate, osciloscópio, fonte de bancada 3D
│  │  └─ fx/                     brilho, calor, fumaça, faíscas, linhas de campo, fluxo de corrente
│  ├─ scenes/                    cenas 3D de casos reais, uma por pasta (Cenas reais)
│  ├─ bench/                     bancada interativa e exercícios de ligação (Bancada)
│  ├─ course/                    quiz, progresso, glossário, busca, trilhas, modo oficina, PWA (Experiência)
│  ├─ components/                componentes de conteúdo simples: Callout, Figure, Steps… (Fundação)
│  ├─ lessons/mNN/               circuitos, cenários, firmwares e figuras das aulas do módulo (frente do módulo)
│  ├─ layouts/, styles/          (Fundação)
│  └─ pages/                     rotas (Fundação; Experiência cuida de index, progresso, glossário, busca, trilhas)
│     └─ dev/                    galerias internas: /dev/pecas (Kit 3D), /dev/circuitos (Esquemático), /dev/cenas (Cenas)
├─ tests/e2e/<frente>-*.spec.ts  cada frente cria os próprios arquivos de teste
└─ tools/
   ├─ ngspice/                   circuitos de referência e gerador de "golden files" (Simulação)
   └─ blender/                   scripts opcionais de modelagem (Cenas reais)
```

**Regra de extensão:** depois que a frente dona terminar, qualquer thread pode **adicionar arquivos novos** nas pastas com auto-registro (`engine/devices/`, `circuit/symbols/`, `three/parts/`, `scenes/`, `lessons/`), porque isso não gera conflito. **Editar arquivos existentes** de outra frente exige combinar com o coordenador antes.

**Auto-registro:** os registros usam `import.meta.glob` em vez de uma lista central editada à mão. Exemplo: `src/engine/devices/index.ts` faz `import.meta.glob('./*.ts', { eager: true })`. Adicionar um dispositivo é criar um arquivo.

## 4. Conteúdo

### 4.1 Coleções (Astro Content Collections)

`src/content/modulos/m08-motores.yaml`:

```yaml
id: m08-motores
numero: 8
parte: 2
titulo: Motores elétricos
resumo: Como a eletricidade vira movimento, do motor de brinquedo ao motor do portão.
icone: motor            # nome de ícone do conjunto do site
```

Frontmatter de `src/content/aulas/m08-motores/04-motor-monofasico-capacitor.mdx`:

```yaml
titulo: Motor monofásico com capacitor
modulo: m08-motores
ordem: 4
nivel: I                # B | I | A
duracaoMin: 25
objetivos:
  - Explicar por que o motor monofásico precisa de capacitor para partir
  - Inverter o sentido de rotação trocando a ligação do capacitor
  - Identificar comum e enrolamentos com o multímetro
prerequisitos: [m06-corrente-alternada/03-fase-e-fasores, m04-passivos/03-capacitores]
tags: [motor, capacitor, portão]
seguranca: rede         # nenhum | baixa-tensao | rede  (rede = exige caixa de segurança)
rascunho: false
```

O schema (zod) fica em `src/content.config.ts` e o build falha se uma aula estiver fora do padrão.

### 4.2 Rotas

| Rota | Página |
|------|--------|
| `/` | Início (Experiência) |
| `/modulos/` | Catálogo de módulos |
| `/<modulo>/` | Página do módulo, com aulas e progresso |
| `/<modulo>/<aula>/` | Aula |
| `/trilhas/<trilha>/` | Trilha |
| `/glossario/`, `/busca/`, `/progresso/` | Experiência |
| `/dev/*` | Galerias internas (não aparecem na navegação) |

O site é publicado em `https://matheusz-nied.github.io/eletrics-course/`, então todos os links usam o `base` do Astro (`import.meta.env.BASE_URL`). Nunca escrever links absolutos começando com `/` à mão.

### 4.3 Componentes disponíveis nas aulas (MDX)

A página da aula injeta estes componentes; o autor não precisa importar nada. Os nomes ficam fixos desde a Fundação. Até a frente dona entregar a versão real, cada um renderiza um aviso de "em construção" com as mesmas props.

| Componente | Props principais | Dono |
|------------|------------------|------|
| `<Callout type="perigo\|atencao\|dica\|nota\|seguranca-rede">` | `title?` | Fundação |
| `<Figure>` | `src` ou filho SVG, `caption`, `alt` | Fundação |
| `<Steps>` / `<Step title>` | | Fundação |
| `<DeepDive title>` | seção recolhível para a parte avançada | Fundação |
| `<RealCase title>` | destaque de caso real | Fundação |
| `<Term id>` | termo com definição em popover (lê `glossario/`) | Experiência |
| `<Quiz questions={[...]}>` | tipos: `multipla`, `numerica` (com tolerância e unidade), `vf`, `ordenar`, `associar` | Experiência |
| `<Workshop id>` | checklist do modo oficina (passos grandes, funciona offline, marca o que já foi feito) | Experiência |
| `<Simulation circuit="m02/serie-lampadas">` | `height?`, `layout?: "esquema" \| "esquema+3d" \| "3d"`, `autoplay?` | Esquemático |
| `<Plot>` | gráfico de uma simulação rodada até um instante (`circuit`, `until`, `series`) ou de pontos fixos (`data`) | Esquemático |
| `<Model3D part="resistor" props={{ ohms: 4700 }}>` | `explode?`, `cutaway?`, `annotations?`, `height?` | Kit 3D |
| `<Scene3D scene="portao-deslizante">` | `props?`, `camera?`, `hotspots?` | Cenas reais |
| `<WiringExercise scenario="m16/troca-central">` | | Bancada |

Componentes específicos de uma aula (uma calculadora, um jogo) ficam em `src/lessons/mNN/` e são importados no próprio `.mdx`.

**Por que `circuit="id"` e não um objeto:** props de ilhas do Astro precisam ser serializáveis. A ilha resolve o id com `import.meta.glob('/src/lessons/**/*.circuit.ts')` e carrega só aquele circuito. Isso também permite que circuitos importem funções (firmware de um microcontrolador simulado, por exemplo).

## 5. Motor de simulação (`src/engine/`)

### 5.1 Requisitos

- **Análise Nodal Modificada (MNA)** com fontes de tensão como incógnitas extras, LU densa com pivotamento parcial (circuitos do curso têm menos de ~200 nós).
- **Não linear:** Newton-Raphson com limitação de passo de junção (`pnjlim`), `gmin`, e fallback de passo menor quando não converge.
- **Transiente:** integração trapezoidal com Euler implícito nos primeiros passos e após descontinuidades (chave abrindo, relé comutando). Passo fixo definido pelo circuito, com subpassos.
- **Análises:** ponto de operação CC; transiente; varredura CA de pequenos sinais (para Bode); e **modo quase-estático fasorial**: a cada passo mecânico (ex.: 10 ms), resolve o circuito CA em regime permanente a 60 Hz e integra só a mecânica. Isso é o que permite simular o portão abrindo por 15 s em tempo real sem resolver 60 Hz ponto a ponto.
- **Tempo real:** roda num Web Worker compartilhado pela página; entrega um `SimFrame` por quadro; velocidade ajustável (câmera lenta para ver a senoide, acelerado para carga de capacitor longa).
- **Danos realistas:** cada dispositivo tem limites (corrente, potência, tensão reversa, I²t). Ultrapassou, emite evento `damaged` e muda de comportamento (LED queimado abre, fusível rompe, eletrolítico invertido estufa e entra em curto, resistor sobrecarregado escurece e abre). A interface mostra o efeito, e "Reiniciar" restaura.
- **Comportamentais:** portas lógicas, 555, microcontrolador com firmware em TypeScript, receptor RF por eventos, mecânica de portão, sensores dirigidos por posição (reed, fotocélula).
- **Números em pt-BR:** o motor trabalha em SI; formatação (`4,7 kΩ`) é da interface, com `Intl.NumberFormat('pt-BR')` e prefixos de engenharia.

### 5.2 Contrato público (`src/engine/contract.ts`)

A Fundação cria este arquivo exatamente assim; depois a Simulação é dona dele e só acrescenta campos opcionais (mudanças que quebram compatibilidade passam pelo coordenador).

```ts
/** Coordenadas na grade do esquemático (inteiros). 1 unidade = 10 px no zoom 1. */
export type Vec2 = [number, number];
export type ParamValue = number | boolean | string;

export interface ControlDoc {
  param: string;                       // parâmetro do elemento controlado
  label: string;                       // pt-BR
  kind: 'toggle' | 'momentary' | 'slider' | 'select';
  min?: number; max?: number; step?: number; unit?: string; log?: boolean;
  options?: { value: ParamValue; label: string }[];
}

export interface ElementDoc {
  id: string;                          // único no circuito: "R1", "K1", "M1"
  type: string;                        // tipo do catálogo: "resistor", "relay-spdt"…
  a?: Vec2; b?: Vec2;                  // dispositivos de 2 terminais (comprimento livre, alinhado aos eixos)
  at?: Vec2; rot?: 0 | 90 | 180 | 270; flip?: boolean;  // dispositivos com N terminais
  points?: Vec2[];                     // só para type "wire" (polilinha)
  params?: Record<string, ParamValue>;
  label?: string;                      // rótulo visível (pt-BR)
  control?: ControlDoc | ControlDoc[]; // torna parâmetros interativos
}

export type ProbeDoc =
  | { id: string; kind: 'voltage'; plus: string; minus: string; label?: string } // "R1.a", "GND"
  | { id: string; kind: 'current' | 'power'; element: string; label?: string };

export type AnalysisDoc =
  | { kind: 'dc' }
  | { kind: 'transient'; dt: number; speed?: number; tStop?: number }
  | { kind: 'ac-sweep'; source: string; fStart: number; fStop: number; points: number }
  | { kind: 'quasi-static'; frequency: number; dtMech: number; speed?: number };

export interface GoalDoc {             // metas de desafios ("acenda o LED com 10 mA")
  id: string; description: string;     // pt-BR
  check: { readout: string; op: '<' | '<=' | '>' | '>=' | '==' | 'between'; value: ParamValue | [number, number] };
}

export interface CircuitDoc {
  id: string;                          // "m02/serie-lampadas" (igual ao caminho em src/lessons)
  title: string;                       // pt-BR
  description: string;                 // descrição acessível em pt-BR
  elements: ElementDoc[];
  probes?: ProbeDoc[];
  analysis: AnalysisDoc;
  view?: { width: number; height: number; showCurrent?: boolean; showVoltage?: boolean };
  scene3d?: { scene: string; bindings: Record<string, string> }; // prop da cena ← leitura ("lamp.brightness" ← "L1.brightness")
  goals?: GoalDoc[];
}

export interface SimEvent {
  t: number; element: string;
  kind: 'damaged' | 'tripped' | 'warning' | 'info';
  message: string;                     // pt-BR, pronto para mostrar
}

export interface SimFrame {
  t: number;                           // tempo simulado (s)
  nodeVoltages: Record<string, number>;
  readouts: Record<string, number | boolean | string>; // "R1.current", "L1.brightness", "K1.closed", "M1.rpm", "F1.blown"
  events: SimEvent[];                  // eventos novos desde o último quadro
}

export interface PinInfo { name: string; offset: Vec2 }  // relativo a `at`, rotação 0
export interface ParamInfo { default: ParamValue; label: string; unit?: string; min?: number; max?: number }
export interface DeviceInfo {
  type: string; label: string;         // label em pt-BR
  terminals: 'two' | 'fixed';
  pins: PinInfo[];                     // para 'two': [{name:'a'},{name:'b'}] (offset ignorado)
  params: Record<string, ParamInfo>;
  readouts: string[];
}

export interface Netlist {
  nodes: { id: string; points: Vec2[] }[];   // pontos da grade que pertencem a cada nó (para colorir fios)
  pins: Record<string, string>;               // "R1.a" → id do nó
}

export interface SimHandle {
  load(doc: CircuitDoc): Promise<void>;
  setParam(element: string, param: string, value: ParamValue): void;
  play(): void; pause(): void; reset(): void;
  setSpeed(factor: number): void;
  subscribe(listener: (frame: SimFrame) => void): () => void;
  runUntil(t: number): Promise<SimFrame[]>;  // gráficos estáticos e testes
  dispose(): void;
}

// Exportados por src/engine/index.ts:
// createSimulation(opts?: { worker?: boolean }): SimHandle
// buildNetlist(doc: CircuitDoc): Netlist
// getDeviceInfo(type: string): DeviceInfo
// listDevices(): DeviceInfo[]
// defineCircuit(doc: CircuitDoc): CircuitDoc   (identidade tipada + validação zod em dev)
```

Conectividade: dois pinos estão no mesmo nó quando ocupam o mesmo ponto da grade, direta ou indiretamente por fios (`wire`). Fios só se conectam por pontas e vértices (não por cruzamento). Isso é o modelo do CircuitJS: simples para escrever à mão e fácil de editar arrastando.

### 5.3 Catálogo de dispositivos

Os nomes de tipo e pinos abaixo são o contrato inicial entre Simulação e Esquemático. Dispositivos `two` têm pinos `a` e `b`.

**Nível 1 (entrega 1 da Simulação, linear):**
`wire`, `ground`, `resistor`, `battery` (tensão + resistência interna), `dc-voltage`, `dc-current`, `ac-voltage` (amplitude, frequência, fase), `switch` (SPST), `push-button` (NA/NF), `switch-spdt` (fixed: `com`, `nc`, `no`), `potentiometer` (fixed: `a`, `w`, `b`), `capacitor` (polarizado opcional, tensão nominal), `inductor`, `lamp` (resistência do filamento varia com a temperatura; leitura `brightness`), `fuse` (I²t; leitura `blown`).

**Nível 2 (entrega 2, não linear e eletromecânico):**
`diode`, `led` (cor → Vf, corrente máxima; leitura `brightness`), `zener`, `npn`/`pnp` (fixed: `b`, `c`, `e`; Ebers-Moll), `nmos`/`pmos` (fixed: `g`, `d`, `s`; nível 1), `relay-spdt` (fixed: `coil1`, `coil2`, `com`, `nc`, `no`; tempos de atracar/soltar, leitura `closed`, pico indutivo na bobina), `transformer` (fixed: `p1`, `p2`, `s1`, `s2`), `dc-motor` (R, L, Ke, Kt, inércia, carga; leitura `rpm`, `torque`), `buzzer`, `ldr`, `ntc`, `opamp`, `timer-555`, portas lógicas (`and`, `or`, `not`, `nand`, `nor`, `xor`), `scr`, `triac`, `optocoupler`, `breaker` (curvas B/C), `rcd` (DR), `human-body` (para a aula de choque).

**Nível 3 (entrega 3, sistemas reais; necessário para o portão):**
`ac-motor-1ph-cap` (fixed: `common`, `w1`, `w2`; dois enrolamentos em quadratura, o sentido depende de qual enrolamento está em série com o capacitor; sem capacitor não parte e só zumbe; capacitor fraco dá partida fraca; protetor térmico; leituras `rpm`, `direction`, `torque`, `temperature`, `humming`), `mains` (fixed: `l`, `n`, `pe`; 127 ou 220 V, 60 Hz), `ac-motor-3ph`, `reed-switch` (fecha quando o ímã ligado à posição mecânica está perto), `photocell` (feixe interrompido → contato NA/NF), `mcu` (fixed: pinos configuráveis; roda um firmware TypeScript referenciado por id: `params.firmware = "m16/central-generica"`, resolvido dentro do worker por `import.meta.glob('/src/lessons/**/firmware/*.ts')`), `rf-receiver` (recebe eventos de controle remoto), `gate-mechanics` (posição, velocidade, relação de redução, ímãs de fim de curso, obstáculo, embreagem), `electric-lock`, `jumper` (2 terminais, `fitted: boolean`), `dip-switch`, `trimpot` (igual ao potenciômetro, com rótulo).

### 5.4 Validação

- `tools/ngspice/*.cir`: circuitos de referência; um script roda o ngspice nativo (`apt install ngspice`) e grava CSVs em `src/engine/__golden__/`. Os CSVs ficam versionados, então o CI não precisa do ngspice.
- Testes Vitest comparam o motor com os golden files: CC dentro de 0,1 %, transiente dentro de 1 %.
- Testes de comportamento: LED sem resistor queima, fusível rompe no tempo certo, motor com capacitor inverte quando o capacitor muda de lado, motor sem capacitor não parte.
- Desempenho: circuito de 50 nós a 60 quadros/s com pelo menos 1000 passos/s num celular intermediário (medido no Chromium com CPU throttling 4×).

## 6. Esquemático 2D e instrumentos (`src/circuit/`)

- Renderização em **SVG** a partir do `CircuitDoc`, com símbolos IEC/ABNT (os usados no Brasil), um arquivo por tipo em `symbols/`.
- **Corrente visível:** pontos andando nos fios com velocidade proporcional à corrente (alternável entre sentido convencional e elétrons). **Tensão visível:** cor dos fios por potencial (escala azul ↔ vermelho, com legenda; segura para daltonismo com padrão de rótulos).
- **Controles:** clicar numa chave, segurar um botão, girar um potenciômetro (arrastar ou teclado), sliders de parâmetros. Tudo acessível por teclado.
- **Instrumentos:** multímetro digital (visor), osciloscópio de 2 canais (uPlot, base de tempo, trigger), gráfico de grandezas no tempo, gráfico de Bode.
- **Áudio** sintetizado com Web Audio (sem arquivos): estalo de relé, zumbido de motor travado (120 Hz), ronco do motor proporcional à rotação, estalo de fusível. Respeita "sem som" por padrão até o aluno ativar.
- **Ligação com 3D:** `<SimBinding>` assina o `SimFrame` e repassa as leituras como props para a cena 3D indicada em `scene3d`.
- **Interação mínima de edição:** trocar valores de componentes e arrastar pontas de fios. O editor completo (bancada livre) é da frente Bancada.
- Galeria interna `/dev/circuitos` com todos os circuitos de `src/lessons/**`, para revisão.

## 7. Pipeline 3D (`src/three/`, `src/scenes/`)

### 7.1 Abordagem

**Modelos paramétricos em código** (React Three Fiber) são a regra: um resistor recebe `ohms` e desenha as faixas certas; um capacitor recebe `uF` e `voltage` e imprime o rótulo na capa; uma placa recebe um layout e gera trilhas, furos e serigrafia. Isso garante precisão técnica, permite animar estados vindos da simulação e não depende de arquivos externos nem de licenças.

GLB só quando a forma é orgânica ou complexa demais para código (ex.: carcaça injetada do motor do portão). Nesse caso, o modelo é gerado por **script Blender em Python** versionado em `tools/blender/` (reprodutível), exportado e comprimido com `gltf-transform` (meshopt + texturas KTX2/WebP) para `public/models/`. Nada de modelos com marca ou logotipo de fabricante. Ferramentas pagas de geração de 3D/imagem por IA só com autorização do Matheus.

### 7.2 Realismo

- Materiais PBR (`MeshPhysicalMaterial`) com biblioteca própria: cobre, estanho, aço niquelado, latão, FR-4 com máscara de solda verde, plástico ABS/PBT, borracha, vidro, cerâmica, epóxi de componente.
- Iluminação por HDRI de estúdio CC0 (Poly Haven) hospedado em `public/hdri/` (1k, poucos MB), mapeamento de tons ACES/AgX, sombras suaves de contato, oclusão de ambiente (N8AO) e bloom só para emissivos.
- Texturas de rótulo geradas em `<canvas>` (capa de capacitor, serigrafia, marcação de CI, visor do multímetro).
- Escala real: peças em milímetros (1 unidade = 1 mm); cenas grandes em metros com as peças escaladas.
- Efeitos dirigidos pela simulação: LED com brilho e bloom proporcional à corrente; filamento e resistor com cor de corpo negro pela temperatura; fumaça e escurecimento ao queimar; faísca em curto e ao abrir carga indutiva; armadura do relé se movendo; motor girando na rotação calculada; fusível com filamento rompido; linhas de campo magnético calculadas; partículas de corrente ao longo dos fios.
- Modos de visualização: girar/zoom, **vista explodida** animada, **corte** com planos de recorte, **anotações** presas às partes (`drei/Html`), pontos clicáveis.

### 7.3 API das peças

```tsx
// src/three/parts/resistor.tsx
export const meta: PartMeta = {
  id: 'resistor', label: 'Resistor', category: 'passivos',
  defaults: { ohms: 1000, tolerance: 5, watts: 0.25 },
  annotations: [{ at: [0, 1.4, 0], text: 'Faixas de cor: valor e tolerância' }],
};
export default function Resistor(props: { ohms: number; tolerance?: number; watts?: number; temperature?: number; burned?: boolean }) { … }
```

`<Model3D part="resistor" props={{ ohms: 4700 }} />` resolve a peça pelo registro (`import.meta.glob('./parts/*.tsx')`), carregando só o arquivo necessário.

### 7.4 Desempenho e compatibilidade

- O `Canvas` só é criado quando a ilha entra na tela (`IntersectionObserver`) e é destruído quando sai, para não estourar o limite de contextos WebGL do navegador com várias ilhas na mesma página. `frameloop="demand"` quando nada está animando.
- Níveis de qualidade automáticos (`PerformanceMonitor`): no celular, DPR menor, sem oclusão de ambiente e sombras simplificadas.
- Sem WebGL: imagem estática (pôster gerado no build com Playwright) e a simulação 2D continua funcionando.
- Orçamento: three.js e cena carregados sob demanda; uma peça simples abaixo de 300 KB gzip além do núcleo do three; cena do portão abaixo de 3 MB no total.

## 8. Bancada interativa (`src/bench/`)

A bancada transforma **ligações físicas em circuito**. É o que permite o exercício "ligue a central nova" com consequências reais.

- **Cenário** (`src/lessons/mNN/scenarios/*.ts`, escrito pela frente de conteúdo) declara: a cena 3D usada; os **terminais** (id, posição na cena, a qual pino de qual elemento do motor de simulação corresponde); as ligações já feitas; os fios disponíveis (cores, bitolas); os itens configuráveis (jumpers, DIP, trimpots, botões); o circuito "por trás" dos terminais; as **verificações** com mensagens em pt-BR; e os passos de segurança obrigatórios (ex.: desligar o disjuntor antes de soltar um fio, senão "choque" e o exercício reinicia).
- **Interação:** arrastar a ponta de um fio até um borne (encaixe magnético), apertar parafuso, tirar/colocar jumper, mudar DIP, girar trimpot, encostar as pontas do multímetro 3D em qualquer terminal e ler o valor calculado pelo motor (com erros realistas: escala errada, borne errado, medir resistência com circuito ligado).
- **Energizar:** o botão "Ligar disjuntor" carrega o circuito montado no motor de simulação; a cena mostra o resultado (portão abre, abre ao contrário, motor zumbe, fusível queima, nada acontece).
- **Modo livre** (fase posterior): protoboard 3D com peças do kit, para os desafios das aulas de eletrônica.

## 9. Experiência do curso (`src/course/`)

- Progresso por aula (lida, quiz feito, nota), por módulo e por trilha, no `localStorage` (`curso:v1:*`), com exportar/importar JSON.
- Quiz com feedback explicando cada alternativa errada; tipo `ordenar` para procedimentos (ex.: ordem segura de trocar a central).
- Glossário com popover; busca com Pagefind em pt-BR; navegação anterior/próxima; sumário lateral; tema claro/escuro.
- **Modo oficina:** checklist em tela cheia, letras grandes, botão "feito", foto de referência/cena 3D por passo, funciona offline (PWA) e lembra onde parou.

## 10. Qualidade

- **CI (GitHub Actions)** em todo PR: `pnpm lint`, `pnpm typecheck` (`astro check` + `tsc`), `pnpm test` (Vitest), `pnpm build`, `pnpm test:e2e` (Playwright: cada página do curso abre sem erro no console; ilhas montam; um teste por componente de conteúdo).
- **Acessibilidade:** WCAG AA; `axe` nos testes e2e; toda simulação tem descrição textual e é operável por teclado; `prefers-reduced-motion` desliga animações não essenciais.
- **Desempenho:** Lighthouse no CI (Desempenho ≥ 85 em celular nas páginas de aula sem 3D; LCP < 2,5 s); JavaScript inicial da página de aula < 150 KB gzip sem contar ilhas.
- **Precisão técnica:** valores numéricos das aulas conferidos pelo motor (testes que rodam os circuitos das aulas e checam os valores citados no texto quando o autor marcar `goals`).

## 11. Deploy

GitHub Actions publica `dist/` no GitHub Pages a cada merge na `main` (`actions/upload-pages-artifact` + `actions/deploy-pages`). O Matheus precisa ativar uma única vez: **Settings → Pages → Source: GitHub Actions**. A Fundação pede isso no momento certo.

## 12. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Estabilidade numérica do motor (não convergência, oscilações) | Técnicas padrão do SPICE (limitação de junção, gmin stepping, Euler nos degraus), testes golden, circuitos das aulas rodados no CI |
| 3D pesado em celular | Ilhas sob demanda, níveis de qualidade, pôster sem WebGL, orçamento de tamanho |
| Erro técnico em conteúdo de segurança (rede elétrica) | Guia de conteúdo com regras de segurança, revisão técnica dedicada (frente Revisão), linguagem que manda chamar profissional quando aplicável |
| Escopo grande (~113 aulas) | Ondas com entregas incrementais; cada módulo publicado assim que pronto; template de aula |
| Conflitos entre threads paralelas | Donos de pasta, auto-registro, dependências instaladas pela Fundação, contrato estável |
| Limite de contextos WebGL | Canvas criado e destruído conforme visibilidade |
