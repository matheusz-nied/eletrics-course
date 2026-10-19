---
termo: DIAC
resumo: 'Componente de dois terminais que não conduz até a tensão sobre ele passar de cerca de 30 V, em qualquer sentido; aí ele conduz de repente. É usado para gerar o pulso que dispara o TRIAC em dimmers.'
sinonimos: [diac]
relacionados: [triac, tiristor, dimmer, controle-de-fase, capacitor]
aula: m09-semicondutores/09-tiristores-e-isolamento
---
No dimmer, um resistor e um potenciômetro carregam um capacitor a cada semiciclo. Quando a tensão no capacitor chega à tensão de disparo do DIAC (cerca de 32 V no DB3, valor típico), ele conduz e descarrega o capacitor no gatilho do TRIAC, num pulso curto. O DIAC não tem gatilho: quem decide quando ele dispara é a tensão.
