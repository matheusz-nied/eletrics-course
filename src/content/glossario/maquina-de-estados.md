---
termo: Máquina de estados
resumo: 'Jeito de organizar a lógica de um equipamento: ele está sempre num estado, e cada evento leva a outro estado, com as saídas definidas pelo estado em que está.'
sinonimos: [máquina de estados finitos, autômato]
relacionados: [microcontrolador, firmware]
aula: m12-microcontroladores/02-maquinas-de-estado
---
A central de um portão é um exemplo clássico: os estados são fechado, abrindo, aberto, fechando e parado. Um toque no controle quer dizer coisas diferentes em cada um deles, e é o estado atual que decide o que acontece.

No programa, o estado fica guardado numa variável. A cada volta do laço principal, o programa lê as entradas, decide se troca de estado e liga ou desliga as saídas.
