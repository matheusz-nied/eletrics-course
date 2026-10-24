---
termo: GPIO
resumo: 'Pino de uso geral de um microcontrolador, que o programa configura como entrada ou como saída digital.'
sinonimos: [pino de entrada e saída, general purpose input/output]
relacionados: [microcontrolador, pull-up, pwm]
aula: m12-microcontroladores/01-o-que-e-um-microcontrolador
---
Como saída, o pino fica em 0 V ou na tensão da alimentação (5 V ou 3,3 V) e fornece poucos miliampères, o bastante para um LED ou para a base de um transistor. Como entrada, ele lê se a tensão está perto de 0 V (nível baixo) ou perto da alimentação (nível alto), e quase não puxa corrente.

Muitos pinos acumulam outras funções: entrada analógica, saída PWM, comunicação serial. Qual função vale em cada momento é o programa que escolhe.
