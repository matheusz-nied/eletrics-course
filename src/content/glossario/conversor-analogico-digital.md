---
termo: Conversor analógico-digital
resumo: 'Circuito que mede uma tensão e a transforma num número inteiro. No ADC de 10 bits de 5 V, 0 V vira 0 e 5 V vira perto de 1023.'
sinonimos: [ADC, conversor A/D, entrada analógica]
relacionados: [microcontrolador, divisor-de-tensao, gpio]
aula: m12-microcontroladores/01-o-que-e-um-microcontrolador
---
Um conversor de 10 bits divide a faixa em 1024 degraus. Com referência de 5 V, cada degrau vale cerca de 4,9 mV, e a leitura é a tensão dividida por 5 V e multiplicada por 1024, arredondada para baixo. O ESP32 tem conversores de 12 bits (de 0 a 4095) numa faixa de cerca de 3,3 V.

Sensores que variam a resistência, como o NTC e o LDR, entram no conversor por um divisor de tensão.
