---
termo: Optoacoplador
resumo: 'Componente com um LED e um receptor de luz (fototransistor, fototriac) fechados no mesmo encapsulamento, sem ligação elétrica entre os dois lados. O sinal passa pela luz, e os dois circuitos ficam isolados.'
sinonimos: [optoisolador, fotoacoplador, acoplador óptico, opto]
relacionados: [isolacao-galvanica, led, transistor, triac, microcontrolador]
aula: m09-semicondutores/09-tiristores-e-isolamento
---
Do lado de entrada, uma corrente de poucos miliampères acende um LED infravermelho. Do lado de saída, a luz liga um fototransistor (como no PC817) ou um fototriac (como no MOC3021, que dispara um TRIAC na rede). A isolação entre os lados aguenta milhares de volts, conforme a folha de dados, e por isso o optoacoplador é a ponte entre um microcontrolador e a rede elétrica.
