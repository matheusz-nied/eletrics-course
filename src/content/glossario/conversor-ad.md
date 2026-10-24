---
termo: Conversor AD
resumo: 'Circuito que mede uma tensão e a transforma num número binário, de 0 a 2ⁿ − 1. Também chamado de ADC. A resolução, em bits, diz quantos degraus ele tem; a taxa de amostragem, quantas medidas faz por segundo.'
sinonimos: [ADC, conversor analógico-digital, conversor A/D, analogRead, entrada analógica, resolução]
relacionados: [conversor-da, taxa-de-amostragem, bit, microcontrolador]
aula: m11-digital/06-conversao-ad-da-e-pwm
---
O ADC de 10 bits do Arduino Uno divide 5 V em 1.024 degraus de 4,88 mV. O do ESP32 tem 12 bits: 4.096 degraus. Cada leitura é arredondada para um degrau, então ela nunca é mais precisa que um degrau, e na prática ruído e imprecisão da referência pesam mais que isso.
