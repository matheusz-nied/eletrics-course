---
termo: Schmitt trigger
resumo: 'Entrada digital com histerese: passa a ler 1 numa tensão e só volta a ler 0 numa tensão mais baixa. Assim, um sinal lento ou com ruído troca de nível uma vez só.'
sinonimos: [entrada Schmitt trigger, disparador de Schmitt, 74HC14]
relacionados: [histerese, nivel-logico, margem-de-ruido]
aula: m11-digital/01-analogico-e-digital
---
O 74HC14, com seis portas inversoras desse tipo, é o chip clássico para limpar sinais de sensores e botões. Junto com um filtro RC, ele forma o debounce por hardware de um botão (veja a aula 11.3). Muitos microcontroladores têm histerese nas entradas digitais.
