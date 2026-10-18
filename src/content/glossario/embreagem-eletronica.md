---
termo: Embreagem eletrônica
resumo: Limite de força feito pela própria central do motor. Ela controla quanto o motor empurra e para ou inverte o movimento quando a corrente sobe além do normal, como uma embreagem que patina.
sinonimos: [embreagem, EMBR., ajuste de força, sensibilidade de obstáculo]
relacionados: [triac, protetor-termico, trimpot]
aula: m16-portao/08-ajustes-e-testes
---
Uma embreagem mecânica patina quando a carga passa de um limite. Na eletrônica, a central faz o papel dela: o TRIAC deixa passar só parte de cada semiciclo da rede para o motor, o que limita o torque, e um sensor de corrente avisa quando o motor está fazendo força demais, como ao encostar num carro. Aí a central para o portão ou o faz voltar.

O ajuste aparece com nomes diferentes: trimpot FORÇA, trimpot EMBR. ou um item de menu. Pouca força deixa o portão parar sozinho num trecho mais pesado do trilho; força demais faz o portão empurrar mais forte antes de reverter. O certo é o mínimo que move o portão com folga, conferido com o teste de obstáculo.
