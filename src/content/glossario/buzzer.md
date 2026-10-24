---
termo: Buzzer
resumo: 'Pequeno emissor de som para sinais e alarmes. O ativo tem um oscilador interno e apita com tensão contínua; o passivo precisa receber uma onda quadrada na frequência do som.'
sinonimos: [sonorizador, bipe, campainha piezoelétrica]
relacionados: [microcontrolador, pwm, frequencia]
aula: m12-microcontroladores/04-atuadores
---
O buzzer ativo é o mais simples: ligou, apita, sempre no mesmo tom (em geral perto de 2 a 4 kHz). O passivo é um alto-falante pequeno: o microcontrolador gera a frequência, e por isso ele toca notas e melodias.

Os modelos pequenos de 5 V puxam de 10 a 30 mA e muitas vezes vão direto no pino; os maiores, ou os de 12 V, precisam de um transistor.
