---
termo: Trimpot
resumo: Resistor variável pequeno, soldado na placa, que se ajusta com uma chave de fenda. Serve para configurar ou calibrar um equipamento, como a pausa e a força de uma central de portão.
sinonimos: [trimmer, potenciômetro de ajuste, resistor de ajuste]
relacionados: [resistor, dip-switch, jumper]
aula: m16-portao/08-ajustes-e-testes
---
Um trimpot tem três terminais: as duas pontas de uma pista resistiva e um cursor que desliza sobre ela quando você gira o parafuso. Ligado entre o GND e a alimentação, ele vira um divisor de tensão: o cursor entrega uma tensão entre zero e o máximo, conforme a posição. O microcontrolador da placa lê essa tensão e a transforma num ajuste, como os segundos de pausa de um portão.

Diferente do potenciômetro de volume, o trimpot foi feito para ser ajustado poucas vezes. Use uma chave de fenda do tamanho da fenda, gire devagar e sem forçar além do fim do curso, que a pista quebra. Anote a posição antes de mexer, para poder voltar.
