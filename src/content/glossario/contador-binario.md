---
termo: Contador binário
resumo: 'Circuito que soma um a cada pulso de clock e mostra a contagem em binário nas saídas. Com n bits, conta de 0 a 2ⁿ − 1 e volta a 0.'
sinonimos: [contador, contador assíncrono, divisor de frequência, prescaler, CD4520, CD4060]
relacionados: [flip-flop, clock, bit]
aula: m11-digital/04-flip-flops-contadores-e-memoria
---
Cada saída troca de nível com a metade da frequência da anterior, então um contador também é um divisor de frequência: 15 estágios dividem os 32.768 Hz de um cristal de relógio por 2¹⁵, e sobra 1 Hz para o ponteiro dos segundos.
