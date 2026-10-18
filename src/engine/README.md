# Motor de simulação (`src/engine/`)

Motor de circuitos em TypeScript puro (Análise Nodal Modificada, como o SPICE), que roda num Web Worker em tempo real. Contrato público em [`contract.ts`](contract.ts); este documento explica as convenções que o contrato não diz. Plano: `docs/plano/02-arquitetura.md`, seção 5.

Página interna com o catálogo completo (pinos, parâmetros, leituras) e um teste de desempenho: **`/dev/motor/`**.

## API (`import … from '../engine'`)

| Função | Para quê |
|--------|----------|
| `createSimulation(opts?)` | `SimHandle` no worker compartilhado da página (padrão no navegador) ou na própria thread (`{ worker: false }`, Node e testes) |
| `defineCircuit(doc)` | Identidade tipada para arquivos de circuito; em desenvolvimento valida e lança os problemas em pt-BR |
| `validateCircuit(doc)` | `{ errors, warnings }` em pt-BR, sem lançar |
| `buildNetlist(doc)` | Nós (`GND`, `n1`, `n2`…) com os pontos da grade de cada um, e o nó de cada pino (`"R1.a"`) |
| `getDeviceInfo(type, params?)`, `listDevices()` | Catálogo: pinos (com posição e rótulo), parâmetros (rótulo, unidade, faixa, opções), leituras (`readoutInfo` com rótulo e unidade). Com `params`, os pinos e leituras daquela instância: o `mcu` tira os pinos do firmware e o `dip-switch` tem um par por chave |
| `listFirmware()`, `findFirmware(id)` | Firmwares gravados em `src/lessons/**/firmware/*.ts` (para o `mcu`) |
| `getPinPositions(el)` | Onde fica cada pino de um elemento na grade, já com `rot` e `flip` |
| `checkGoal(goal, frame)` | Se uma meta (`GoalDoc`) vale num quadro |

## Escrever um circuito

Arquivo `src/lessons/mNN/<slug>.circuit.ts`, com `export default`, id igual ao caminho:

```ts
import { defineCircuit } from '../../engine';

export default defineCircuit({
  id: 'm02/lampada-chave',
  title: 'Lâmpada com chave',
  description: 'Uma bateria de 12 V acende uma lâmpada quando a chave fecha.',
  analysis: { kind: 'dc' },
  elements: [
    { id: 'B1', type: 'battery', a: [0, 10], b: [0, 20], params: { voltage: 12 } },
    { id: 'W1', type: 'wire', points: [[0, 10], [0, 0], [10, 0]] },
    { id: 'S1', type: 'switch', a: [10, 0], b: [20, 0],
      control: { param: 'closed', label: 'Chave', kind: 'toggle' } },
    { id: 'L1', type: 'lamp', a: [20, 0], b: [20, 20], params: { voltage: 12, power: 5 } },
    { id: 'W2', type: 'wire', points: [[20, 20], [0, 20]] },
    { id: 'G', type: 'ground', at: [0, 20] },
  ],
  goals: [
    { id: 'acender', description: 'Acenda a lâmpada',
      check: { readout: 'L1.brightness', op: '>', value: 0.9 },
      solution: { 'S1.closed': true } },
  ],
});
```

- **Grade:** coordenadas inteiras, 1 unidade = 10 px no zoom 1, y cresce para baixo.
- **Ligações:** pinos no mesmo ponto estão ligados; fios (`wire`, polilinha em `points`) ligam só pelas pontas e vértices, nunca por cruzamento. Um pino no meio de um fio **não** está ligado (o validador avisa).
- **Dois terminais** (`a`, `b`): comprimento livre, alinhados na horizontal ou vertical. **N terminais**: `at` mais o deslocamento de cada pino (`getDeviceInfo(tipo).pins`), espelhado na horizontal se `flip` e depois girado `rot` graus no sentido horário da tela.
- **Terra:** o símbolo `ground` (pino `g`) é o nó `GND` (0 V). Sem terra, o negativo da primeira fonte vira a referência.
- **Medidores** (`probes`): `voltage` entre dois pinos (`"R1.a"`) ou `"GND"`; `current`/`power` de um elemento de dois terminais; `current` também num fio (segmento 0, como a leitura `current` do fio). A leitura sai em `readouts[probe.id]` e em `samples`.
- **Metas** (`goals`): o teste automático (`__tests__/lessons.test.ts`) roda cada circuito de aula até `at` (padrão: `tStop` ou 1 s) e confere cada meta: como está, ou depois de aplicar `solution` (`"Elemento.parâmetro": valor`). Valor citado no texto da aula vira meta sem `solution`.

## Convenções de sinal e leituras

Chave das leituras: `"<elemento>.<leitura>"`. Unidades SI; temperaturas em °C.

- **Fontes** (`battery`, `dc-voltage`, `ac-voltage`): pino `a` é o **+**. `current` é a corrente **fornecida** (sai pelo +) e `power` a potência fornecida: positivas quando a fonte alimenta o circuito. `dc-current` empurra a corrente para fora do pino `a`.
- **Passivos de dois terminais:** `current` de `a` para `b` por dentro do componente, `voltage` = V(a) − V(b), `power` absorvida.
- **Todo elemento:** `pin.<nome>` é a corrente que **entra** no componente por aquele pino (serve para animar a corrente dentro do símbolo).
- **Fios:** `current.<k>` é a corrente no segmento k, de `points[k]` para `points[k+1]`; `current` é o segmento 0. Num laço só de fios ideais a divisão não é única: um ramo leva a corrente e o segmento que fecha o laço mostra zero.
- **Diodos** (`diode`, `led`, `zener`): `a` é o anodo, `b` o catodo. `current` positiva conduzindo direto; o zener regula com `current` negativa (catodo no lado positivo).
- **Transistores:** as leituras usam a polaridade do próprio dispositivo, positivas em operação normal tanto no NPN quanto no PNP: `ic`, `ib`, `vbe`, `vce` (no PNP, `vbe` = V(e) − V(b) e `ic` sai pelo coletor). O mesmo para MOSFET: `id`, `vgs`, `vds` positivas no canal N e no canal P. Já `pin.<nome>` é sempre a corrente real que entra pelo pino.
- **Danificado:** qualquer elemento que emitiu um evento `damaged` ganha a leitura `damaged: true` até o `reset()` (sem ela, não está danificado). Leituras próprias continuam valendo: `burned`, `blown`, `bulged`, `welded`.
- `nodeVoltages` traz `GND` e `n1`, `n2`… (os ids de `buildNetlist`, para colorir fios).

## Análises

- **`dc`**: ponto de operação (capacitores abertos, indutores em curto pela resistência do enrolamento, fonte CA no nível contínuo). O tempo continua andando em passos de 1 ms para os modelos térmicos: a lâmpada esquenta, o fusível rompe no tempo certo.
- **`transient`**: passo fixo `dt`, regra trapezoidal, Euler implícito no primeiro passo e depois de cada descontinuidade (chave, fusível, parâmetro mudado). Começa com capacitores e indutores no valor `ic` (padrão 0), sem calcular o ponto de operação antes. `tStop` pausa a simulação.
- **`ac-sweep`**: resposta em frequência para o diagrama de Bode. Calcula o ponto de operação e, em `points` frequências em escala logarítmica de `fStart` a `fStop`, resolve o circuito linearizado com a fonte `source` valendo 1∠0° (as outras fontes de tensão viram curto e as de corrente, circuito aberto). O quadro traz `sweep = { f, magnitude, phase }`: para cada medidor de tensão, o ganho (V/V, linear) e a fase em graus, desdobrada (sem saltos de 360°). Medidores de corrente e potência não entram (o validador avisa). `play()` não faz nada e `runUntil` devolve esse único quadro.
- **`quasi-static`**: para máquinas de CA e mecânica (o portão). Cada passo dura `dtMech` (10 ms é o usual): resolve o ponto de operação em CC (lógica, fontes de 12 e 5 V) e, por cima dele, os fasores na frequência `frequency` (fontes `ac-voltage` e `mains` nessa frequência; uma fonte em outra frequência não entra, e o validador avisa). Depois cada dispositivo avança o próprio estado com o passo inteiro: rotação do motor, posição do portão, temperaturas, firmware. Detalhes em [Nível 3](#nível-3-quase-estático-e-portão).

### Circuitos não lineares

Diodos, transistores, amplificadores operacionais e afins são resolvidos por Newton-Raphson, como no SPICE:

- **Limitação de junção** (`pnjlim`, `fetlim`, `limvds` do SPICE): uma iteração não pode mudar a tensão de uma junção à vontade, senão a exponencial explode. Na primeira solução as junções começam na tensão crítica.
- **Convergência:** variação de cada tensão abaixo de 10⁻⁶ relativo + 1 µV (e das correntes de ramo abaixo de 10⁻⁶ relativo + 1 pA), sem nenhuma junção limitada. Uma incógnita mal condicionada (secundário de transformador flutuando, nó preso só por junções reversas) pode ficar oscilando no ruído de arredondamento: nesse caso vale também o resíduo, quando a solução satisfaz cada equação dentro de 10⁻¹⁰ do tamanho dos seus termos.
- **Ponto de operação (CC e primeiro passo):** Newton-Raphson; se não convergir, *gmin stepping* (condutância de 10 mS de cada nó para o terra e em cada junção, reduzida década a década até 1 pS); depois, *source stepping* (fontes subindo de zero).
- **Transiente:** um passo que não converge é refeito em pedaços (até 1/1024) com Euler implícito. Circuitos com realimentação positiva (multivibrador, Schmitt trigger, oscilador de relaxação) têm instantes em que a solução salta, e nenhum passo é curto o bastante para o Newton seguir o salto sozinho: a partir de 1/8 do passo, o pedaço que falha é resolvido com *gmin stepping* e o passo seguinte recomeça com Euler implícito (a regra trapezoidal oscilaria depois do salto).
- O amplificador operacional tem 1 mV de offset na entrada (parâmetro `offset`): como num real, é isso que faz um oscilador partir sozinho do repouso.

## Nível 3: quase-estático e portão

- **Fasores eficazes** com referência no seno: `v = A·sen(ωt + φ)` vira `(A/√2)∠φ`. Diodos e transistores entram linearizados no ponto de operação, como na varredura CA; o TRIAC e o motor têm modelo próprio de fasor.
- **Leituras em valor eficaz verdadeiro:** em `quasi-static`, `nodeVoltages`, medidores de tensão e corrente, `voltage`/`current`/`pin.<nome>` dos dois terminais e as correntes dos fios somam as duas partes, `√(cc² + |ca|²)`, com o sinal da parte contínua. `power` é a potência contínua mais `Re(V·I*)`. Fusível, disjuntor, DR, resistor, lâmpada, relé, corpo humano e trava esquentam ou disparam pelo valor eficaz.
- **Acoplamentos:** um parâmetro que nomeia outro elemento liga os dois sem fio. O `gate-mechanics` move o motor de `motor`; o `reed-switch` sente o portão de `gate` (fecha com o ímã a até `zone` de `magnet`). O validador confere se o elemento existe e é do tipo certo, e a ordem de atualização segue os acoplamentos (o motor resolve antes do portão, o portão antes do reed).
- **Motor** (`ac-motor-1ph-cap`): dois enrolamentos iguais em quadratura (`w1` ABRE, `w2` FECHA, `common`), teoria dos dois campos girantes. A fase direto em `w1` gira para + (`rpm` positivo), em `w2` para −. Sem capacitor, ou com os dois enrolamentos na fase, não há campo girante na partida: zumbe (`humming`) com corrente de rotor travado. Protetor térmico no comum: abre a 135 °C, fecha a 85 °C. Em CC (ohmímetro) cada enrolamento é a sua resistência. Sozinho, gira com a carga `load`; acoplado a um portão, quem integra a mecânica é o portão.
- **Portão** (`gate-mechanics`): massa do portão mais inércia do rotor refletida, atrito de rolamento (e um trecho mais duro, opcional), redução por coroa e sem-fim (que freia o portão quando o motor para), batentes nas pontas, obstáculo no fechamento, alguém segurando, desbloqueio manual. Posição 0 = fechado.
- **TRIAC:** conduz a fração do semiciclo que a saída `phase-out` do `mcu` no nó do gatilho manda (controle de fase), ou o ciclo todo com corrente de gatilho CC acima de `igt`. Para a fundamental, a carga recebe `K(c)` da tensão que o TRIAC bloquearia (`phaseControlFactor`).
- **Microcontrolador** (`mcu`): `params.firmware` é o id de um firmware de `src/lessons/**/firmware/` (`defineFirmware`, função pura de estado e entradas). Pinos: entradas à esquerda e saídas à direita, na ordem do firmware (ou de `pinsLeft`/`pinsRight`), 2 unidades entre si, `vcc` em cima e `gnd` embaixo, mais o pino `RF` para um `rf-receiver`. Entradas com pull-up de 10 kΩ quando o firmware pede (lê alto acima de metade da alimentação); saídas push-pull de 50 Ω. Leituras: `powered`, `level.<pino>` e as do firmware (`U1.estado`). Abaixo de 60 % da alimentação desliga, guarda a memória (`persist`) e recomeça com ela acima de 70 %.
- **Sinais de nó:** o `rf-receiver` entrega os quadros do controle (série, botão, contador do rolling code) ao `mcu` ligado ao seu pino `out`; a saída `phase-out` passa a fração de condução ao gatilho do TRIAC no mesmo nó. Os dois precisam estar ligados direto, por fio.
- **Capacitor de motor:** `acRated: true` diz que a tensão nominal é eficaz em CA (aguenta √2 vezes no pico). `fault` reproduz os defeitos: aberto, fraco (30 % da capacitância) e em curto.
- O circuito de referência do portão (`docs/plano/05-portao.md`, seção 5) está em [`__tests__/gate-circuit.ts`](__tests__/gate-circuit.ts).

## `SimHandle` em tempo real

- `load(doc)` valida (rejeita com a lista de problemas em pt-BR), deixa pausado e emite o primeiro quadro.
- `play()` roda em tempo real × velocidade (`analysis.speed`, depois `setSpeed`). Um quadro por tick (~60/s) com as amostras de cada passo dos medidores. Se o circuito for pesado demais para a velocidade pedida, a simulação desacelera em vez de acumular atraso. Depois de `tStop`, `play()` recomeça do zero.
- `setParam()` com a simulação pausada recalcula e emite um quadro na hora (a chave fecha e a corrente aparece, com os capacitores mantendo a carga).
- `reset()` volta a t = 0, conserta o que queimou e descarrega capacitores. **Mantém os parâmetros** mudados pelo aluno.
- `runUntil(t, { maxFrames })` roda direto até o instante `t` e devolve até `maxFrames` quadros igualmente espaçados (padrão 2.000), para gráficos estáticos e testes.
- `subscribe()` entrega o último quadro na hora a quem chega depois.
- Erro numérico (circuito sem solução) pausa e emite um `SimEvent` `warning` com `element: ''`.

## Danos

| Dispositivo | Quando | Efeito |
|-------------|--------|--------|
| `fuse` | Aquecimento do elo (i² filtrado pelo I²t) chega a (1,6·In)²: nunca a 1,5×, segundos a 2×, milissegundos a 10×; tipos rápido (F) e retardado (T) dentro das janelas da IEC 60127-2 | Abre; `blown` |
| `lamp` | Filamento acima de 3.300 K (cerca de 1,7× a tensão nominal) | Abre; `burned`, brilho 0 |
| `resistor` | Aviso acima da potência nominal; queima com cerca de 5× a nominal sustentada (segundos a 10×, menos de 0,5 s a 100×) | Abre; `burned`, `temperature` |
| `potentiometer` | Cada trecho da pista aguenta a fração da potência do seu comprimento (cursor perto do fim em curto queima) | Abre; `burned` |
| `diode`, `zener` | Junção (dois polos térmicos, Rth calculada pela potência nominal) passa de 155 °C: aviso; de 300 °C: queima | Curto (0,5 Ω); `burned`, `temperature` |
| `led` | Corrente acima de `imax`: aviso; i² filtrado (τ = 0,1 s) chega a (2,5·imax)² | Abre; `burned`, brilho 0 |
| `npn`, `pnp` | Aquecimento da junção como no diodo; acima de `vceo` entra em avalanche (aviso: carga indutiva sem diodo) e esquenta | Curto coletor-emissor; `burned` |
| `nmos`, `pmos` | Aquecimento como no diodo; `vgs` acima de `vgsMax` perfura o óxido na hora | Curto dreno-fonte; `burned` |
| `capacitor` | Eletrolítico com mais de 1,5 V reverso, ou qualquer um acima de 1,2× a nominal (com CA, conta o pico; com `acRated`, a nominal é eficaz): aviso e estresse acumulado (mais rápido quanto maior o excesso) | Curto; `bulged` (estufado) |
| `relay-spdt` | Corrente no contato filtrada chega a 3× `contactRating`; bobina acima da tensão nominal por muito tempo esquenta | Contato cola fechado (`welded`); bobina abre (`burned`) |
| `transformer` | Perdas no cobre acima das nominais por muito tempo (τ = 120 s); ligado em CC queima rápido | Enrolamento abre; `burned` |
| `dc-motor` | Corrente acima da nominal por muito tempo (motor travado, τ = 60 s) | Enrolamento abre; `burned` |
| `ac-motor-1ph-cap` | Enrolamento passa de 135 °C (travado ou zumbindo, cerca de 30 s) | Protetor abre (aviso) e fecha sozinho a 85 °C; `protector` |
| `optocoupler` | LED interno como o `led` | LED abre; `burned` |
| `human-body` | Zonas da IEC 60479-1 pela corrente eficaz e pela duração: AC-3 avisa, AC-4 (risco de fibrilação) emite `damaged` | Só a leitura; `zone`, `worst` |

Cada dano emite um `SimEvent` `damaged` com mensagem pronta, por exemplo `O fusível F1 rompeu: corrente de 10 A, nominal 1 A.`. Os modelos térmicos são típicos de ensino, não de um fabricante.

**Proteções:** `breaker` (disjuntor, curvas B, C e D: disparo térmico e magnético) e `rcd` (DR: corrente de fuga acima de 0,75·IΔn em 20 ms) emitem `tripped` em vez de `damaged` e **abaixam a própria alavanca**: o parâmetro `closed` vira `false`. Pôr `closed: true` de novo rearma. `reset()` só levanta a alavanca se ela caiu por disparo; o botão de teste do DR é o parâmetro `test`.

## Adicionar um dispositivo

Crie `devices/<tipo>.ts` com `export default defineDevice({ info, create })` (veja [`device.ts`](device.ts) e os dispositivos existentes). O registro acha o arquivo sozinho. Regras:

- `stamp()` só escreve no sistema MNA e **não** muda estado (pode ser chamado várias vezes por passo).
- `update()` roda depois de cada solução; só avance estados e cheque limites quando `ctx.commit` for verdadeiro.
- Dano: `ctx.emit('damaged', mensagem em pt-BR)` e `ctx.discontinuity()`.
- Parâmetros e leituras com rótulo em pt-BR (`readoutInfo`); pinos de fontes e polarizados com `label`.
- `stampAc()` (o modelo linearizado no ponto de operação `op`) é obrigatório para entrar numa varredura CA e no `quasi-static` (`ctx.phasor` verdadeiro: fontes entram com o fasor delas). No `quasi-static`, `update()` recebe os fasores em `step.ac` e `acSquared(step, k)` dá o quadrado da corrente eficaz CA no pino k (para aquecimento). O teste `catalog.test.ts` roda cada dispositivo em todas as análises que ele aceita.
- `analyses` limita as análises (o motor de CA não roda em `transient`); `links` declara os acoplamentos por parâmetro (com `couple(find)` e `exposes` no modelo); `instance(params)` dá pinos e leituras que dependem dos parâmetros; `checkParams(params)` acrescenta erros de validação.
- **Não linear:** `nonlinear: true`, e linearize em torno da tensão de `x` com `m.linearized(…)`. Junções usam `DiodeCore` e as funções de `models/junction.ts` (limitação com memória por iteração: `beginSolve()` volta ao valor aceito, `update()` com `ctx.commit` grava). Se a linearização usou uma tensão diferente da de `x`, marque `step.nl.limited = true`. Respeite `step.nl.gmin` (condutância extra na junção) e, nas fontes, `step.nl.sourceScale`.
- Um teste em `__tests__/` para cada dispositivo. Nada de DOM fora de `runtime/`.
- O Vitest guarda em `node_modules/.vitest-cache` o resultado dos `import.meta.glob`: depois de criar um arquivo novo (dispositivo, circuito de aula), se o teste não o enxergar, apague essa pasta.

## Validação

- **ngspice:** circuitos de referência em `tools/ngspice/*.cir`; `node tools/ngspice/generate.ts` (com `ngspice` instalado) grava `__golden__/*.csv`, versionados. `__tests__/golden.test.ts` exige CC dentro de 0,1 %, transiente dentro de 1 % do pico e, na varredura CA, ganho dentro de 0,1 % e fase dentro de 0,1°.

  | Referência | O que cobre |
  |------------|-------------|
  | `dc-baterias`, `dc-ponte`, `rc-carga`, `rc-senoide`, `rl-degrau`, `rlc-serie`, `lc-tanque` | Lineares (S1) |
  | `dc-diodos` | Diodo de sinal, retificador e zener na ruptura, em CC |
  | `meia-onda` | Retificador de meia onda com filtro, transiente |
  | `dc-transistores` | NPN, PNP, NMOS e PMOS polarizados, em CC |
  | `ac-filtro-amplificador` | Filtro RC e amplificador emissor comum, varredura CA |
  | `chave-bobina` | NPN chaveando uma bobina com diodo de roda livre, transiente |

- **Circuitos do curso** (`__tests__/circuits.test.ts`): pisca-pisca com dois transistores, fonte com transformador, ponte e filtro (comparada com o ngspice), relé com transistor e diodo, oscilador com amplificador operacional, ponte H de MOSFETs com motor, regulador com zener e 555 piscando um LED.
- **Portão** (`__tests__/gate.test.ts`): o circuito de referência abre, para no fim de curso, fecha, volta a abrir com a fotocélula e com obstáculo (pela corrente do motor), gira ao contrário com ABRE e FECHA trocados (e o DIP INV corrige), cadastra um controle e recusa um código repetido.
- **Desempenho:** 50 nós com passo de 10 µs passam de 35 mil passos/s no Node; com diodos e LEDs (Newton-Raphson a cada passo), de 12 mil. O portão em `quasi-static` (passo de 10 ms, tempo real = 100 passos/s) passa de 2 mil passos/s. A fatoração LU escolhe os pivôs uma vez e depois só refaz as contas nos elementos não nulos. No Chromium com a CPU 4× mais lenta, o teste e2e de `/dev/motor/` exige mais de 1.000 passos/s nos dois casos, a mais de 50 quadros/s.
