---
termo: Fotocélula
resumo: "Par de sensores (emissor e receptor) com um feixe infravermelho atravessando a passagem do portão. Se algo corta o feixe, o contato do receptor muda e a central não deixa o portão fechar sobre a pessoa ou o carro."
sinonimos: [fotocélula de segurança, sensor de barreira, sensor infravermelho, fotoelétrico]
relacionados: [contato-na-nf, jumper, botoeira]
aula: m16-portao/05-seguranca-e-acessorios
---
O emissor (TX) e o receptor (RX) ficam um de cada lado da passagem, alinhados. O receptor tem um relé com contatos C, NA e NF. Com o feixe livre, o NF está fechado; com o feixe interrompido, ele abre. Quando o portão está fechando e o feixe é cortado, a central para e reabre o portão.

Ligar a fotocélula pelo contato NF é mais seguro: um fio partido ou um receptor sem alimentação parece um feixe cortado, e o portão não fecha. Desativar a fotocélula com jumper ou deixar a central sem ela tira essa proteção.
