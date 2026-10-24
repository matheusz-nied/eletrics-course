---
termo: Memória não volátil
resumo: 'Memória que guarda os dados mesmo sem alimentação, como a EEPROM e a flash. A RAM, feita de flip-flops ou capacitores, perde tudo quando a energia cai.'
sinonimos: [EEPROM, memória flash, flash, ROM, memória volátil, RAM, SRAM]
relacionados: [flip-flop, microcontrolador]
aula: m11-digital/04-flip-flops-contadores-e-memoria
---
A EEPROM e a flash guardam cada bit como uma carga presa numa ilha isolada dentro de um transistor. Elas aguentam um número limitado de gravações (da ordem de 100 mil na EEPROM de um ATmega328P), por isso um programa bem feito só grava quando um dado muda, como a central do portão ao cadastrar um controle.
