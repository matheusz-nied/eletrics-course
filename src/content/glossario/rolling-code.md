---
termo: Rolling code
resumo: "Sistema de controle remoto em que o código muda a cada aperto. A central recusa um código que já foi usado, o que impede abrir o portão com uma cópia gravada."
sinonimos: [código rolante, código variável, hopping code]
relacionados: [code-learning]
aula: m16-portao/06-controle-remoto-e-receptor
---
Cada controle tem um número de série e um contador que avança a cada aperto. O controle cifra o contador com uma chave e manda o resultado. A central guarda o último contador recebido de cada controle e só aceita um valor maior, dentro de uma janela. Se um copiador gravar um aperto e repetir depois, o contador repetido é recusado.

O controle e a central precisam usar o mesmo padrão de rolling code. Um controle de código fixo não é aceito por um receptor só de rolling code, e o contrário também não.
