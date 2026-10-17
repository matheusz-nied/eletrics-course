<!-- Title and description in English. Anything students see stays in pt-BR. -->

## What

<!-- What changes for the student or for the other workstreams. Link the page or /dev/ gallery where it can be seen. -->

## Workstream

<!-- F, S, E, T, U, C, B, P, A1–A9 or R, and the brief item this delivers. -->

## How

<!-- Short notes on the approach, and anything a reviewer should look at first. -->

## Checklist

- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e` passes locally
- [ ] Only files owned by this workstream changed, or the change was agreed with the coordinator
- [ ] New dependencies (if any) are justified above; `pnpm-lock.yaml` was not edited by hand
- [ ] Lessons follow `docs/plano/03-guia-de-conteudo.md`, including the mains-safety rules
- [ ] Internal links use the Astro base (`withBase()` from `src/lib/url.ts`)
