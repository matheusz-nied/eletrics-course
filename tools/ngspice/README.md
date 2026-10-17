# Circuitos de referência (ngspice)

Cada `.cir` é um circuito de referência para os golden tests do motor (`src/engine/__tests__/golden.test.ts`, que tem o mesmo circuito escrito como `CircuitDoc`). O bloco `.control` grava `out.txt` com `wrdata`; transientes passam por `linearize` para ter pontos igualmente espaçados.

```
sudo apt install ngspice
node tools/ngspice/generate.ts   # grava src/engine/__golden__/<nome>.csv
```

Os CSVs ficam versionados: o CI não precisa do ngspice. Para um caso novo, crie o `.cir`, rode o gerador e acrescente o `CircuitDoc` equivalente em `golden.test.ts`.
