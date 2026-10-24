---
termo: Flip-flop
resumo: 'Circuito digital que guarda um bit. O tipo D copia a entrada D para a saída Q na subida do clock e mantém esse valor até a próxima subida, não importa o que a entrada faça no meio.'
sinonimos: [flip-flop D, flip-flop tipo D, trava, latch, biestável, 74HC74]
relacionados: [clock, contador-binario, porta-logica]
aula: m11-digital/04-flip-flops-contadores-e-memoria
---
A versão mais simples é a trava SR, feita com duas portas NÃO-OU ligadas em laço: uma entrada liga, a outra desliga, e a saída lembra a última ordem. O flip-flop D acrescenta o clock, para que todos os bits de um circuito mudem juntos, no mesmo instante. Registradores, contadores e a memória de um microcontrolador são feitos de flip-flops.
