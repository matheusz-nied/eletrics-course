---
termo: Relé de estado sólido
resumo: "Relé sem peças móveis: a entrada acende um LED interno, e a luz dispara um semicondutor que liga a carga. Silencioso e sem desgaste, mas esquenta e tem corrente de fuga."
sinonimos: [SSR, relé estático]
relacionados: [rele, transistor, led]
aula: m05-magnetismo/06-reles-e-contatores
---
A luz faz o isolamento entre o comando e a carga, como a armadura faz num relé comum. Os modelos de saída CA usam tiristores, e muitos só ligam quando a tensão da rede passa por zero; os de saída CC usam transistor ou MOSFET. Um modelo de saída CA não desliga carga de corrente contínua.

A saída tem uma queda de tensão que vira calor, e com corrente alta ele precisa de dissipador. Desligado, deixa passar uma pequena corrente de fuga, que pode fazer uma lâmpada LED brilhar fraco. Quando queima, costuma ficar em curto, com a carga ligada.
