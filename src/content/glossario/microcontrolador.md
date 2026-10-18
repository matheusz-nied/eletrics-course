---
termo: Microcontrolador
resumo: "Pequeno computador num único chip, com processador, memória e pinos de entrada e saída. Lê botões e sensores, roda um programa gravado nele e comanda relés, LEDs e outros circuitos."
sinonimos: [micro, MCU, µC]
relacionados: [pull-up, transistor, triac, led]
aula: m16-portao/03-a-central-por-dentro
---
Os pinos de entrada leem níveis de tensão (alto ou baixo) ou, nas entradas analógicas, o valor da tensão, como a posição de um trimpot. Os pinos de saída fornecem pouca corrente; para acionar um relé, a placa usa um transistor e um diodo em paralelo com a bobina.

Na central do portão, o microcontrolador roda uma máquina de estados: a cada passo, olha o estado atual e as entradas (fim de curso, botoeira, fotocélula, controle remoto, corrente do motor) e decide o próximo estado e as saídas (relés, TRIAC, trava, luz, LEDs, buzzer).
