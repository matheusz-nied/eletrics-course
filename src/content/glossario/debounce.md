---
termo: Debounce
resumo: 'Tratamento que faz um botão ou contato que trepida ser lido como uma única troca de nível. Pode ser feito com um filtro RC e uma entrada Schmitt trigger, ou no programa, esperando o nível ficar parado por alguns milissegundos.'
sinonimos: [antirrepique, anti-trepidação, trepidação de contato, repique, bounce]
relacionados: [schmitt-trigger, pull-up, constante-de-tempo]
aula: m11-digital/03-pull-up-pull-down-e-debounce
---
Quando um contato mecânico fecha, as lâminas batem e quicam por alguns milissegundos (o "bounce", ou trepidação). Um circuito digital é rápido o bastante para ver cada quique como um aperto. O debounce espera o contato assentar: a central do portão do curso só aceita um botão que ficou 30 ms no mesmo nível.
