# Módulo 16 · Portão eletrônico (`src/lessons/m16/`)

Arquivos de apoio das aulas do M16 (`src/content/aulas/m16-portao/`). Especificação: `docs/plano/05-portao.md`.

| Pasta / arquivo | O que tem |
|-----------------|-----------|
| `firmware/central-generica.ts` | Firmware da central genérica CD-1, carregado pelo `mcu` do motor como `params.firmware = "m16/central-generica"`. Lado elétrico: pinos, pull-ups, escalas do ADC |
| `central/controller.ts` | A lógica da central: máquina de estados, acionamento do motor (relés + TRIAC com partida suave), detecção de obstáculo, fechamento automático, cadastro de controles, LEDs e buzzer |
| `central/firmware-api.ts` | Formato de firmware proposto para o `mcu` (função pura de estado, entradas e tempo) |
| `central/plant.ts`, `central/system.ts` | Modelo comportamental do portão (motor, fim de curso, fotocélula, defeitos) e o sistema completo sem o simulador de circuitos, para os testes e os widgets das aulas |
| `FONTES.md` | Pesquisa dos manuais reais (centrais, motores, normas) e os valores típicos que as aulas usam. Fonte única para produtos, valores e normas citados no módulo |
| `PESQUISA.md` | As notas completas da leitura dos manuais, com página e citação, de onde sai o resumo em `FONTES.md` |
| `*.circuit.ts` | Circuitos das aulas no simulador: `motor-capacitor` (16.2), `descarga-capacitor`, `fim-de-curso`, `fotocelula-nf`, `trimpot-pausa` |
| `ui/` | Widgets das aulas: `CentralVirtual` (a CD-1 rodando o firmware contra o modelo do portão, com defeitos para diagnóstico), `MedirFios` (achar o fio comum com o ohmímetro), `DiagnosticoPortao` (casos de defeito) e `EmBreve` (marcador das partes 3D e da bancada que ainda não chegaram) |
| `figuras/` | Figuras SVG das aulas, como `PlacaCD1` (a placa da central com destaque por grupo) |
| `oficinas/` | Oficina `trocar-motor-portao`, usada por `<Workshop id="trocar-motor-portao" />` |
| `__tests__/` | Testes do firmware (abre, para no fim de curso, pausa, fecha, fotocélula reverte, obstáculo, tempo de 40 s, comando durante o movimento, cadastro, rolling code), dos circuitos das aulas e dos valores que o texto cita |

## Formato do firmware

```ts
import { defineFirmware } from '../central/firmware-api';

export default defineFirmware({
  id: 'm16/central-generica',
  title: 'Central genérica CD-1',
  description: '…',
  period: 0.01,          // s, um passo do programa
  vcc: 5,                // V, alimentação e referência do ADC
  pins: [{ name: 'FCA', kind: 'digital-in', pullUp: true, label: 'Fim de curso de abertura' }, …],
  init(memory) { … },    // estado ao ligar; memory = o que persist() devolveu (EEPROM)
  step(state, { t, dt, pins, rf }) { return { state, pins, readouts, events }; },
  persist(state) { … },  // parte do estado que sobrevive sem energia (controles cadastrados)
});
```

- **`digital-in`** recebe `true` (nível alto) ou `false` (baixo). Com `pullUp`, contato aberto ou pino desligado lê alto; contato fechado para o GND lê baixo. Na CD-1 todas as entradas são assim: fim de curso, botoeira, fotocélula (NF: feixe livre = baixo), PROG, jumpers e DIP (colocado/ligado = baixo).
- **`analog-in`** recebe a tensão no pino (0 a `vcc`). Trimpots `PAUSA` e `FORCA` são divisores de 5 V. `CORRENTE` vem do sensor de corrente do motor: **0,5 V por ampère** (eficaz), `SENSOR_CORRENTE_V_POR_A`.
- **`digital-out`** devolve o nível da saída (`K1`, `K2`, `TRAVA`, `AUX`, `BUZZER`, `LED_PROG`).
- **`phase-out`** (`TRIAC`) devolve a fração de cada semiciclo em que o TRIAC conduz, de 0 a 1: o controle de fase que dá a partida suave e limita a força.
- **`rf`** traz os quadros do receptor de 433,92 MHz desde o último passo: `{ serial, button, counter? }`, um por aperto. Sem `counter` é código fixo (*code learning*); com `counter` é *rolling code* e a central recusa contador repetido ou para trás.
- **`readouts`** vira leitura do elemento (`U1.estado` = `"ABERTO"`, `U1.pausaRestante`, `U1.controles`…), útil para metas (`goals`) e para a interface. **`events`** são mensagens em pt-BR (`info` ou `warning`).

K1 e K2 nunca ficam ligados juntos, os relés só comutam com o TRIAC desligado, e entre um sentido e outro os dois ficam desligados por pelo menos 300 ms (os testes conferem isso a cada passo).
