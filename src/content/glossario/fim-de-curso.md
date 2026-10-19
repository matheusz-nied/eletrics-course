---
termo: Fim de curso
resumo: "Sensor ou chave que avisa a central que o portão chegou ao fim do percurso, aberto ou fechado. Com esse aviso, a central desliga o motor no ponto certo."
sinonimos: [fim-de-curso, chave fim de curso, FC, FCA, FCF, limit switch]
relacionados: [reed-switch, microchave, cremalheira, microcontrolador, contato-na-nf]
aula: m05-magnetismo/05-sensores-magneticos
---
O portão tem dois fins de curso: um para a posição aberta (FCA) e outro para a fechada (FCF). No portão deslizante, o mais comum é um par de ímãs presos na cremalheira e um sensor magnético (reed switch) no motor. Também existem microchaves mecânicas, sensores indutivos e encoders que contam voltas do motor.

A central lê o fim de curso como uma entrada: quando o ímã do lado certo chega perto do sensor, o contato muda de estado e o programa desliga o motor. Por segurança, a central também tem um limite de tempo de motor ligado, para o caso de o fim de curso falhar.

Fim de curso com defeito, ímã fora do lugar ou conector invertido fazem o portão passar do ponto. Os LEDs de fim de curso da central ajudam a testar: cada um deve acender quando o ímã chega ao sensor.
