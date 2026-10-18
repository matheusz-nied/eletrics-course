---
termo: MOSFET
resumo: 'Transistor comandado por tensão: a tensão entre o gate e a fonte (source) abre ou fecha um canal entre o dreno e a fonte. O gate é isolado por uma camada de óxido, e parado não puxa corrente.'
sinonimos: [transistor de efeito de campo, FET, MOSFET canal N]
relacionados: [transistor, resistencia-de-conducao, dissipador, pwm, descarga-eletrostatica]
aula: m09-semicondutores/08-mosfet
---
Os terminais são gate (G), dreno (D) e fonte (S, de source). Abaixo da tensão de limiar, o MOSFET fica cortado; bem acima dela, conduz como um resistor de valor muito baixo, a resistência de condução. Os MOSFETs comuns precisam de cerca de 10 V no gate para conduzir totalmente; os de nível lógico conduzem com 5 V ou menos, direto do pino de um microcontrolador.

A camada de óxido do gate é finíssima e rompe com cerca de 20 V ou com uma descarga eletrostática. Quando um MOSFET de potência queima, ele quase sempre fica em curto entre dreno e fonte, e a carga fica ligada sem parar.
