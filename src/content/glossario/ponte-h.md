---
termo: Ponte H
resumo: 'Circuito de quatro chaves (transistores ou relés) que liga cada terminal de um motor CC ora ao positivo, ora ao negativo, para inverter o sentido e frear sem trocar fios.'
sinonimos: [H-bridge, driver de motor]
relacionados: [pwm, freio-dinamico, tempo-morto, mosfet]
aula: m08-motores/02-ponte-h-e-pwm
---
Uma diagonal da ponte faz o motor girar para um lado; a outra, para o outro. As duas chaves de baixo juntas freiam o motor. As duas do mesmo lado juntas põem a fonte em curto, e por isso nunca podem conduzir ao mesmo tempo. Módulos como L298N, TB6612FNG e DRV8833 são pontes H prontas.
