# 03 · Guia de conteúdo

Regras para quem escreve aulas. Valem para todas as frentes de conteúdo e para a revisão.

## 1. Público e tom

- Adulto curioso, sem formação técnica, que quer **entender** e **fazer**. Muitos vão ler no celular, às vezes ao lado do equipamento.
- Português do Brasil, segunda pessoa ("você"), frases curtas, voz ativa. Explicar antes de nomear: primeiro a ideia, depois o termo técnico.
- Analogias são bem-vindas, mas cada uma diz onde deixa de valer (a analogia da água não explica indutância, por exemplo).
- Vocabulário de loja de material elétrico e de técnico de campo junto com o termo formal: "borne (aquele conector de parafuso)", "jumper (a pecinha que liga dois pinos)".
- Nada de "simplesmente", "é óbvio", "fácil".

## 2. Estrutura de uma aula

A ordem pode variar quando fizer sentido, mas toda aula tem estes elementos:

1. **Gancho**: uma situação real em 2–4 frases (o disjuntor que desarma, o motor que só zumbe).
2. **Objetivos**: vêm do frontmatter e aparecem no topo automaticamente.
3. **Intuição**: a ideia com figura, animação ou 3D.
4. **Formalização**: equações com unidades, em KaTeX, com cada símbolo explicado na primeira vez.
5. **Explore**: pelo menos uma simulação ou modelo 3D com uma tarefa concreta ("aumente R até a corrente cair pela metade; o que aconteceu com a potência?"). Aulas puramente conceituais podem usar figura interativa no lugar.
6. **Exemplo resolvido**: números reais, passo a passo, conferidos no simulador.
7. **Na prática** (`<RealCase>`): onde isso aparece na vida real e o que a pessoa faria com esse conhecimento.
8. **Erros comuns e segurança**.
9. **Exercícios** (`<Quiz>`): 4 a 8 questões, com feedback em cada alternativa. Pelo menos uma numérica quando a aula tiver cálculo.
10. **Resumo**: 3 a 6 tópicos.

Tamanho: 1.200 a 3.000 palavras de texto. Partes matemáticas pesadas vão em `<DeepDive>` para quem quiser pular.

## 3. Números, unidades e notação

- Vírgula decimal e ponto de milhar: `1,5 V`, `4,7 kΩ`, `1.000 W`. No LaTeX, use `{,}` para a vírgula: `$1{,}5\,\text{V}$`.
- Espaço entre número e unidade (`10 mA`); prefixos SI (`µ`, não `u`, no texto visível).
- **CA** e **CC** no texto (mencionar que equipamentos usam AC/DC, Vca/Vcc).
- Tensões brasileiras: 127 V e 220 V, 60 Hz. Dizer "127 V" e não "110 V", mas explicar que o povo chama de 110.
- Valores típicos sempre identificados como "típico". Nunca inventar valor de norma, número de item de norma ou especificação de fabricante; se não tiver certeza, descreva sem o número ou pesquise na fonte primária.

## 4. Segurança (obrigatório)

- Toda aula com `seguranca: rede` no frontmatter abre com `<Callout type="seguranca-rede">`, que lembra: desligar o disjuntor, testar a ausência de tensão com um instrumento que você acabou de testar numa tomada energizada, sinalizar o quadro, nunca trabalhar sozinho em rede energizada, e chamar um eletricista habilitado quando não tiver segurança.
- Procedimentos práticos sempre na ordem segura, e a simulação/bancada reforça isso (o exercício de ligação não deixa soltar fio com disjuntor ligado).
- Não ensinar a anular dispositivos de segurança. Quando um equipamento real permite isso (ex.: jumper que dispensa a fotocélula), explicar o que faz, por que existe e por que não deve ser usado.
- Capacitores grandes podem guardar carga: ensinar a descarregar com segurança antes de mexer.
- Normas citadas pelo nome (NBR 5410, NBR 14136, NR-10) com o que elas pedem em linguagem simples, sem inventar detalhes.

## 5. Simulações e 3D na aula

- Circuito de aula fica em `src/lessons/mNN/<slug>.circuit.ts` e é usado como `<Simulation circuit="mNN/<slug>" />`.
- Toda simulação tem `description` (texto acessível) e uma **tarefa** no texto ao redor. Simulação sem pergunta é decoração.
- Valores citados no texto devem bater com o simulador. Quando o texto citar um valor calculado, declare `goals` no circuito para o teste automático conferir.
- Modelos 3D servem para mostrar o que a pessoa vai encontrar no mundo real: como o componente é, onde fica o terminal, o que tem dentro. Use anotações para nomear as partes.
- Peça ou dispositivo que ainda não existe: verificar a lista em `/dev/pecas` e no catálogo do motor; se faltar, criar um arquivo novo na pasta com auto-registro (regra de extensão) ou pedir ao coordenador.

## 6. Exemplo de aula (trecho)

```mdx
---
titulo: Lei de Ohm
modulo: m01-eletricidade-do-zero
ordem: 4
nivel: B
duracaoMin: 20
objetivos:
  - Relacionar tensão, corrente e resistência
  - Calcular a corrente num resistor
prerequisitos: [m01-eletricidade-do-zero/03-tensao]
tags: [resistência, lei de ohm]
seguranca: baixa-tensao
---

Você já reparou que uma extensão fina esquenta quando liga um aquecedor nela?
A explicação começa numa relação simples entre três grandezas.

## A ideia

…

$$
V = R \cdot I
$$

<Simulation circuit="m01/lei-de-ohm" />

Na simulação acima, deixe a tensão em 9 V e mude a resistência de 100 Ω para 1 kΩ.
O que acontece com a corrente?

<RealCase title="A extensão que esquenta">
…
</RealCase>

<Quiz questions={[
  { type: 'numerica', prompt: 'Uma lâmpada de 127 V tem resistência de 254 Ω acesa. Qual a corrente?',
    answer: 0.5, tolerance: 0.02, unit: 'A',
    explanation: 'I = V/R = 127/254 = 0,5 A.' },
]} />
```

## 7. Checklist de qualidade (antes do PR)

- [ ] Frontmatter válido; build passa.
- [ ] Todos os elementos da estrutura (seção 2).
- [ ] Pelo menos uma interação com tarefa; simulações rodam sem erro e sem "não converge".
- [ ] Valores conferidos no simulador ou com cálculo mostrado.
- [ ] Callout de segurança quando há rede elétrica; procedimento na ordem segura.
- [ ] Português revisado (acentos, vírgula decimal, termos do glossário com `<Term>` na primeira aparição).
- [ ] Funciona no celular (verificar em 390 px de largura).
- [ ] Termos novos adicionados em `src/content/glossario/` (um arquivo por termo, se ainda não existir).
- [ ] Links para pré-requisitos e para as aulas seguintes que aprofundam o assunto.
