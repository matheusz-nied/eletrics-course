# CLAUDE.md

Curso online de eletrônica e circuitos elétricos, em português do Brasil, com aulas em MDX, simulações de circuitos em tempo real e modelos 3D. Site estático (Astro), sem backend.

**Leia o plano antes de trabalhar:** `docs/plano/README.md` e os documentos que o seu brief citar.

## Regras

- **Idioma:** tudo que o aluno vê é pt-BR (textos, rótulos, mensagens de erro, títulos). Números no formato brasileiro (`4,7 kΩ`, `1.000 W`). Identificadores de código, nomes de arquivos de código, commits e PRs em inglês. Slugs de URL em português.
- **Donos de pastas:** cada frente de trabalho é dona de pastas específicas (`docs/plano/04-frentes-de-trabalho.md`). Pode **adicionar arquivos novos** nas pastas com auto-registro (`src/engine/devices/`, `src/circuit/symbols/`, `src/three/parts/`, `src/scenes/`, `src/lessons/`). Para **editar arquivos existentes** de outra frente, combine antes com o coordenador.
- **Contrato do motor:** `src/engine/contract.ts` só recebe mudanças compatíveis; quebras passam pelo coordenador.
- **Conteúdo:** segue `docs/plano/03-guia-de-conteudo.md`, incluindo as regras de segurança para rede elétrica.
- **Links internos:** sempre pelo `base` do Astro (`import.meta.env.BASE_URL`); o site roda em `/eletrics-course/`.
- **Dependências:** a Fundação instala as previstas. Dependência nova precisa de justificativa no PR. Nunca editar `pnpm-lock.yaml` à mão.
- **Sem marcas no 3D:** nenhum logotipo ou modelo com marca de fabricante. Marcas podem ser citadas no texto.
- **Sem serviços pagos** (geração de imagem/3D por IA, APIs) sem autorização do Matheus.

## Antes de abrir um PR

```
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
```

## Comandos

Node 22 e pnpm 10 (`packageManager` no `package.json`).

```
pnpm install      # dependências
pnpm dev          # servidor local: http://localhost:4321/eletrics-course/
pnpm build        # site em dist/ + índice de busca (Pagefind)
pnpm preview      # serve dist/ com o mesmo base do GitHub Pages
pnpm lint         # ESLint + Prettier (só verifica)
pnpm format       # corrige formatação e o que o ESLint consegue
pnpm typecheck    # astro check (cobre .astro, .ts e .tsx)
pnpm test         # Vitest: src/**/*.test.ts(x) e tools/**/*.test.ts
pnpm test:e2e     # Playwright contra dist/ (rode pnpm build antes)
```

- `astro dev` e `astro preview` percebem que rodam num agente e sobem em segundo plano; pare com `pnpm astro dev stop` (ou `preview stop`). O Playwright sobe o próprio preview com `--ignore-lock`.
- O Playwright está fixado em 1.56.1 para usar o Chromium já instalado em `/opt/pw-browsers`; no CI ele é baixado.
- Links e caminhos internos: `withBase()`, `lessonUrl()` e `moduleUrl()` de `src/lib/url.ts`. Ordem do curso, rascunhos e vizinhos: `getCourse()` de `src/lib/content.ts`.
- Aulas com `rascunho: true` aparecem na navegação só no `pnpm dev`. No build a página existe (com aviso e `noindex`), mas nada aponta para ela.
- Componentes das aulas: mapa fixo em `src/components/mdx.ts`. Cada frente substitui o próprio stub (`src/circuit/Simulation.astro` etc.) mantendo as props. A Experiência também tem stubs para encaixar o progresso e a busca sem editar layouts: `src/course/LessonProgress.astro`, `ModuleProgress.astro` e `HeaderActions.astro`.
- Testes e2e de cada frente em `tests/e2e/<frente>-*.spec.ts`, com os helpers de `tests/e2e/helpers.ts` (`watchErrors`, `expectAccessible`, `expectNoHorizontalOverflow`).
- Fórmulas: `remark-math` + `rehype-katex` no processador `unified()` (o padrão do Astro 7, Sätteri, não roda plugins remark/rehype).
