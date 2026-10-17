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

A Fundação preenche esta seção quando o projeto existir.
