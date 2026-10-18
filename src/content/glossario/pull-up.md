---
termo: Resistor de pull-up
resumo: "Resistor que liga uma entrada digital ao positivo. Com o contato aberto, a entrada lê nível alto; com o contato fechado para o GND, lê nível baixo."
sinonimos: [pull-up, resistor de pull-up, pull-down]
relacionados: [resistor, microcontrolador, contato-na-nf]
aula: m16-portao/04-fim-de-curso-e-sensores
---
Sem o resistor, uma entrada ligada só a um contato aberto fica "flutuando" e pode ler qualquer coisa. O pull-up dá a ela um nível definido. Quando o contato fecha, ele puxa a entrada para o GND, e a corrente que passa é pequena, limitada pelo resistor. Essa ligação é chamada de ativa em nível baixo.

Na central do curso, cada entrada tem um pull-up de 10 kΩ para 5 V. Com o contato fechado, passam 0,5 mA. O pull-down é o contrário: o resistor vai para o GND e o contato liga a entrada ao positivo.
