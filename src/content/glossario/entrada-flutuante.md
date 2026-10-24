---
termo: Entrada flutuante
resumo: 'Entrada digital que não está ligada a nada que defina o nível dela. Como quase não puxa corrente, qualquer interferência a leva para cima ou para baixo, e ela lê 0 ou 1 ao acaso.'
sinonimos: [pino flutuante, entrada solta, entrada em aberto, floating]
relacionados: [pull-up, nivel-logico, margem-de-ruido]
aula: m11-digital/03-pull-up-pull-down-e-debounce
---
Uma entrada CMOS tem resistência de entrada de milhares de megaohms. Basta um fio de alguns metros perto da fiação da rede para ela "pegar" os 60 Hz e trocar de nível 120 vezes por segundo. A cura é um resistor de pull-up ou de pull-down, que dá à entrada um caminho de baixa resistência até um nível definido.
