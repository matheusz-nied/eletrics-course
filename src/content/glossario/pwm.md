---
termo: PWM (modulação por largura de pulso)
resumo: 'Técnica de controlar a potência ligando e desligando a carga muito depressa. A fração de cada ciclo em que ela fica ligada, o ciclo de trabalho, define a média de tensão, corrente e potência.'
sinonimos: [modulação por largura de pulso, ciclo de trabalho, duty cycle]
relacionados: [mosfet, microcontrolador, frequencia, led, fita-de-led]
aula: m09-semicondutores/08-mosfet
---
Com 25 % de ciclo de trabalho, a carga recebe em média um quarto da potência. Como a chave (um MOSFET, por exemplo) passa o tempo todo totalmente ligada ou totalmente desligada, ela quase não esquenta. O PWM controla o brilho de LEDs e a velocidade de motores CC, e é a base das fontes chaveadas. A frequência precisa ser alta o bastante para a carga não "ver" as piscadas: nos LEDs, algumas centenas de hertz já enganam o olho.
