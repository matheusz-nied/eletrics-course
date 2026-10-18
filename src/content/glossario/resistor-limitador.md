---
termo: Resistor limitador
resumo: Resistor ligado em série com um LED (ou outro componente) para limitar a corrente a um valor seguro.
sinonimos: [resistor de limitação, resistor em série do LED]
relacionados: [led, resistor, lei-de-ohm, tensao-direta]
aula: m09-semicondutores/04-leds
---
O LED não limita a própria corrente: um pouco de tensão acima da tensão direta faz a corrente disparar. O resistor em série fica com a tensão que sobra e, pela lei de Ohm, define a corrente:

$$
R = \frac{V_\text{fonte} - V_\text{LED}}{I}
$$

Por exemplo, um LED vermelho (cerca de 2 V) numa fonte de 5 V com 10 mA pede $R = 3\,\text{V} / 0{,}01\,\text{A} = 300\,\Omega$; usa-se o valor comercial de 330 Ω. Confira também a potência do resistor, $P = R \cdot I^2$.
