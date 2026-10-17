# 05 · Especificação do caso do portão eletrônico

Este é o caso de referência do curso. Ele cruza quase todo o currículo: rede elétrica, motor de indução com capacitor, relés e TRIAC, fonte, microcontrolador e máquina de estados, sensores magnéticos, fotocélula, rádio de 433 MHz, leitura de placa, jumpers e diagnóstico.

## 1. Critério de sucesso

Quem terminar a Trilha Portão consegue, com segurança:

1. Explicar o que cada parte do automatizador faz e por que o motor gira para um lado ou para o outro.
2. Desligar e confirmar a ausência de tensão antes de mexer.
3. Registrar e soltar as ligações da central antiga.
4. Escolher o motor e a central novos certos (tensão, potência, tipo de portão, tipo de fim de curso).
5. Identificar o comum e os enrolamentos de um motor com o multímetro, sem depender da cor dos fios.
6. Ligar rede, terra, motor, capacitor, fim de curso, fotocélula e botoeira na central.
7. Configurar jumpers, DIP e trimpots, cadastrar controles e ajustar força e pausa.
8. Testar os dispositivos de segurança (fotocélula e reversão por obstáculo).
9. Diagnosticar os defeitos mais comuns.

A central e o motor do curso são **genéricos**, desenhados a partir do padrão das centrais vendidas no Brasil. A aula "Do genérico para a sua central" faz a ponte com as marcas reais e sempre manda seguir o manual do fabricante.

## 2. O sistema real

| Parte | O que é | Física/eletrônica por trás (aula) |
|-------|---------|-----------------------------------|
| Motor | Monofásico de indução com capacitor permanente, 127 ou 220 V, 1/4 a 1/2 CV | 08.4 |
| Capacitor | Capacitor de motor (filme, µF / VCA na etiqueta), ligado entre os dois enrolamentos | 04.3, 06.3 |
| Redutor | Rosca sem-fim e coroa; reduz rotação, aumenta torque e trava o portão | 08.6 |
| Pinhão e cremalheira | Transformam rotação em movimento linear (deslizante) | 08.6 |
| Embreagem | Mecânica (patina se travar) e/ou eletrônica (limita a força pelo TRIAC) | 09.9 |
| Desbloqueio | Chave que solta o redutor para mover o portão à mão | 16.1 |
| Fim de curso | Reed switch na central/motor e ímãs presos na cremalheira (há também microchave e encoder) | 05.5 |
| Central | Placa de comando: fonte, microcontrolador, relés/TRIAC, receptor RF, entradas e saídas | 16.3 |
| Fotocélula | Transmissor e receptor infravermelho nos pilares; feixe interrompido impede fechar | 12.3 |
| Botoeira | Botão pulsador NA (interfone, botão interno) | 04.7 |
| Controle remoto | Transmissor 433,92 MHz, code learning ou rolling code | 13.2, 13.3 |
| Acessórios | Trava eletromagnética, sinaleira, luz de garagem, módulo Wi-Fi | 05.2, 12.6 |

Tipos de portão cobertos: **deslizante** (foco, cena completa), **basculante** e **pivotante** (cenas simplificadas e diferenças de instalação). Motores CC/inversor ("rápidos") aparecem como variação na aula 16.1 e no M08.

## 3. Central didática genérica (CD-1)

### 3.1 Blocos

```
 REDE (F N ⏚) ─► fusível 10 A ─► fonte chaveada 90–240 Vca → +12 Vcc ─► microcontrolador
       │                                                                    │ entradas: FCA, FCF, BOT, FOTO, PROG, RF
       └─► TRIAC (força/rampa) ─► relé K1 (ABRE) / relé K2 (FECHA) ─► MOTOR │ saídas: K1, K2, gate do TRIAC, AUX, TRAVA, LEDs
                                                                            └─ receptor 433,92 MHz (antena 17 cm)
```

Os relés escolhem o sentido (nunca os dois ao mesmo tempo, com tempo morto de 300 ms ao inverter); o TRIAC liga o motor com partida suave e limita a força (controle de fase ajustado pelo trimpot FORÇA). Isso reproduz a solução mais comum nas centrais nacionais e liga as aulas de relé (04.7, 05.6) e TRIAC (09.9).

### 3.2 Bornes (serigrafia da placa)

| Grupo | Serigrafia | Liga em | Observação |
|-------|-----------|---------|------------|
| Rede | `F` `N` `⏚` | Fase, neutro e terra vindos do disjuntor | Em 220 V entre fases, `N` recebe a segunda fase |
| Motor | `COM` `ABRE` `FECHA` | Fio comum e os dois enrolamentos | Trocar ABRE ↔ FECHA inverte o sentido |
| Capacitor | `CAP` `CAP` | Os dois terminais do capacitor | Na placa, ligados internamente a ABRE e FECHA |
| Fonte auxiliar | `+12V` `GND` | Alimentação da fotocélula | Máx. 300 mA |
| Fotocélula | `FOTO` | Saída do receptor da fotocélula | Espera contato **NF** (feixe livre = fechado para GND) |
| Botoeira | `BOT` `GND` | Botão pulsador NA | |
| Fim de curso | conector 3 vias `FCA` `GND` `FCF` | Sensor reed | Ímã perto = contato fechado |
| Trava | `TRAVA+` `TRAVA−` | Fechadura eletromagnética 12 V | Pulso no início da abertura |
| Auxiliar | `AUX NA` `AUX C` | Luz de garagem (contato seco) | |

A placa também tem: fusível 5×20 mm 10 A, LED `REDE`, LED `FCA` (verde), LED `FCF` (vermelho), LED `FOTO`, LED `PROG`, botão `PROG`, buzzer, antena de fio de 17 cm.

### 3.3 Configuração

| Item | Serigrafia | Função |
|------|-----------|--------|
| Jumper | `J1 FOTO` | **Colocado** = entrada FOTO ignorada. Existe em placas antigas para instalações sem fotocélula. O curso explica o que faz e por que **não** usar (manuais atuais exigem fotocélula) |
| Jumper | `J2 AUT` | Colocado = fechamento automático ligado (tempo do trimpot PAUSA) |
| DIP 1 | `INV` | Inverte o sentido por software (alternativa a trocar os fios ABRE/FECHA) |
| DIP 2 | `LUZ` | Luz de garagem: ligada durante o movimento + 60 s, ou só durante o movimento |
| Trimpot | `PAUSA` | 0 a 120 s; no mínimo, desliga o fechamento automático |
| Trimpot | `FORÇA` | Ângulo de disparo do TRIAC: força do motor e sensibilidade de obstáculo |
| Botão | `PROG` | Toque: cadastra controle (LED acende, aperte o botão do controle, LED pisca = gravado). Segurar 10 s: apaga todos os controles |

## 4. Motor e ligações

- **Por que três fios:** dois enrolamentos (em motores de portão costumam ser iguais) com uma ponta em comum. A central põe a fase num enrolamento; o outro recebe corrente pelo capacitor, defasada de quase 90°. Isso cria o campo girante. Trocar qual enrolamento recebe a fase direto inverte o sentido.
- **Sem capacitor**, ou com capacitor aberto, não há campo girante na partida: o motor zumbe e esquenta, e pode girar para qualquer lado se for empurrado. Esse é o defeito mais comum e precisa aparecer na simulação.
- **Identificar os fios com o multímetro** (motor desligado, fios soltos): medir os três pares. O par com a **maior** resistência é ABRE–FECHA (os dois enrolamentos em série); o fio que sobra é o **COMUM**. As outras duas leituras são aproximadamente metade da maior quando os enrolamentos são iguais. Cor de fio varia por fabricante e não deve ser usada sozinha.
- **Capacitor:** usar o valor (µF) e a tensão (VCA) da etiqueta do motor. Antes de manusear, descarregar com segurança.
- **Terra** na carcaça do motor.
- Valores típicos de resistência de enrolamento e de capacitância por potência e tensão: **a confirmar pela frente P** com fontes primárias.

## 5. Modelo de simulação (referência para S3 e P)

### 5.1 Circuito de referência

Modo `quasi-static` (60 Hz, passo mecânico 10 ms):

- `mains` 127 V (variante 220 V) → `fuse` 10 A → `triac` (disparo controlado pelo `mcu`) → contatos de `relay-spdt` K1 e K2 → `ac-motor-1ph-cap` M1 (`w1` = ABRE, `w2` = FECHA, `common` → N) com `capacitor` entre `w1` e `w2`.
- `dc-voltage` 12 V para a lógica (representa a fonte chaveada).
- `mcu` U1 com `params.firmware = "m16/central-generica"`; entradas com pull-up: FCA, FCF, BOT, FOTO, PROG; saídas: bobinas de K1/K2 (via transistor e diodo de roda livre), gate do TRIAC, AUX, TRAVA, LEDs.
- `gate-mechanics` G1 acoplado a M1 (`params.motor = "M1"`): relação de redução, massa do portão, atrito, comprimento do curso, posição dos ímãs, obstáculo (controle), embreagem mecânica.
- `reed-switch` FCA e FCF acoplados à posição de G1; `photocell` com controle "obstáculo no feixe"; `push-button` BOT; `rf-receiver` com controles cadastráveis; `jumper` J1/J2, `dip-switch`, `trimpot` PAUSA/FORÇA.

### 5.2 Máquina de estados do firmware

Estados: `FECHADO`, `ABRINDO`, `ABERTO`, `FECHANDO`, `PARADO`, `ERRO`. "Comando" = pulso em BOT ou botão de controle cadastrado.

| Estado | Evento | Próximo | Ação |
|--------|--------|---------|------|
| FECHADO | comando | ABRINDO | pulso na TRAVA, liga AUX |
| ABRINDO | FCA ativo | ABERTO | desliga motor; inicia PAUSA se J2 |
| ABRINDO | comando | PARADO | lembra último sentido |
| ABRINDO | força acima do limite | PARADO | recua 0,5 s |
| ABERTO | comando, ou PAUSA expirou com feixe livre | FECHANDO | |
| FECHANDO | FCF ativo | FECHADO | desliga motor |
| FECHANDO | comando | ABRINDO | tempo morto 300 ms |
| FECHANDO | feixe interrompido (e J1 ausente) | ABRINDO | tempo morto 300 ms |
| FECHANDO | força acima do limite | ABRINDO | tempo morto 300 ms |
| PARADO | comando | sentido oposto ao último | |
| qualquer movimento | 40 s sem fim de curso | ERRO | desliga motor, LED PROG pisca, buzzer |
| ligado sem posição conhecida | primeiro comando | ABRINDO | |

Regras fixas: K1 e K2 nunca juntos; partida suave pelo TRIAC; DIP INV troca o significado de K1/K2; o firmware é uma função pura de (estado, entradas, tempo) → (estado, saídas), testada isoladamente.

## 6. Modo oficina: trocar motor e central

Conteúdo do `<Workshop id="trocar-motor-portao">`. Cada passo tem explicação curta, imagem/cena 3D e, quando couber, o que medir.

**Antes de comprar**
1. Anotar do motor atual: tensão (127/220 V), potência (CV), tipo de portão, peso e comprimento aproximados do portão, tipo de fim de curso, módulo/passo da cremalheira.
2. Conferir o disjuntor que alimenta o portão e a existência de terra.

**Desmontar**
3. Abrir o portão até uma posição segura e deixá-lo parado; avisar quem mora na casa.
4. Desligar o disjuntor do portão e sinalizar o quadro.
5. Testar o multímetro numa tomada energizada, medir a ausência de tensão entre F, N e ⏚ da central, e testar de novo na tomada.
6. Fotografar a placa de perto e etiquetar cada fio com o nome do borne (fita crepe).
7. Descarregar o capacitor com segurança.
8. Soltar os fios, a central e o motor; liberar o portão pelo desbloqueio e testar se corre livre à mão (se não corre, o problema é mecânico).

**Montar**
9. Fixar o motor novo, alinhar o pinhão com a cremalheira (folga pequena entre dentes, sem o peso do portão sobre o pinhão).
10. Identificar COMUM/ABRE/FECHA do motor novo com o multímetro (seção 4) e conferir com o manual.
11. Ligar terra na carcaça, depois COM, ABRE, FECHA e o capacitor.
12. Ligar o fim de curso (conector FCA/GND/FCF) e posicionar os ímãs nas extremidades.
13. Ligar fotocélula (+12V, GND, FOTO) e alinhar; ligar botoeira (BOT, GND).
14. Configurar J2/PAUSA, DIP, FORÇA no meio do curso.
15. Revisar todas as ligações contra a lista antes de energizar; por último, ligar F e N.

**Testar e ajustar**
16. Travar o desbloqueio, ligar o disjuntor, conferir o LED REDE e os LEDs de fim de curso aproximando um ímã do sensor.
17. Primeiro comando: deve **abrir**. Se fechar, desligar o disjuntor e trocar ABRE ↔ FECHA (ou DIP INV).
18. Conferir que para nos dois fins de curso; ajustar a posição dos ímãs.
19. Ajustar FORÇA para o mínimo que move o portão com folga; ajustar PAUSA.
20. Cadastrar os controles (PROG).
21. Testar a segurança: interromper o feixe durante o fechamento (deve reverter); segurar o portão com um objeto macio durante o fechamento (deve reverter); testar o desbloqueio manual.
22. Fechar as tampas e guardar o manual e a foto das ligações.

## 7. Cenários de defeito (aula 16.9 e bancada)

| Sintoma | Causa | Como o aluno descobre na simulação |
|---------|-------|------------------------------------|
| Motor zumbe e não gira; com um empurrão, gira | Capacitor aberto ou fraco | Leitura de capacitância no multímetro 3D; som de zumbido |
| Nada funciona, LED REDE apagado | Sem rede ou fusível queimado | Tensão na entrada; continuidade do fusível |
| Primeiro comando fecha em vez de abrir | ABRE e FECHA invertidos | Observar o sentido; trocar fios ou DIP INV |
| Não para no fim, para sozinho após 40 s | Reed com defeito, ímã fora do lugar ou conector invertido | LEDs FCA/FCF ao aproximar o ímã |
| Abre mas não fecha | Fotocélula desalinhada ou entrada FOTO aberta sem fotocélula | LED FOTO; medir o contato |
| Para ou reverte sozinho no meio | FORÇA baixa demais ou atrito no trilho | Ajustar trimpot; inspecionar trilho |
| Controle só funciona de perto | Bateria do controle fraca ou antena solta | Tensão da bateria; antena na cena |
| Portão abre sozinho ou não para | Contato de relé colado | Som do relé; tensão em ABRE/FECHA com motor parado |
| Motor esquenta e desliga, volta depois | Protetor térmico (uso excessivo, capacitor errado, atrito) | Temperatura do motor na simulação |
| Disjuntor desarma ao acionar | Capacitor em curto ou ligação errada do comum | Medir resistências com tudo desligado |
| Motor gira e o portão não anda | Desbloqueio aberto, embreagem patinando ou pinhão gasto | Inspeção na cena 3D |

## 8. Do genérico para as centrais reais

A frente P completa esta tabela com manuais públicos. Primeiros dados levantados no planejamento:

| | Central genérica (curso) | Intelbras CP-1000 | Nice CT30A |
|---|---|---|---|
| Rede | `F` `N` `⏚` | `F`, `N`, terra | `F`, `F/N`, terra |
| Motor | `COM` `ABRE` `FECHA` | `C`, `A`, `F` (o mesmo `F` da fase, atenção) | `CM` (preto), `AB`, `FC` |
| Capacitor | `CAP` `CAP` | `CAP` | nos fios de `AB` e `FC` |
| Fim de curso | `FCA` `GND` `FCF` (reed) | `FCA`, `FCF` (reed, 3–5 fios, conector CN13) | `FCF` `GND` `FCA` (reed) |
| Fotocélula | `FOTO` (NF), `+12V`, `GND` | `Foto` (NA), `+12 V`, `GND` | `GND`, `+12V`, TX/RX |
| Botoeira | `BOT` `GND` | `BotA`, `BotF`, `GND` | `N.A.` |
| Ajustes | J1 FOTO, J2 AUT, DIP INV/LUZ, PAUSA, FORÇA, PROG | Menu com 4 teclas e LEDs (sem trimpots) | Trimpots PAUSA, FORÇA, DESACEL; jumpers MAN/AUT, CONF; PROG |
| Inverter sentido | Trocar ABRE/FECHA ou DIP INV | Trocar os fios de abertura e fechamento | Inverter os fios de abre e fecha |
| Sem fotocélula | J1 (explicar e desaconselhar) | Manual não prevê | Manual diz que a fotocélula é obrigatória |

Fontes consultadas no planejamento:

- [Intelbras, manual da central CP-1000 (versões acima de 3.5.x)](https://backend.intelbras.com/sites/default/files/2026-08/Manual%20de%20Usu%C3%A1rio%20e%20Programa%C3%A7%C3%A3o%20Central%20Padr%C3%A3o%20Automatizador%20Port%C3%A3o%20CP-1000%20-%20Vers%C3%B5es%20Acima%20de%203.5.x%2008-26_0.pdf)
- [Nice, manual da central CT30A](https://niceforyou.com/sites/default/files/upload/manuals/30010120-MANUAL-INST-CENTRAL-CT30A-OMS-Rev-00.pdf)
