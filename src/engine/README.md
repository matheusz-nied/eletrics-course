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
| `getDeviceInfo(type)`, `listDevices()` | Catálogo: pinos (com posição e rótulo), parâmetros (rótulo, unidade, faixa, opções), leituras (`readoutInfo` com rótulo e unidade) |
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
- **Medidores** (`probes`): `voltage` entre dois pinos (`"R1.a"`) ou `"GND"`; `current`/`power` de um elemento de dois terminais. A leitura sai em `readouts[probe.id]` e em `samples`.
- **Metas** (`goals`): o teste automático (`__tests__/lessons.test.ts`) roda cada circuito de aula até `at` (padrão: `tStop` ou 1 s) e confere cada meta: como está, ou depois de aplicar `solution` (`"Elemento.parâmetro": valor`). Valor citado no texto da aula vira meta sem `solution`.

## Convenções de sinal e leituras

Chave das leituras: `"<elemento>.<leitura>"`. Unidades SI; temperaturas em °C.

- **Fontes** (`battery`, `dc-voltage`, `ac-voltage`): pino `a` é o **+**. `current` é a corrente **fornecida** (sai pelo +) e `power` a potência fornecida: positivas quando a fonte alimenta o circuito. `dc-current` empurra a corrente para fora do pino `a`.
- **Passivos de dois terminais:** `current` de `a` para `b` por dentro do componente, `voltage` = V(a) − V(b), `power` absorvida.
- **Todo elemento:** `pin.<nome>` é a corrente que **entra** no componente por aquele pino (serve para animar a corrente dentro do símbolo).
- **Fios:** `current.<k>` é a corrente no segmento k, de `points[k]` para `points[k+1]`; `current` é o segmento 0. Num laço só de fios ideais a divisão não é única: um ramo leva a corrente e o segmento que fecha o laço mostra zero.
- `nodeVoltages` traz `GND` e `n1`, `n2`… (os ids de `buildNetlist`, para colorir fios).

## Análises

- **`dc`**: ponto de operação (capacitores abertos, indutores em curto pela resistência do enrolamento, fonte CA no nível contínuo). O tempo continua andando em passos de 1 ms para os modelos térmicos: a lâmpada esquenta, o fusível rompe no tempo certo.
- **`transient`**: passo fixo `dt`, regra trapezoidal, Euler implícito no primeiro passo e depois de cada descontinuidade (chave, fusível, parâmetro mudado). Começa com capacitores e indutores no valor `ic` (padrão 0), sem calcular o ponto de operação antes. `tStop` pausa a simulação.
- **`ac-sweep`** e **`quasi-static`**: entregas S2 e S3; até lá `load()` recusa com mensagem.

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

Cada dano emite um `SimEvent` `damaged` com mensagem pronta, por exemplo `O fusível F1 rompeu: corrente de 10 A, nominal 1 A.`. Os modelos térmicos são típicos de ensino, não de um fabricante.

## Adicionar um dispositivo

Crie `devices/<tipo>.ts` com `export default defineDevice({ info, create })` (veja [`device.ts`](device.ts) e os dispositivos existentes). O registro acha o arquivo sozinho. Regras:

- `stamp()` só escreve no sistema MNA e **não** muda estado (pode ser chamado várias vezes por passo).
- `update()` roda depois de cada solução; só avance estados e cheque limites quando `ctx.commit` for verdadeiro.
- Dano: `ctx.emit('damaged', mensagem em pt-BR)` e `ctx.discontinuity()`.
- Parâmetros e leituras com rótulo em pt-BR (`readoutInfo`); pinos de fontes e polarizados com `label`.
- Um teste em `__tests__/` para cada dispositivo. Nada de DOM fora de `runtime/`.

## Validação

- **ngspice:** circuitos de referência em `tools/ngspice/*.cir`; `node tools/ngspice/generate.ts` (com `ngspice` instalado) grava `__golden__/*.csv`, versionados. `__tests__/golden.test.ts` exige CC dentro de 0,1 % e transiente dentro de 1 % do pico (hoje o pior caso fica em 0,07 %).
- **Desempenho:** 50 nós com passo de 10 µs passam de 25 mil passos/s no Node; no Chromium com a CPU 4× mais lenta, o teste e2e de `/dev/motor/` exige mais de 1.000 passos/s a mais de 50 quadros/s.
