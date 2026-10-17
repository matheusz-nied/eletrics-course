# Kit 3D (`src/three/`)

Biblioteca de peças 3D paramétricas, em tamanho real, que o curso inteiro usa: as aulas (`<Model3D>`), as cenas reais (`src/scenes/`) e a bancada (`src/bench/`). Plano: `docs/plano/02-arquitetura.md`, seção 7.

Galeria para conferir tudo: **`/dev/pecas/`** (`pnpm dev` → http://localhost:4321/eletrics-course/dev/pecas/).

## Usar numa aula

```mdx
<Model3D part="resistor" props={{ ohms: 4700, watts: 0.5 }} />
<Model3D part="led" props={{ color: 'verde', brightness: 0.6 }} annotations />
<Model3D part="relay" explode caption="Relé aberto: bobina, armadura e contatos." />
```

| Prop | O que faz |
|------|-----------|
| `part` | id da peça (nome do arquivo em `parts/` ou `instruments/`). Id desconhecido quebra o build com uma mensagem clara. |
| `props` | propriedades da peça (veja a galeria; o snippet MDX aparece lá) |
| `explode`, `cutaway`, `annotations` | começa com a vista explodida, o corte ou as anotações ligados |
| `height` | altura da vista em px (padrão 360) |
| `caption` | legenda; o padrão é a descrição gerada pela peça |

O pôster (imagem estática) aparece na hora; o 3D carrega quando a vista se aproxima da tela e é destruído quando sai, então uma aula pode ter várias vistas sem estourar o limite de contextos WebGL. Sem WebGL, o aluno vê o pôster e um aviso.

## Usar em cenas e na bancada

As peças são componentes React Three Fiber comuns, em milímetros:

```tsx
import Resistor from '../three/parts/resistor';
import Led from '../three/parts/led';
import { Stage } from '../three/core/Stage';
import { ViewProvider } from '../three/core/view';

<Canvas>
  <ViewProvider>              {/* opcional: vista explodida e corte */}
    <Stage environment="externo" toneMapping="agx">
      <group scale={0.001}>   {/* cena em metros */}
        <Led color="verde" brightness={frame.readouts['D1.brightness']} />
      </group>
    </Stage>
  </ViewProvider>
</Canvas>
```

- `Stage`: HDRI (`estudio`, `externo`, `interno`), fundo que segue o tema, sombras de contato, enquadramento automático, órbita e pós-processamento conforme o nível de qualidade (`core/quality.ts`).
- Fora de um `ViewProvider`, as peças aparecem montadas e sem corte.
- Peças que reagem à simulação recebem os valores como props (`brightness`, `burned`, `closed`, `rpm`…).

## Escrever uma peça nova

Um arquivo por peça em `parts/` (ou `instruments/`), com o nome em inglês e kebab-case. O nome do arquivo é o id. Arquivos começando com `_` são auxiliares e não viram peça. O registro é automático.

```tsx
export const meta: PartMeta = {
  id: 'resistor',              // igual ao nome do arquivo
  label: 'Resistor',           // pt-BR
  category: 'passivos',
  summary: 'Uma frase para a galeria e para leitores de tela.',
  defaults: { ohms: 1000, watts: 0.25 },   // também são as props do pôster
  controls: { ohms: { kind: 'number', label: 'Resistência', min: 1, max: 1e7, log: true, unit: 'Ω' } },
  annotations: [{ at: [0, 3, 0], text: 'Faixas de cor: valor e tolerância' }],
  explode: true,               // usa <Explode>
  cutaway: true,               // usa <Material clip>
  describe: (p) => `Resistor de ${formatOhms(Number(p.ohms))}.`,
  view: [0.6, 0.9, 1.5],       // direção da câmera
  animated: false,             // true (ou função das props) se algo se move sozinho
};

export default function Resistor(props: ResistorProps) { … }
```

Regras:

- **Unidades:** 1 unidade = 1 mm, eixo Y para cima, peça apoiada em y = 0 e centrada em X/Z. Dimensões de datasheet (anote a fonte no comentário do topo).
- **Props:** todas opcionais, serializáveis (número, texto, booleano); comece com `const p = { ...meta.defaults, ...props }`.
- **Materiais:** `<Material preset="tin" />` (lista em `materials/presets.ts`), com sobreposições (`color`, `roughness`…). Cascas que o corte deve abrir usam `clip`; a face cortada aparece sólida (`cutColor`).
- **Vista explodida:** `<Explode offset={[0, 8, 0]}>` em volta de cada parte que se afasta. `<Anchor name="…">` marca pontos que as anotações seguem (`annotations: [{ anchor: '…', exploded: true }]`).
- **Rótulos impressos:** `useCanvasTexture(draw, chave)` com `fitText`, `FONT_SANS`, `FONT_MONO`. Nada de marcas ou logotipos de fabricantes.
- **Geometria:** `useDisposable(() => geometria, [deps])` para geometrias criadas no código; `axialLathe` (corpos de revolução com faixas pintadas no lugar certo), `roundedPath` + `tube` e `<Wire>` (terminais e fios), `roundedCylinderProfile`.
- **Luz:** superfícies que *emitem* luz usam `emission(cor, brilho)` (`fx/glow.ts`, intensidade `GLOW`): só elas passam do limiar do bloom. `<GlowSprite>` desenha o halo onde não há bloom.
- **Calor:** `blackbodyColor` e `glowIntensity` (`fx/blackbody.ts`) para filamentos e peças superaquecidas.
- **Animação:** `useFrame` para mexer; declare `animated` no `meta` para a vista renderizar todo quadro enquanto for preciso.
- **Lint:** o React Compiler não é usado aqui; arquivos que mudam objetos do three.js dentro de `useFrame` podem começar com `/* eslint-disable react-hooks/immutability -- … */`.

## Pôsteres

Cada peça tem um pôster em `posters/<id>.webp` (960 × 600, props padrão), usado enquanto o 3D carrega e quando não há WebGL. Para gerar de novo depois de mudar uma peça:

```
pnpm build && UPDATE_POSTERS=1 pnpm exec playwright test kit3d-posters --project=desktop
```

## Ambientes HDRI

Em `public/hdri/` (CC0, Poly Haven; ver o README de lá). O `estudio` foi tratado para luz de estúdio de produto: as fontes de luz pequenas e muito fortes foram espalhadas (sem mudar a energia total) e as áreas escuras foram clareadas, para metais não refletirem um quarto preto.
