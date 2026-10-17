# Circuitos de referência (ngspice)

Cada `.cir` é um circuito de referência para os golden tests do motor (`src/engine/__tests__/golden.test.ts`, que tem o mesmo circuito escrito como `CircuitDoc`). O bloco `.control` grava `out.txt` com `wrdata`; transientes passam por `linearize` para ter pontos igualmente espaçados.

```
sudo apt install ngspice
node tools/ngspice/generate.ts   # grava src/engine/__golden__/<nome>.csv
```

Os CSVs ficam versionados: o CI não precisa do ngspice. Para um caso novo, crie o `.cir`, rode o gerador e acrescente o `CircuitDoc` equivalente em `golden.test.ts`.

- **Varredura CA:** `ac dec …` e `wrdata` de colunas `mag(v(n))` e `cph(v(n)) * 180 / pi` (fase contínua, em graus); a primeira coluna vira `frequency`.
- **Não lineares:** use `.options reltol=1e-6 abstol=1e-12` (e `vntol` se preciso) para a referência ficar mais precisa que a tolerância do teste. O gerador para com erro se o ngspice abortar a simulação ("Timestep too small"), em vez de gravar zeros.
