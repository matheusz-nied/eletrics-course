# Plano do curso

Curso online, em português do Brasil, que leva qualquer pessoa dos princípios da eletricidade até tarefas reais de eletricidade e eletrônica, com aulas em forma de artigo, simulações físicas interativas e modelos 3D realistas dos componentes e dos equipamentos.

**Referência de sucesso:** uma pessoa vai trocar o motor do portão eletrônico de casa. Depois da Trilha Portão, ela consegue desligar e soltar os cabos com segurança, identificar os fios do motor com o multímetro, montar e ligar a central nova, configurar os jumpers, cadastrar os controles, testar a segurança e entender por que cada ligação é feita daquele jeito. O resto do curso tem o mesmo padrão para outros casos reais (tomadas, interruptores, chuveiro, fontes, LEDs, automação).

## Documentos

| Documento | Conteúdo |
|-----------|----------|
| [01-curriculo.md](01-curriculo.md) | 4 partes, 18 módulos, ~113 aulas, com simulações, modelos 3D e casos reais de cada aula; trilhas |
| [02-arquitetura.md](02-arquitetura.md) | Stack e porquês, pastas e donos, formato do conteúdo, motor de simulação (contrato), esquemático, pipeline 3D, bancada, qualidade, deploy, riscos |
| [03-guia-de-conteudo.md](03-guia-de-conteudo.md) | Tom, estrutura da aula, números e unidades, regras de segurança, checklist |
| [04-frentes-de-trabalho.md](04-frentes-de-trabalho.md) | Frentes, ondas, dependências, donos de pastas, processo e um brief pronto para cada thread |
| [05-portao.md](05-portao.md) | Especificação do caso do portão: central genérica, ligações, modelo de simulação, passo a passo, defeitos, equivalência com marcas |

## Princípios

1. **Física de verdade.** As simulações usam um motor de circuitos (análise nodal, como o SPICE). Componentes queimam quando passariam do limite, motores zumbem sem capacitor, fusíveis rompem no tempo certo.
2. **Ver por dentro.** Todo componente e equipamento importante tem modelo 3D com dimensões reais, vista explodida, corte e anotações, e reage à simulação (LED acende, relé estala, portão anda).
3. **Da teoria à bancada.** Toda aula tem um caso real; a Parte 4 é só prática, com exercícios de ligação que mostram a consequência de cada erro.
4. **Segurança primeiro.** Regras de segurança obrigatórias em tudo que toca a rede elétrica, reforçadas pela própria simulação.
5. **Feito para o Brasil.** 127/220 V, 60 Hz, NBR 5410, NBR 14136, NR-10, vocabulário de loja e de técnico.
6. **Roda em qualquer lugar.** Site estático, sem login, funciona no celular, e o modo oficina funciona offline.

## Decisões

| Decisão | Escolha | Situação |
|---------|---------|----------|
| Stack | Astro 7 + React 19 + TypeScript + Tailwind + MDX; 3D com three.js/React Three Fiber; simulação com motor próprio em TypeScript validado contra ngspice | Definida no plano |
| Backend | Nenhum; progresso no navegador (exportável) | Definida no plano |
| Idioma | Tudo que o aluno vê em pt-BR; identificadores de código, commits e PRs em inglês | Definida no plano |
| Hospedagem | GitHub Pages (grátis; o repositório é público) | Recomendada, aguardando o Matheus |
| Merge dos PRs | Claude faz o merge quando o CI passa | Recomendada, aguardando o Matheus |

## Fases

1. **Fundação** (1 thread).
2. **Plataforma** (4 em paralelo): motor de simulação, esquemático e instrumentos, kit 3D, experiência do curso.
3. **Portão e primeiros módulos** (5 em paralelo): cenas reais 3D, bancada interativa, módulo do portão, M00–M03.
4. **Conteúdo** M04–M10.
5. **Conteúdo** M11–M17.
6. **Revisão técnica e lançamento.**

O site é publicado desde a fase 1 e cresce a cada PR; cada módulo aparece assim que fica pronto.
