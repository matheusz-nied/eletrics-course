# Pesquisa: centrais de portão eletrônico e motores (manuais públicos brasileiros)

Data da pesquisa: 17/10/2026. Pesquisador: subagente de pesquisa (Claude).

## Como ler este documento

- **Fonte:** cada fato traz a URL do manual e, quando possível, a página ("p.") ou o rodapé ("Pag.") do PDF.
- **Método de leitura:** o download direto dos PDFs (curl) foi bloqueado pelo proxy desta sessão (HTTP 403 para todos os domínios de fabricante). Os PDFs foram lidos pela ferramenta WebFetch, que converte o PDF em texto e responde a perguntas sobre ele. Consequências:
  - Citações entre aspas foram pedidas literalmente à ferramenta, mas ela limita o tamanho de cada citação. Trate as aspas como "texto do manual, possivelmente encurtado".
  - Os números de página são **inferidos** dos rodapés do texto extraído e podem estar deslocados em 1.
  - Rótulos que só existem em desenhos (serigrafia na foto da placa) às vezes não aparecem no texto extraído. Nesses casos está escrito "não consta no texto extraído".
- **(não confirmado)** marca o que a fonte não deixa claro ou o que veio de fonte não oficial.
- "não consta" significa que o manual lido não traz a informação.
- Dois PDFs da lista inicial **não puderam ser lidos** (bloqueio por robots.txt na ferramenta): PPA Triflex Full Range Display REV5 (`mediah.ppa.com.br`) e Garen Central Universal (`garen.com.br/wp-content/uploads/2023/12/...`). Foram usados manuais substitutos da mesma marca.

## Achado geral importante para o curso

Existem **dois tipos de central** no mercado brasileiro, e o curso precisa distinguir:

1. **Central para motor de indução monofásico com capacitor** (o caso clássico do portão residencial): três fios de motor (comum, abre, fecha) e dois bornes de capacitor. Exemplos: Intelbras CP-1000, Peccinin/Nice CP 4010F/4020F, Nice Pro S10, Omegasat CT30A, Rossi KXH1024FS, Garen Wave Connect, PPA Facility Connect.
2. **Central inversora (inversor de frequência)** para motores "trifásicos" de alta rotação vendidos como "Jetflex", "TSi", "Full Range": três fios U/V/W **sem capacitor**, velocidade ajustada em Hz. Exemplos: Garen TSi Pro, PPA Triflex Full Range. **Trocar o motor de um sistema pelo do outro não funciona sem trocar a central.** A Garen manda remover o capacitor quando se usa motor monofásico na TSi Pro (ver seção da TSi Pro).

Detalhe que confunde: a Rossi KXH1024FS também usa os nomes **U, V, W** nos bornes, mas para motor monofásico com capacitor (U = comum).

---

## 1. Intelbras CP-1000 / CP-1001 (firmware ≥ 3.5.x)

Fonte: https://backend.intelbras.com/sites/default/files/2026-08/Manual%20de%20Usu%C3%A1rio%20e%20Programa%C3%A7%C3%A3o%20Central%20Padr%C3%A3o%20Automatizador%20Port%C3%A3o%20CP-1000%20-%20Vers%C3%B5es%20Acima%20de%203.5.x%2008-26_0.pdf
Título na capa: "Manual do usuário" / "Central eletrônica para automatizadores de portões" (CP-1000 e CP-1001). "Este manual do usuário é valido para as centrais com versões de firmware maior ou igual a 3.5.x." Números de página não visíveis no texto extraído; cito as seções (§).

Existe também a versão do manual para firmware 3.2.10 e 3.3.2 (mesmo site, URL na lista final), não lida.

**1. Rede**
- Bornes (§2, lista de terminais): "F: fase da rede AC (127 Vca ou 220 Vca) conforme a tensão do motor;" / "Terra: aterramento da rede AC;" / "N: neutro da rede AC;"
- Alimentação da central: "100-240 Vca / 1,5 W" (§1). Fonte chaveada automática (§3.1), sem seletor de tensão.
- Frequência da rede: "50 Hz ou 60 Hz (Autoconfigurada)" (§1).
- Observação para o curso: como o motor recebe a tensão da rede pela central, o borne F deve receber a tensão **do motor** (127 ou 220 V).

**2. Motor e capacitor**
- "C: fio comum do motor AC;" / "A: fio da bobina do motor no sentido de abertura do portão;" / "F: fio da bobina do motor no sentido de fechamento do portão;" / "CAP – Ligação do capacitor do motor;" (§2).
- Note que **"F" aparece duas vezes** no manual: fase da rede e fechamento do motor (bornes diferentes). Ponto de atenção didático.
- Cores (diagrama §3.1, motores Intelbras): comum "Amarelo"; fechamento "Preto ou Azul"; abertura "Azul ou Preto".
- Capacitor: ligar os dois fios do capacitor nos bornes CAP e conferir o valor no motor (§3.1).
- Inverter sentido (§3.1): "se enviar o comando de abertura e o portão fechar, inverta os fios preto e azul nos conectores de Abertura e Fechamento."
- Potência máxima do motor: até 1/2 cv (§1).

**3. Fim de curso**
- Reed (rótulo "REED" no diagrama, §3.2). Bornes "FCF: entrada do sensor de fim de curso de fechamento;" e "FCA: entrada do sensor de fim de curso de abertura;" (§2).
- Conector "CN13", pinos 1 a 5 (§3.2): "Para padrão 3 fios, use os pinos 2, 3 e 4. Para padrão 4 fios, use os pinos 2, 3, 4 e 5." / "Obs.: para padrão 5 fios, o pino central (3) ficará desconectado."
- NA/NF do reed: não consta no texto extraído.

**4. Fotocélula**
- "Foto: entrada da fotocélula / sensor de barreira;" e "GND – Saída do comum da fonte auxiliar e sensores;" (§2). Diagrama "CH5" (§3.3).
- Tipo de entrada: tabela de especificações: "Entrada do sensor de barreira 1 entrada NA" (§1).
- Alimentação: "+12 V – Saída da tensão da fonte auxiliar de 12 Vcc / 300 mA;" (§2). O manual pede: "verifique se a tensão e corrente da fotocélula é compatível com a fonte auxiliar da central."
- Comportamento: o sensor de barreira impede o fechamento automático enquanto houver obstrução (§4.3).
- Uso sem fotocélula / jumper de bypass / obrigatoriedade: **não consta** neste manual da central. (O manual do motor deslizante Intelbras diz que é obrigatória; ver seção Motores.)

**5. Botoeira**
- "BotA: entrada da botoeira de abertura;" / "GND: comum das botoeiras;" / "BotF: entrada da botoeira de fechamento;" (§2). Duas entradas NA independentes (§1).
- Modos (menu "Bot", §4.3): "Dupla", "Simples", "Predial/Simples", "Predial/Pedestre".

**6. Ajustes (sem trimpot nem DIP; 4 teclas e menu com LEDs)**
- Teclas: "4 teclas Tact"; o texto cita "Esc" e "Ok" (as setas não aparecem como texto).
- LEDs: "LED1 (CR)", "LED11 - PERC", "LED RX"; LD1 a LD12 (por exemplo LD1 "Normal", LD5 "Cadeado", LD6 "Auxiliar 1", LD8 "Mestre", LD9 "Apaga").
- Menus (§4.3/§5): "Emb" (embreagem): Desligado a 9, depois Máx; "Ace" (aceleração): Desligado, 1 a 10, Máx; "Desa" (desaceleração): Desligado, 1 a 10, Máx; "Freio": Desligado, 1 a 10, Máx; "Pausa": Desligado, 2 s a 120 s; "Modo Seguidora": Desligado, 2 s a 22 s (passos de 2 s); "Aux1"/"Aux2": modos de saída, com opções temporizadas de 30 s a 180 s; "Perc" (aprendizado de percurso); "Res" (reset); "Rádio"; "CR"; "Bot".
- Embreagem: "A programação da embreagem define inversamente a força que será aplicada ao motor, sendo quanto menor o valor da embreagem, maior a força aplicada ao motor." Não existe menu chamado "força".

**7. Controles remotos**
- Cadastro rápido (§4.3, "EP 02"): pressionar "Esc" uma vez (LED1 CR pisca), pressionar "Ok" rapidamente (LED1 fica aceso), apertar o botão do controle; bipe de confirmação.
- Funções especiais (escolhidas com as setas antes de apertar o controle): Normal, Pedestre, Abre, Fecha, Cadeado, Aux1, Aux2, Mestre, Apaga.
- Apagar um controle: opção "Apaga" (LD9).
- Apagar tudo (controles e configurações), menu "Res": "Esc" uma vez e mais 11 vezes até "Reset", segurar "Ok" por 3 s; depois desligar a central por 5 s (§4.3). (Sequência resumida pela ferramenta; não confirmado palavra por palavra.)
- Memória: "Quantidade de controles 800 botões" (§1).
- RF: 433,92 MHz (§1). Protocolos: "Protocolo do controle FSK – criptografia AES 128 bits Intelbras" e "OOK – code learning – código aberto" (§1).
- Antena: não consta.

**8. Obstáculo / tempo de percurso**
- "Dupla embreagem" (sem explicação). Sobre obstáculo: "caso algo obstrua o portão, o mesmo não tenha força suficiente para causar danos ou lesões." Encoder ou medição de corrente: não consta.
- Tempo limite (menu Aux "Alarme", §4.3): "O portão ficar acionado e não chegar ao final do curso por um tempo maior que 4× o percurso calculado." A tabela de falhas do ST100 (§6.1) lista "Limite tempo percurso".
- Após movimento manual detectado, o próximo ciclo é lento (§4.2).

**9. Fusível:** "Fusível 10A, 5 × 20 mm, vidro" (§1).

**10. Saídas**
- "AUX1"/"AUX2: saída auxiliar ... do tipo relé de contato seco: NA (Normalmente Aberto), NF (Normalmente Fechado) e C (Comum)"; "PGM1"/"PGM2: saída auxiliar ... do tipo PGM". No CP-1000, PGM1/PGM2 exigem a placa "CA-1000" (§3.4).
- Modos: Desligado, Aberto, Fechado, Movimento, Fechadura, Alarme e temporizados (§4.3).
- Cargas externas precisam de fonte própria (exemplo do manual: sinaleira e fechadura elétrica 12 V) (§3.4). Capacidade dos contatos: não consta.

**11. Normas:** nenhuma NBR citada. Só "Produto beneficiado pela Legislação de Informática".

**Outros:** temperatura de operação "0 ... 50 ºC"; dimensões "100 × 116 × 24 mm" (§1).

---

## 2. Nice (Peccinin) CP 4010F / CP 4020F

Fonte: https://niceforyou.com/sites/default/files/upload/manuals/30004081-MANUAL-DE-CONFIGURACAO-CP4010F-4020F-Rev-06.pdf
Título: "Configurando a Central / Configurando la Central", modelos CP 4010F e CP 4020F, código 30004081, REV 06. Marca no texto: Peccinin; contracapa com "www.nice.com.br" (p. 75). CP 4020F controla dois motores (bornes C2/A2/F2). Bilíngue (PT/ES).

**1. Rede**
- "Conecte o terra no borne com o símbolo" e a energia nos bornes "F" (fase) e "F/N" (fase/neutro) (p. 9). Aviso: "Não conecte o terra ao GND." (p. 10).
- Alimentação: 90 a 240 VAC (p. 37); fonte chaveada automática 127/220 V (p. 9); detecção automática de 50/60 Hz (p. 10).

**2. Motor e capacitor**
- "C1 = Comum do motor", "A1 = Abre motor", "F1 = Fecha motor" (p. 8). CP 4020F: também "C2", "A2", "F2".
- "O capacitor deve ser conectado aos fios marrom e branco" (p. 6). Fios do motor no desenho: preto, marrom e branco (o preto é o comum, pela lógica do desenho; não confirmado no texto).
- Inverter: "caso o portão feche ao invés de abrir, inverta os fios no borne de abre e fecha." (p. 9).
- Motor: indução monofásico até 1/2 cv (370 W), corrente máxima 4 A (p. 38).

**3. Fim de curso**
- Reed magnético; conector "FCA1 | GND | FCF1" (3 vias) (p. 17).
- "só aceita fim de curso do tipo N.A. normalmente aberto" (p. 17).
- "Se o fim de curso for instalado invertido basta inverter o conector na central." (p. 18).

**4. Fotocélula**
- "FTC = Fotocélula", "+12V = + 12 Vcc", "GND = Comum para BOT, FTC e +12Vcc" (p. 8). Esquema mostra "N.A.", "12VCC", "RX TX", "GND" (p. 34).
- Entrada: 1 NA com LED (p. 38). Saída auxiliar 12 VCC, máximo 700 mA (p. 33 e p. 38). Cabo mínimo 0,5 mm² (p. 33).
- "O uso de fotocélula como dispositivo de segurança é obrigatório!" (p. 34).
- Operação sem fotocélula / jumper de bypass: não consta. (Inferência técnica, **não confirmado no manual**: como a entrada é NA, a central não exige nada ligado ali para funcionar; isso não muda a obrigatoriedade declarada.)

**5. Botoeira:** "BOT" e "GND" (p. 8); 1 entrada NA (p. 38); abre/para/fecha (p. 35).

**6. Jumpers, trimpots, botão**
- Jumper "C": modo de configuração; remover depois, pois com ele a central não responde a comandos (p. 12, p. 20).
- Jumpers "A" e "B": modo da função auxiliar (p. 35); "A" é necessário para sinaleira temporizada (p. 31).
- Jumper "MAN/AUTO": desabilita fechamento automático (p. 29).
- Trimpots: "EMBR." (embreagem eletrônica, p. 18); "DESACEL" (p. 25); "RETARDO" (só CP 4020F, até 13 s, p. 28); "FCH.AUTO" (0 a 120 s, zero desabilita, p. 29); "DIST..FREN" (distância de frenagem; ajuste não detalhado no texto extraído).
- Menu por número de toques no botão "LEARN" com jumper em "C": Soft Closing 1 = 1/2 da velocidade, 2 = 1/3 (portões leves), 3 = desabilita (p. 19); Freio 4 = fraco, 5 = médio, 6 = forte, 7 = desabilita (p. 21); Condomínio 8/9 (p. 22–23); Fechamento por fotocélula 10/11 (p. 24); Parada suave 12/13 (p. 24); Sinaleira temporizada 14/15 (p. 32); apagar percurso: 3 toques (p. 20).

**7. Controles remotos**
- Gravar: retirar jumper "C"; pressionar "LEARN" uma vez (LED pisca 1 vez = função normal); 1 = normal (abre/para/fecha), 2 = só abre, 3 = só fecha; pressionar o botão do controle e confirmar com o mesmo botão (um botão) ou com outro (dois botões) (p. 12–15). "Você pode gravar até dois botões por controle remoto" (p. 12).
- Apagar todos: "Pressionar e manter pressionado o botão LEARN até que o LED pisque rapidamente e solte." (p. 16).
- Memória: "Memória para até 250 controles remotos Peccinin" (p. 5); "250 controles - 2 botões" (p. 38).
- RF: 433,92 MHz, modulação OOK, 2,5 Kbps (p. 3 e p. 38). Código: "Codificação Rolling Code Peccinin" (anticlonagem) (p. 3, p. 38).
- Antena: whip de 17 cm (p. 38).

**8. Obstáculo / tempo limite**
- Embreagem eletrônica: deve ser ajustada para que o motor "não tenha torque suficiente para causar lesões sérias à uma pessoa em contato com o portão." (p. 17). "Coloque o trimpot em sua posição máxima e em seguida acione o controle remoto" (p. 18). Encoder ou sensor de corrente: não consta.
- Tempo limite: após o Soft Closing, a central espera o fim de curso; se o tempo estourar, desliga o motor (p. 27). Valor: não consta.

**9. Fusível:** "Fusível de proteção 5A - vidro 20mm" (p. 38).

**10. Saídas**
- Relé auxiliar "NA", "C", "NF" (p. 8, p. 38). Lâmpada até 300 W/220 VCA ou 180 W/127 VCA (p. 35).
- Modos (p. 35–36): luz de cortesia (120 s); sinaleira (portão aberto); fechadura magnética (2 s no início da abertura); trava eletromagnética (2 s no início da abertura e no início da desaceleração ao fechar).
- Sinaleira temporizada: 15 s antes de abrir, "conforme a Lei 01-00190/2017" (p. 31) (lei citada pelo manual; não verificado de que ente é).
- "AUX": somente contato, sem tensão (p. 36). Módulo externo "MD-T01 / MD-T02" (p. 38).

**11. Normas:** nenhuma NBR. Só a lei da sinaleira acima.

**Outros (p. 38):** consumo sem motor 25 mA; temperatura -10 a 80 °C; 20 × 100 × 100 mm; 80 g.

---

## 3. Nice Pro S10 (Rev.03, 11/08/2026)

Fonte: https://www.niceforyou.com/sites/default/files/2026-08/MANUAL-COMPLETO-CENTRAL-NICE-PRO-S10-110826.pdf (versão anterior: https://www.niceforyou.com/sites/default/files/2025-12/MANUAL-COMPLETO-CENTRAL-NICE-PRO-S10.pdf). Sem números de página no texto extraído; cito os tópicos do manual.

**1. Rede:** bornes "TERRA" e "ALIMENTAÇÃO DA CENTRAL (127v ou 220v)"; fase/neutro não identificados separadamente. Fonte chaveada automática 90 a 240 VCA; 50/60 Hz automático (Tópicos 1 e 9). Recomenda ligar o terra para proteção contra surtos.

**2. Motor:** bornes "COMUM", "ABRE", "FECHA"; dois bornes "CAPACITOR" (Tópicos 2 e 5). Inverter: se fechar no primeiro comando, inverter os fios nos bornes "ABRE" e "FECHA". Cores: não consta.

**3. Fim de curso:** reed, com LEDs; "conector do fim-de-curso" (chicote). Somente N.A., não aceita N.F. Inversão por menu: PERCURSO, Config 4, "INVERTER FIM-DE-CURSO" (Tópico 6). Encoder: "NÃO DISPONÍVEL".

**4. Fotocélula:** bornes "+12V/GND/N.A." (RX) e "+12V/GND" (TX). Padrão N.A.; N.F. selecionável em BOTÕES, Config 3, "FOTOCÉLULA (NA / NF)". Alimentação 12 Vcc até 700 mA. Cabo mínimo 0,5 mm². Uso declarado obrigatório; fotocélula vendida separadamente. Sem fotocélula / bypass: não consta (Tópicos 10 e 18).

**5. Botoeira:** entradas "A" e "B", cada uma configurável (BOTÕES, Config 1 e 2) (Tópico 11).

**6. Ajustes:** sem trimpot e sem DIP; grupos de jumper SISTEMA, MOTOR, OPER, RELÉ, PERCURSO, BOTÕES, cada um com Config 1 a 5, mais botão "LEARN" e LEDs. Força (embreagem eletrônica, MOTOR Config 2): 50 %, 65 %, 80 %, 90 % ou 100 %. Pausa (OPER Config 3): OFF / 3 s a 60 s em cinco níveis. Desaceleração na abertura (MOTOR Config 3) e no fechamento (MOTOR Config 4). Freio (MOTOR Config 5). Soft start (MOTOR Config 1). Modo ABRE-PARA-FECHA ou ABRE-PARA-FECHA-PARA (padrão). Atraso de fechamento pela fotocélula 1 a 5 s (OPER Config 5). Tipo de desaceleração CP4000, i-Track 2 (20 Hz) ou i-Track 1 (30 Hz) (PERCURSO Config 1). Abertura parcial 10 % a 50 %.

**7. Controles:** gravar: retirar os jumpers das duas primeiras fileiras, pressionar "LEARN" uma vez, apertar o botão do controle, apertar o mesmo ou outro botão. Apagar todos: mesmos jumpers retirados, segurar "LEARN" 3 s. Até 250 controles. RF e tipo de código: não consta neste manual. Antena: borne "GND E ANTENA".

**8. Obstáculo / tempo:** "time-out" de 90 s: se o fim de curso não for identificado, desliga o motor. Detecção de obstáculo específica: não consta (só embreagem eletrônica). "TAMPER DO MOTOR" habilitável (PERCURSO Config 5).

**9. Fusível:** aparece no diagrama; valor não consta.

**10. Saídas:** relé auxiliar "NA", "COM", "NF"; modos Semáforo, Fechadura Magnética, Trava Eletromagnética, Sinaleira, Luz de cortesia; tempo 0 a 120 s. Conector "CONECTOR P/ MÓDULO MR01". Capacidade dos contatos: não consta.

**11. Normas:** nenhuma NBR.

---

## 4. Omegasat CT30A (hospedado no site da Nice)

Fonte: https://niceforyou.com/sites/default/files/upload/manuals/30010120-MANUAL-INST-CENTRAL-CT30A-OMS-Rev-00.pdf
Capa: "MANUAL CENTRAL CT30A". A marca no texto é **Omegasat** (garantia na p. 12 e site www.omegasat.com.br), não Nice nem Peccinin. "OMS" no nome do arquivo = Omegasat. Bilíngue PT/ES.

**1. Rede:** "Conecte o terra no borne com o símbolo e ligue a energia da central através dos bornes "F" (fase) e "F/N" (fase/neutro)." (p. 05). Fonte chaveada 90 VCA a 240 VCA (p. 03), sem seleção.

**2. Motor:** "o fio PRETO (Comum), deve ser ligado no borne "CM"." (p. 04). "O capacitor deve ser ligado nos fios conectados aos bornes "AB" e "FC"." Inverter: "caso o portão feche ao invés de abrir, inverta os fios no borne de abre e fecha." (p. 05). Motor 1/3 CV, corrente nominal 4 A (p. 11–12).

**3. Fim de curso:** sensor magnético REED; conector "FCF | GND | FCA" (3 vias) (p. 06–07). "O FCA é acionado quando o portão está aberto." / "O FCF é acionado quando o portão está fechado." Se invertido, inverter o conector.

**4. Fotocélula:** bornes "GND", "+12V", "N.A." (p. 10). 12 Vcc, máx. 500 mA. "A central pode alimentar fotocélulas da linha Home Line ou Pro Line." "O uso de fotocélula como dispositivo de segurança é obrigatório!" (p. 10). Cabo mín. 0,5 mm². Sem fotocélula / bypass: não consta.

**5. Botoeira:** "Ligação da botoeira (tipo NA sem retenção)" (p. 10); nomes de bornes não constam no texto extraído.

**6. Ajustes:** trimpots "FORÇA" ("A embreagem eletrônica deve ser ajustada através do trimpot FORÇA.", p. 04/07), "PAUSA" ("valor máximo = 120 segundos", p. 08), "DESACEL" (começar no máximo e reduzir, p. 08). Jumpers "MOD" (função não descrita), "MAN/AUT" (fechado desativa fechamento automático, p. 08), "CONF" (configurar rampa, p. 11: com CONF fechado, 1 toque em PROG desativa a rampa, 2 toques ativam).

**7. Controles:** "Utilizando um transmissor Learning Code (tipo comum do mercado), pressione o botão PROG da central." Depois apertar o botão do transmissor (LED pisca) e o mesmo botão de novo (LED apaga) (p. 06). Apagar tudo: segurar "PROG" até o LED apagar. "Memória para até 39 botões de transmissores tipo learning code;" (p. 03). RF 433,92 MHz.

**8. Obstáculo / tempo:** embreagem eletrônica pelo trimpot FORÇA. Tempo limite: "a central iniciará um timer de 40 segundos" a partir do início do movimento; sem fim de curso, desliga o motor (p. 09).

**9. Fusível:** "Fusível de proteção" (p. 04), valor não consta.

**10. Saídas:** só 12 Vcc / 500 mA. Trava, luz, sinaleira: não consta.

**11. Normas:** nenhuma.

**Outros (p. 11–12):** potência total 245 W; corrente de trabalho 80 mA; -10 a 80 °C.

---

## 5. Rossi Bi KXH1024FS FAIL SAFE

Fonte: https://www.rossiportoes.com.br/upload/arquivos/Central%20BIKXH_1024%20Rev.F%20-%20PT.pdf
Capa: "FUNÇÃO Bi KXH1024FS FAIL SAFE Manual de instalação" (Rev. F). O manual tem 4 páginas, com rodapés "Pag.01" a "Pag.04".

**1. Rede**
- Bornes "F" (fase) e "N" ("Neutro/Fase 2") (Pag.01). Borne de terra: não consta como borne na placa; o manual exige aterramento do equipamento.
- Fonte automática 90 a 240 VAC; sem seleção. Proteção: disjuntor bipolar de 10 A na entrada; interruptor bipolar com abertura mínima de contatos de 3 mm; cabo mínimo 2,5 mm² (seção de segurança, Pag.04).

**2. Motor e capacitor**
- "U – Fios do Motor (U = Comum, fio amarelo)" e "As saídas V e W determinam o sentido de rotação do motor" (Pag.01). (O manual do motor DZ diz para conferir a etiqueta do motor: "O comum (conferir etiqueta no motor) normalmente o de cor amarela deve ser conectado na saída U.")
- Capacitor: borne "CAP". "Capacitor de acordo com a potência do motor, os fios não possuem polaridade." (Pag.01).
- Inverter: "Inverter a posição dos fios V e W" (Pag.04, Soluções); tabela de falhas: "Os fios V e W estão invertidos" (Pag.03). Teste sugerido: portão no meio do curso; o LED FF ou FA indica o sentido.
- Potência máxima do motor: 520 W.

**3. Fim de curso**
- Reed (contato) **ou** sensor Hall, detectados automaticamente; o Hall exige o ímã próprio.
- Bornes "FA", "FF" e "CM" (comum), 3 fios para o reed. LEDs: "FA – Led Verde Indicador de portão Aberto", "FF – Led Vermelho Indicador de portão Fechado", "ST – Led Indicador de Eventos" (Pag.01).

**4. Fotocélula (ponto forte deste manual)**
- Fechamento: "FOTOCÉLULA – Entrada Fotocélula de fechamento – RX" e "TX(-) – Negativo da Fotocélula FS" (Pag.01).
- Função FAIL SAFE: "Fotocélula função FAIL SAFE. (Dip 6 deixar em ON)"; com FS: "A fotocélula deve ser ligada em modo Normalmente Fechado (NF)"; sem FS (DIP-6 OFF): "deve ser ligada em modo Normalmente Aberto (NA)" (Pag.02).
- Fotocélula de abertura: entrada "FTA" com "GND", NA; só atua no comando de abertura, não reverte.
- Alimentação: "12V – Saída 12VDC -300mA (para acessórios ROSSI)" (Pag.01), comum "GND".
- Obrigatoriedade: "É obrigatório o uso do sensor infravermelho Ativo - SIA 30 FS" (Pag.04), para o sistema anti-aprisionamento; certificação só vale com ele.
- Sem fotocélula: com FS habilitada e sensor mal instalado, o sistema não opera: "Função FS habilitada e fotocélula SIA 30FS não instalada corretamente" (tabela de falhas, Pag.03). Jumper de bypass: não consta. Durante o SETUP a fotocélula fica inoperante.
- Explicação útil para o curso (inferência do pesquisador, não está escrita no manual): **fail safe** = a central consegue testar a fotocélula, porque alimenta o negativo do transmissor pelo borne "TX(-)"; com contato NF, um fio partido é lido como obstáculo, e não como "caminho livre".

**5. Botoeira:** "BOT_A" (abertura), comum "CM" ou "GND" (o manual cita os dois); "BOT_F" (fechamento), comum "GND". Botão de pulso (tipo campainha).

**6. Ajustes**
- DIP (ON habilita): DIP-1 PREDIAL/RESIDENCIAL (ON = predial); DIP-2 PAUSA (fechamento automático); DIP-3 FECHADURA; DIP-4 LV/PS (ON = portão pesado); DIP-5 DZ/BV (ON = basculante); DIP-6 FS (fail safe).
- Trimpots: "ACEL." (aceleração), "DESAC." (desaceleração), "VL.AB" (velocidade de abertura), "VL.FC" (velocidade de fechamento). Faixas: não constam.
- Pausa programável de 1 s até 12 h: "Cada piscada indica 1 segundo decorrido até 12h" (Pag.02).
- Menu AJUSTES por número de toques: 1x, 2x, 3x ("Desabilita o modo de auto-reverso no modo residencial"), 4x ("Habilita o modo de auto-reverso do fechamento no modo residencial"), 9x (reset de fábrica sem apagar controles) (Pag.02).

**7. Controles**
- Gravar: pressionar e soltar "APRENDER"; com o LED ST aceso, apertar o botão do controle; o LED pisca e apaga.
- Apagar um botão: segurar "APRENDER" e apertar o botão do controle; "Esta operação não pode passar o tempo máximo de 5 segundos" (Pag.03).
- Apagar tudo: segurar "APRENDER" até o LED ST apagar.
- Memória: "Memória interna para 1024 botões removível" (Pag.01) (CI de memória removível).
- RF 433 MHz; código HCS com proteção anticlonagem (o termo "rolling code" não aparece).
- Antena: borne "ANT" (fio) e "GND" (malha): "conecte a parte decapada do fio de 16cm no borne" (Pag.02); para mais alcance, cabo coaxial.

**8. Obstáculo / tempo:** "Embreagem eletrônica automática" e "Função auto reverso" (Pag.01), sem descrição do princípio. Proteção térmica: "caso alcance uma temperatura superior a 80°" (Pag.03). Tempo máximo de motor ligado: não consta.

**9. Fusível:** não consta na placa; proteção indicada é o disjuntor bipolar externo de 10 A.

**10. Saídas:** "LUZ SIN" (sinaleira / luz de garagem) com GND; "FCH" (placa de fechadura, com DIP-3); 12 V / 300 mA. Correntes: não constam.

**11. Normas:** "NBR 5410:1997 - ABNT- Associação Brasileira de Normas Técnicas." (Pag.04), no contexto da instalação elétrica. A garantia cita a Lei 8078/90 (Código de Defesa do Consumidor).

---

## 6. Garen Wave Connect (central para motor monofásico com capacitor)

Fonte: https://docs.garen.com.br/manuais/MANUAL_CENTRAL_WAVE_CONNECT.pdf (rodapé "Manual - Central Wave Connect N"). Versão livreto PT/ES rev01 (não lida, bloqueio por robots): https://garen.com.br/wp-content/uploads/2023/12/Manual_livreto-CENTRAL_WAVE_CONNECT_portugues_espanhol_rev01.pdf
Pela tabela do manual do motor KDZ (seção Motores), a Wave Connect acompanha os motores KDZ 1/3 e 1/2 com capacitor.

**1. Rede:** "1. REDE – Entrada de alimentação 127/220 V;" (p. 3). Fase/neutro/terra e seletor: não constam no texto extraído. "14.Fonte de alimentação 15V/1A;".

**2. Motor:** "2. BR/AZ/PT - MOTOR - Fios do motor;" e "3. CAP/CAP – Entrada para capacitor do motor;" (p. 3). Inverter: "Para inverter o sentido inverta o conector do fim de curso e altere as posições entre os fios PT e BR do motor." (p. 10). As siglas parecem ser branco/azul/preto, e, como a inversão troca PT e BR, o **comum seria AZ** — (não confirmado: o manual não define as cores nem o comum).

**3. Fim de curso:** "9. Fim de Curso - FCA/FCF – Conectores 3 e 5 vias para o Fim de curso de abertura e fechamento do motor;" (p. 3). LED FCF vermelho (fechado), FCA verde (aberto) (p. 10). Tipo: o manual do motor KDZ diz ímã + sensor REED.

**4. Fotocélula:** "10.Entrada para fotocélula – Dispositivo de segurança;" (p. 3), conector polarizado. Jumper JP1: "Com o jumper aberto, utiliza-se a fotocélula normal, com sinal negativo." Fechado = fotocélula PWM Garen (p. 10). Alimentação: "13.Saída 12V – Alimentação de periféricos (fotocélula, receptor etc.);" — corrente máxima não consta. Comportamento: com o portão aberto e feixe interrompido, o fechamento é bloqueado; durante o fechamento, para e reverte "independente do estado da função reversão (REV)" (p. 10). Obrigatoriedade: não consta neste manual (consta no manual do motor KDZ). Bypass: não consta.

**5. Botoeira:** "5. BOT/GND/BTA/BTF – Entrada de botoeira: BOT (abre/para/fecha);" (p. 3). Com jumper FCD fechado, BTA abre totalmente e BTF fecha (p. 9).

**6. Ajustes (jumpers + botões "TX (-)" e "CURSO (+)"; sem trimpot nem DIP)**
- PAUSA: 0 a 120 s em passos de 5 s, padrão 0. FORÇA: "Ajuste de 0 (5%) a 20 (100%)"; "São 20 níveis de força de 5% a 100%." padrão 20. FREIO: 0 a 20, padrão 5. RAMPA AB e RAMPA FC: 0 a 20, padrão 7 (p. 7–8).
- BV/DZ (basculante/deslizante), REV (reversão), FCD (condomínio/laço), R.AX (modo do relé auxiliar), JP1 (fotocélula) (p. 8–10).
- Com jumpers de PAUSA, FORÇA, FREIO, RAMPA AB ou RAMPA FC fechados, o motor não funciona (p. 11).
- O percurso é aprendido em "Programação do Tempo de Abertura /Fechamento" (p. 6).

**7. Controles:** "Pressione e solte o botão TX (-) da central. O LED piscará 3x e permanecerá aceso." Apertar o botão do controle; "Enquanto o LED está piscando, pressione novamente o botão TX (-) da central para confirmar o cadastro." (p. 4). Sai após 10 s ou com TX (-). Apagar tudo: "Pressione novamente e mantenha pressionado o botão TX (-) da central por 5 segundos até que o LED" pisque rápido; LED aceso = memória apagada (p. 5). Memória: até 512 botões/controles internos (p. 3). RF 433,92 MHz (p. 3). Código: não consta. "7. Antena;" (p. 3), sem detalhes.

**8. Obstáculo / tempo:** só a reversão pela fotocélula é descrita. Embreagem eletrônica, encoder, corrente, tempo limite: não constam.

**9. Fusível:** "15.Fusível de proteção – 5A;" (p. 3).

**10. Saídas:** relé "R.AX", contato NA: trava magnética ou luz de garagem/sinaleiro, temporização de 60 s (p. 9). "11. Entrada OP.8F – Módulo opcional 8 funções (Trava, Luz de garagem, Sinaleiro e alarme);" (p. 3). Capacidade: não consta.

**11. Normas:** nenhuma.

---

## 7. Garen TSi Pro / TSi Pro Max (central inversora)

Fonte: https://docs.garen.com.br/manuais/manual_central_tsi_pro.pdf (rodapé "Manual - Central TSi Pro/TSi Pro Max N"). Livreto PT/ES rev01 (não lido): https://www.garen.com.br/wp-content/uploads/2022/12/Manual_livreto-CENTRAL_TSI_PRO_portugues_espanhol_rev01-1.pdf
Variantes com display (A01545–A01591) e sem display (A01895–A01899). Central com inversor (IGBT), velocidade em Hz.

**1. Rede:** "AC/AC-REDE - Entrada de alimentação 127 ou 220 V" (p. 14), com "Chave seletora" 127V/220V (p. 3 e 14): o manual manda conferir a posição da chave. Fase/neutro/terra: não constam.

**2. Motor:** "U/V/W - Automatizador- Fios do automatizador" (p. 14). Sem capacitor: "Para central trabalhar em automatizadores monofásicos é obrigatório retirar o capacitor do automatizador." (p. 11 e 12). Jumper "MONO/ENC OFF" (item 3.13, p. 19): "Seleciona o tipo de automatizador" — fechado = monofásico sem encoder; aberto = trifásico. Inverter: "deve-se inverter os fios do automatizador “U” pelo “W”" e o conector do fim de curso (p. 7), ou "basta habilitar a função sentido “1”" (item 7.3, p. 10).

**3. Fim de curso:** "FCA/CM/FCF – Fim de curso de abertura e fechamento do automatizador" (p. 14); conectores de 5 e 3 pinos (p. 3). "É obrigatório o uso de finais de curso (imãs), sem o uso do mesmo risco de queima e mal funcionamento do produto." (p. 11 e 12). "ENCODER – Entrada de encoder e LED de indicação de funcionamento" (p. 14).

**4. Fotocélula:** "FOTO – Entrada para fotocélula (dispositivo de segurança)" (p. 14), conector polarizado (p. 15). "É obrigatório o uso de fotocélula de segurança." (p. 11 e 12). Alimentação: "15V (alimentação de periféricos)" (p. 14); "O consumo máximo de equipamentos ligados a central, não deve exceder a 60mA." (p. 11). NA/NF e bypass: não constam. No fechamento, para e reverte (p. 4).

**5. Botoeira:** "BTA (botoeira de abertura)", "BTF (botoeira de fechamento)", "GND (negativo)" (p. 14).

**6. Ajustes:** botões "UP", "DOWN", "ENTER" (versão com display, p. 3); "TX (-)" e "CURSO (+)" (p. 15). Menu (p. 6): F1 TX; F2 CURSO; F3 VELOCIDADE (45–210 Hz); F4 VEL. FINAL (15–60 Hz); F5 RAMPA (0–99); F6 PAUSA (0–90 s); F7 FUNÇÕES (reversão, condomínio, sentido); F8 TAXA (aceleração 30–120 Hz/s; desaceleração 60–150 Hz/s); F9 TEMPO DE PARTIDA (0–900 ms); F10 PAUSA 2 (0–60 s); F0 RESET. Versão sem display por jumpers (p. 17–21): VEL FECHA/ABRE, RAMPA FC/AB (0–255), VEL FINAL, ACELER, DESACEL, PAUSA (0–180 s), PAUSA2, TEMP. PART., MONO/ENC OFF, 127/220, COND, REV, F.A (retardo de trava 1 s ou 0,5 s), F.B (reservado), CMD, RESET. (O próprio manual é inconsistente entre menu e jumpers nas faixas de rampa e pausa.)

**7. Controles:** "TX (-)": pressionar e soltar, apertar o controle (LED pisca), "TX (-)" de novo para confirmar; sai após 10 s (p. 16). Por menu: F1 → "C" → ENTER → controle → ENTER (p. 7). Apagar tudo: segurar TX (-) 5 s até o LED piscar rápido (p. 16); menu F1 → "A" → ENTER (p. 7). Memória: "256 Controles memórias Interna" e "512 Controles memórias Externa (24C16)" (p. 6); na p. 15, "até 250 botões / controles" (inconsistência do próprio manual). RF 433,92 MHz (p. 14). Código: não consta. "Antena" (item 17, p. 14).

**8. Proteções:** "SOBRECORRENTE: Quando a corrente excede o limite máximo permitido a central aciona a proteção por sobrecorrente"; "TEMPERATURA: Quando o dissipador atinge ~105°C a central aciona a proteção por temperatura" (volta abaixo de ~80 °C) (p. 23). Essas proteções são do módulo IGBT, não são descritas como antiesmagamento. Encoder melhora rampas e paradas (p. 3). Tempo limite: não consta.

**9. Fusível:** "Fusível de proteção – 10A;" (p. 14).

**10. Saídas:** só pelo módulo opcional "OP.8F" (não acompanha o kit, p. 11): ventilador, alarme, aberto, trava, temporizações de 3, 15, 30 ou 60 s (p. 22).

**11. Normas:** nenhuma. **Outros:** ARM 32 bits 64 MHz (p. 3); Wi-Fi 802.11 b/g/n 2,4 GHz (p. 24).

---

## 8. PPA Facility Connect (central para motor monofásico com capacitor)

Fonte: https://media.ppa.com.br/files/P04640_Central_FacilityConnect_REV5_1681484102895.pdf
Documento "CENTRAL FACILITY CONNECT", P04640 - 04/2022, Rev. 5 (Motoppar, marca PPA). Sem números de página no texto extraído; cito as seções numeradas. **Manual pobre em dados elétricos**: não traz fusível, corrente de acessórios, nomes de bornes de rede nem NA/NF da fotocélula.

**1. Rede:** o desenho só diz "REDE ELÉTRICA" e "127V OU 220V" (50 Hz / 60 Hz), ao lado de "JUMPER SELETOR DE TENSÃO" (sem instruções). Nomes de bornes F/N/terra: não constam no texto extraído.

**2. Motor:** "MOTOR DE INDUÇÃO M MONOFÁSICO" e "CAPACITOR DE PARTIDA DO MOTOR" (rótulos do diagrama). Cores: "Esses motores possuem os fios nas cores preta, vermelha e amarela." / "Os motores 127V possuem os fios nas cores branca, vermelha e amarela." Diagrama: "Amarelo", "Vermelho/Preto", "Preto/Vermelho" — o amarelo é o fio fixo do desenho, portanto o comum (não confirmado: o texto não diz "comum"). Inverter: "sempre que for necessário inverter a rotação do motor (fios preto e vermelho), a central deverá ser desligada." e "Não é necessário inverter a posição do encoder, pois a central corrige a posição automaticamente." Após religar, o primeiro comando usa torque pulsante.

**3. Fim de curso:** analógico ("REED DE FIM DE CURSO ANALÓGICO", cabos "FCA" e "FCF") ou digital ("CABO DO ENCODER (FIM DE CURSO DIGITAL)"). "JUMPER DE SELEÇÃO DE FIM DE CURSO" (FC aberto = analógico; FC fechado = digital). Número de fios: não consta.

**4. Fotocélula:** só "Entrada para fotocélula" e o rótulo "FOTOCÉLULA". Contato, alimentação, obrigatoriedade, bypass: **não constam** (as palavras "obrigatório", "segurança", "NBR", "fusível", "12V", "15V" e "mA" não aparecem no documento).

**5. Botoeira:** "Entrada para botoeira" / rótulo "BOTOEIRA". Também "RECEPTOR AVULSO".

**6. Ajustes:** "JUMPER PROG" (programação), "JUMPER DE SELEÇÃO DE FIM DE CURSO", "JUMPER SELETOR DE TENSÃO"; botão "GRV". Sem trimpot. Demais ajustes pelo programador (botões avançar, recuar, incrementar, decrementar, comando) ou pelo transmissor: Força ("Ajuste da embreagem eletrônica com o portão em movimento ou parado, até 14 níveis"; padrão "Força = Máximo"; deve ser "verificada tentando-se segurar o portão"), Pausa (máx. 4 min), torque pulsante, tempo de freio, rampas de abertura e fechamento, torque de rampa, torque de memorização, limite de fim de curso (7 níveis), recuo FCA/FCF, trava, luz de garagem, sinaleira, retardo de abertura.
- Torque pulsante: a central "ficará pulsando o motor, ou seja, ficará desligando e ligando rapidamente" — força em baixa rotação para achar batentes e memorizar percurso.

**7. Controles:** gravar: "Fechar o jumper PROG. O led verde SN deverá ficar fracamente aceso."; "Pressionar e manter pressionado o botão do transmissor. O led verde SN deverá ficar piscando."; "Pressionar e liberar o botão GRV e verificar o led SN."; "Para finalizar a operação, abrir o jumper PROG." Apagar tudo (seção 7): "Pressionar e liberar, simultaneamente, os dois botões do transmissor (gravado) 3 vezes." e confirmar: "Exclusão de todos os transmissores: Pressionar e liberar o botão direito do transmissor." Memória: "A central permite gravar até 160 transmissores diferentes e independentes dos botões." RF: "Módulo receptor RF 433,92 MHz". Código: "Rolling Code até 160 transmissores código fixo ou rolante". Antena: não consta.

**8. Obstáculo / tempo:** embreagem eletrônica (força) como acima; sensor de obstáculo/reversão: não consta. Tempo: "Tempo A/F = 60seg" (padrão com fim de curso analógico); sem memorização de percurso, "o tempo de abertura / fechamento será de 120 seg."

**9. Fusível:** não consta.

**10. Saídas:** "Saída para módulo de relé Luz de Garagem, Sinaleiro ou Trava." ("MÓDULO OPCIONAL PARA LUZ DE GARAGEM, SINALEIRA OU TRAVA"). Padrão de fábrica: trava. Trava: o motor parte "depois de 2 segundos"; pelo programador, "após 1 seg. a central ligará o motor e depois de 2 seg. a trava será desligada." Luz de garagem: "O ajuste é de 0 até 240 segundos." Com a trava ativa, luz e sinaleira ficam desabilitadas.

**11. Normas:** nenhuma.

### 8b. PPA Agility POP Freio (datasheet) e Agility POP Connect (espelho)

- Datasheet oficial de lançamento (Agility POP Freio): https://files.irroba.com.br/acreaaoi/download/b54f319895b32ea81cdee43e817db208.ppa-datasheet-lancamento-central-agility-pop-freio_1713357374029.pdf — motores monofásicos; "fonte chaveada robusta"; freio eletrônico com ajuste; "Fim de Curso Analógico"; receptor 433,92 MHz; códigos fixos; até 168 controles; memorização automática do percurso A/F; entradas de fotocélula e botoeira; saídas para módulo de trava e de luz de garagem; retardo de abertura com sinaleira. É a central do motor PPA DZ Stark Home "MONO" (capacitor 25 µF/127 V, 12 µF/220 V; ver Motores).
- Manual da Agility POP Connect em espelho **não oficial e traduzido para o inglês** (manualslib.tech): https://www.manualslib.tech/guide/108817/ppa-central-agility-pop-connect-manual.html — (não confirmado) jumpers PROG, modelo de aplicação, peso do portão (leve/pesado), tecnologia DZ/BV e TX; botões GRV (+) e CMD (-); gravar: fechar jumper TX, apertar o controle, apertar GRV (LED1 pisca 1x = ok, 2x = já gravado, 3x = memória cheia); apagar: jumper TX fechado, segurar CMD ~3 s; 164 controles código fixo / 82 rolling code PPA; embreagem eletrônica ("POWER") de fábrica no máximo; pausa: semiautomático, 5, 10, 30, 60, 90, 120, 180 ou 240 s; saídas de trava e luz de garagem (0 a 240 s). Recomendação de segurança: ajustar a embreagem para a menor força que move a folha e testar travando o portão com um objeto rígido.
- Manual "Agility Slave" P34924 - 11/2024 Rev. 0 (oficial): https://media.ppa.com.br/files/P34924_-_MANUAL_DE_INSTRUCOES_CENTRAL_AGILITY_SLAVE_-_REVISAO_0_1754916341723.pdf — "Módulo de acionamento e controle para motor de indução monofásico."; reed (cabos FCA e FCF) ou encoder; reset de fábrica segurando "CMD" 12 s até o LED SN ficar aceso; memorizar percurso segurando CMD 6 s. Sem dados de bornes no texto extraído.

## 9. PPA Triflex Full Range (central inversora)

Fonte lida: https://media.ppa.com.br/files/P30906_Manual_Triflex_Full_Range_REV10_1770812221431.pdf (REV10). A URL pedida (REV5, `mediah.ppa.com.br/files/P30531_Central_TriflexFullRangeDisplay_REV5_1681818175047.pdf`) **não pôde ser lida** (robots). Há ainda o "Triflex V2" (não lido): https://media.ppa.com.br/files/P36387-MANUAL-DE-INSTRUCOES-TRIFLEX-V2-3-idiomas-REVISAO-0_1777895710981.pdf. Texto extraído sem números de página e com trechos truncados.

- **Rede:** bornes "L" e "N" do "borne de alimentação"; terra: não consta. "Bivolt automático", 127 V ou 220 V, 50 ou 60 Hz. O tipo de motor (127 V ou 220 V) é escolhido por função (segurar (+) ou (-) por 10 s).
- **Motor:** "CONEXÃO DO MOTOR DE INDUÇÃO" (item 2.3), sem capacitor; fios pretos (motores trifásicos de saída 127 V) ou amarelos (saída 220 V); "NÃO É NECESSÁRIO OBEDECER à SEQUÊNCIA DE CORES". Procedimento de inversão: texto truncado (não confirmado).
- **Fim de curso:** reed magnético, conector "CACF" (Comum, Reed Aberto, Comum, Reed Fechado; pinos "A"/RDA e "F"/RDF) + encoder no conector "ENC" (LEDs ENCA e ENCB). O portão não pode operar só com reed.
- **Fotocélulas:** "FOTA" (abertura: borne 7 sinal, borne 2 15 V+, borne 1 GND) e "FOTF" (fechamento: borne 3 sinal, borne 2, borne 1). Contato configurável: NA, NF, resistiva ou pulsante. Alimentação **15 V CC, máx. 300 mA**. "é obrigatório o uso de Fotocélulas nos automatizadores". Com mestre/escrava, ligar a fotocélula nas duas placas.
- **Botoeiras:** "BOT" (borne 4, NA, pulso para GND), "ABR" (borne 5, só abre), "FEC" (borne 6, só fecha); GND = borne 1.
- **Ajustes:** jumpers "HRF" (retirar ao usar receptor avulso no conector "RX") e "TX"; botões (+) e (-) e programador PROG. Pausa 0–240 s; velocidade de abertura/fechamento 60–200 Hz (portão); rampa 10–50 Hz; memorização 10–50 Hz; partida 20–100 Hz; força de operação 20–100 %; força de rampa/memorização 0–32 %; desaceleração ABS 1–8 s (padrão 1,5 s); folga 0–16; retardo de abertura 1–14 s; fotocélula seguidora 0–80 s.
- **Controles:** código rolante, até 256 transmissores (criptografados na EEPROM), compatível "safe code PPA". Gravar: função "Gravar TX", apertar o controle até "Recebendo Sinal", apertar (+). Apagar: segurar (-) 10 s em "Apagar TX". RF: não consta no texto extraído.
- **Proteções:** sobrecorrente/curto no motor desarma a potência (LED SN pisca a cada 0,1 s) e volta após 10 s. Obstáculo no fechamento: reverte; na abertura: para. Método de detecção: não especificado.
- **Saídas:** "TRAVA" e "LUZ" via "Módulo Opcional Relê"; modos Padrão, tempo de luz (1–239 s), Sinaleira, Semáforo (saídas "LG" e "TRV"). Conector "NO-BREAK" (modo de economia com bateria).
- **Fusível, normas:** não constam.

---

## 10. Motores (deslizantes, 1/4 a 1/2 CV, 127 V e 220 V)

Todos os valores abaixo são **dados de fabricante**, salvo onde está escrito "fórum" ou "estimativa".

### 10.1 Garen KDZ (a melhor fonte encontrada: traz capacitor, corrente, torque e protetor térmico)

Fonte: https://garen.com.br/wp-content/uploads/2024/07/Manual_livreto-KDZ-digital-port_esp_mult-rev09.pdf ("Manual - KDZ", Rev. 09, Garen Automação S/A). Tabelas técnicas na p. 2 (linha 1/4) e p. 3 (1/3, 1/2, 2). Rótulos das linhas, como impressos: "MODELO", "POTÊNCIA NOMINAL", "CONSUMO", "CONSUMO/CICLO", "TORQUE N.m", "ROTAÇÃO", "CORRENTE DO Automatizador", "PROTETOR TÉRMICO", "CLASSE", "IP", "CICLOS HORA PORTÃO (3M)", "VELOCIDADE NOMINAL", "INTENSIDADE DE USO", "CAPACITOR", "REDUÇÃO", "PESO MÁXIMO PORTÃO (Kg)", "CENTRAL". Alimentação "127V/220V - 50Hz/60Hz".

| Modelo (KDZ) | CV | Capacitor (impresso) | Corrente 127 V / 220 V | Potência nominal 127 V / 220 V | Velocidade | Ciclos/h (portão 3 m) | Intensidade de uso | Protetor térmico | Central |
|---|---|---|---|---|---|---|---|---|---|
| FIT RAMP (e FIT RAMP Wi-Fi) | 1/4 | "30uF(127v) 12uF(220V)" | 3,05 A / 2,46 A | 310,1 W / 415,8 W | 15,78 m/min | 40 | Baixo | 150 °C | Fit Ramp |
| CLASSIC 1/4 | 1/4 | "30uF(127v) 12uF(220V)" | 3,1 A / 2,4 A | 332,70 W / 426,80 W | 15,92 m/min | 40 | Baixo | 150 °C | Fit Ramp |
| FIT SPEED (e SPEED Wi-Fi) | 1/4 | 40 µF / 15 µF | 3,88 A / 2,22 A | 448,31 W / 422,40 W | 18,36 m/min | 45 | Baixo | 150 °C | Fit Ramp |
| FIT CONNECT | 1/4 | 30 µF / 12 µF | 3,05 A / 2,46 A | 310,1 W / 415,8 W | 15,78 m/min | 40 | Baixo | 150 °C | Fit Connect |
| FIT CONNECT SPEED | 1/4 | 40 µF / 15 µF | 4,02 A / 2,50 A | 463 W / 502 W | 18 m/min | 45 | Baixo | 150 °C | Fit Connect |
| 1/3 | 1/3 | "40uF(127v) 12uF(220v)" | 4,8 A / 2,9 A | 574 W / 370 W | 20,9 m/min | 40 | Médio | 150 °C | Wave Connect |
| SPEED 1/3 | 1/3 | "40uF(127v) 15uF(220v)" | 3,7 A / 2,3 A | 430 W / 460 W | 23,35 m/min | 45 | Médio | 150 °C | Wave Connect |
| FIT TURBO CONNECT 1/3 | 1/3 | "35uF(127v) 15uF(220v)" | 1,85 A / 2,36 A | 235 W / 420 W | 23,35 m/min | 45 | Médio | 150 °C | Fit Connect |
| FIT CONNECT 1/3 | 1/3 | "40uF(127v) 12uF(220v)" | 4,8 A / 2,9 A | 574 W / 370 W | 20,9 m/min | 40 | Médio | 150 °C | Fit Connect |
| ½ | 1/2 | "40uF(127v) 15uF(220v)" | 5,06 A / 3,08 A | 428 W / 555 W | 17 m/min | 50 | Médio | 150 °C | Wave Connect |
| SPEED 1/2 | 1/2 | "40uF(127v) 15uF(220v)" | 5,06 A / 3,08 A | 428 W / 555 W | 22,41 m/min | 55 | Médio | 150 °C | Wave Connect |
| TSI FIT / TSI PRO / TSI PRO ½ | — | "Não se aplica" | 5,2/3,6; 7,2/4,7; 5,2/6,2 A | 604/781; 1458/955; 661/1210 W | 33; 37; 50 m/min | 50; 50; 70 | Médio/Alto | 150 °C | TSi Fit / TSi Pro |
| SPEED 2 | — | "10uF (220v)" | 2,2 A (220 V) | 484 W (220 V) | 30 m/min | 50 | Médio | 150 °C | Speed 2 |

- Rotação: 1740 RPM nos monofásicos de 4 polos; até 5200 RPM nos TSi; 3480 RPM no SPEED 2.
- Torque (linha "TORQUE N.m", tabela desalinhada no texto extraído — **conferir no PDF**): FIT RAMP "24,86 N.m (127v) 25,01 N.m(220V)" / "24 N.m"; CLASSIC 1/4 "32,20N.m (127v) 26,97 N.m(220v)" / "24 N.m"; 1/3 "16,6 N.m" / "30 N.m"; ½ "61 N.m" (segunda linha); SPEED 1/3 "42,5 N.m (127v) 43,1 N.m (220v)" / "40 N.m".
- Consumo por ciclo: FIT RAMP "0,0020kwh (127V) 0,0023kwh (220V)"; ½ "0,0019Kwh (127V) 0,0045Kwh (220V)". "CLASSE" "I"; "IP" "24".
- Tempo de abertura de portão de 3 m: 10,5 s (FIT RAMP, CLASSIC, 1/3, ½); 7 s (versões SPEED); 4,0 s (TSi).
- **Tensão nominal (VAC) do capacitor: não impressa.** A tabela só traz µF por tensão do motor.
- Intensidade de uso (Baixo/Médio/Alto): sem definição no manual.
- Fim de curso: ímã na cremalheira + sensor REED; face azul do ímã para cima; distância ímã–tampa 10 mm (ideal) a 15 mm (máx.) (p. 6). Fotocélula: alcance máx. 15 m interno / 7 m externo (p. 6).
- Segurança (p. 7): "De acordo com a norma de instalações elétricas (NBR 5410)" … "é obrigatório o uso de dispositivo de desligamento total de rede elétrica (disjuntor)"; "O fio verde deve estar permanentemente conectado ao aterramento do prédio"; "é obrigatório o uso de sensor anti-esmagamento (fotocélula modelo PWM)" (o texto em espanhol diz "se recomienda"). Cores dos fios do motor, ligação do capacitor e resistência dos enrolamentos: não constam.

### 10.2 PPA DZ Stark Home (datasheet) — capacitores PPA

Fonte: https://files.irroba.com.br/acreaaoi/download/a65ef3559542b50f6535db1163eb99b1.datasheet_dz-stark-home_1732912770840.pdf (hospedado na loja oficial PPA na plataforma Irroba; ver também o datasheet de lançamento https://files.irroba.com.br/acreaaoi/download/8c9951d056f3cf39ab377fd6252a1609.ppa-datasheet-lancamento-dz-stark_1708632976693.pdf, não lido).

| Versão | Motor | Capacitor (impresso) | Rotação | Redução | Tempo em 3 m* | Ciclos/h | Peso do portão | Fim de curso | Central (pelo layout; não confirmado) |
|---|---|---|---|---|---|---|---|---|---|
| MONO | Monofásico | "127 V = 25 uF / 220 V = 12 uF" | 1740 RPM | 1:23 | 13,5 s | 15 | 400 kg | Analógico | POP FREIO (Agility POP Freio) |
| LEGERO | Monofásico | "127 V = 35 uF / 220 V = 15 uF" | 3480 RPM | 1:30 | 8,5 s | 15 | 350 kg | Digital ou Híbrido | AGILITY LEGERO |
| JETFLEX | (inversor; freq. de saída 200 Hz máx.) | "Não aplicável" | 5800 RPM (máx.) | 1:30 | 5,5 s | 20 | 450 kg | Híbrido | TRIFLEX FACILITY |

*"Velocidade de abertura e fechamento medida em 3 metros." Tensão do capacitor (VAC): não impressa.

### 10.3 PPA DZ Stark (manual técnico P33096, 10/2023, Rev. 0)

Fonte: https://files.irroba.com.br/acreaaoi/download/2d39189036fe0eb8dd101fc23a4e41a7.p33096_tecnico_dzstark_rev0_1696938407875.pdf (p. 4–5). Pares de valores = 127 V / 220 V; 60 Hz; IPX4; -5 °C / +50 °C; isolamento Classe B 130 °C. Capacitor, protetor térmico, cores e resistência: **não constam**.

| Série | Modelo | Potência | Corrente nominal | Ciclos/h | Massa máx. | Velocidade |
|---|---|---|---|---|---|---|
| Monofásico 1740 RPM, 1:23 | 400 | 360 W / 480 W | 2,8 A / 2,1 A | 15 | 400 kg | 13,3 m/min (Z14), 17,1 m/min (Z18) |
| | 600 | 290 W / 510 W | 2,1 A / 2,5 A | 20 | 600 kg | idem |
| | 700 | 280 W / 460 W | 2,2 A / 2,0 A | 30 | 700 kg | idem |
| Legero 3480 RPM, 1:30 | 350 | 460 W / 620 W | 3,7 A / 3,0 A | 15 | 350 kg | 20,4 m/min (Z14), 26,2 (Z18) |
| | 500 | 360 W / 515 W | 2,8 A / 2,5 A | 20 | 500 kg | idem |
| | 600 | 335 W / 435 W | 2,65 A / 1,95 A | 30 | 600 kg | idem |
| JetFlex 5800 RPM, 1:30 | 450 | 310 W / 290 W | 3,5 A / 2,2 A | 20 | 450 kg | 34 m/min (Z14), 43,7 (Z18) |
| | 650 | 250 W / 220 W | 3,0 A / 1,9 A | 25 | 650 kg | idem |
| | 750 | 245 W / 210 W | 3,4 A / 2,1 A | 35 | 750 kg | idem |

- Inversão / fim de curso: "Caso haja necessidade, inverta o conector da placa" (p. 14–15); motor só gira para um lado: "Inverta o conector do fim de curso (analógico e/ou digital)" (p. 16). Central: identificar pela etiqueta do produto e consultar o manual em www.ppa.com.br.
- Fotocélula listada como opcional: "Eletrodutos de 1/2” de diâmetro para fotocélulas de segurança (opcional)" (p. 6).

### 10.4 PPA DZ Home (manual técnico) e DZ Hub (P08663, 06/2021)

- DZ Home (espelho em ismartgate.com, PDF da PPA): https://ismartgate.com/manuals/PPA_DZ_HOME_350_JETFLEX_manual.pdf (p. 4): DZ HOME analógica: 220 V 60 Hz: 460 W, 1740 rpm, 2,15 A; 220 V 50 Hz: 470 W, 1455 rpm, 2,37 A; 127 V 60 Hz: 335 W, 1740 rpm, 2,86 A; redução 1:24; 16,4 m/min (13,7 m/min em 50 Hz); 30 ciclos/h. DZ HOME BLDC: 100 W / 130 W, 0,7 A / 1,4 A, 36 m/min, 100 ciclos/h. DZ HOME JET FLEX: 2,75 A / 3,6 A, 41 m/min, 40 ciclos/h (associação de colunas pela ordem do texto; não confirmado). Capacitor: não consta.
- DZ Hub: https://files.irroba.com.br/acreaaoi/download/65920c602d09a2b78918649b5e955d7d.p08663_tecnico_dzhub_rev0_1679057533927.pdf (p. 5): monofásico #1 250 W / 390 W, 1,9 A / 1,5 A, 20 ciclos/h, 300 kg; monofásico #2 250 W / 400 W, 2,3 A / 2,0 A, 30 ciclos/h, 450 kg; ambos 1740 RPM, 1:23, 13,3 m/min (Z14). Jetflex 5800 RPM 44,4 m/min (2,2 a 4,5 A). Brushless 24 V: 50 W, 0,7 A, 16,8 m/min, 40 ciclos/h. Capacitor: não consta.

### 10.5 Intelbras DR / DC / DZ (manual de instalação do deslizante, v01 01-25)

Fonte: https://backend.intelbras.com/sites/default/files/2025-05/Manual_Portao_deslizante_completo_v01_01-25_site%201.pdf (tabela p. 5). Versão anterior: https://backend.intelbras.com/sites/default/files/2022-03/Manual_Portao_deslizante_01-22_site.pdf (não lida).
- DR300 NY: 300 W, 30 ciclos/h, 300 kg; DR400 NY: 300 W, 30 ciclos/h; DR400 / DR400 AL: 300 W, 60 ciclos/h, 400 kg; DR600 / DR600 AL: 350 W, 60 ciclos/h, 600 kg; DC800 AL: 400 W, 60 ciclos/h, 800 kg; DZ1000 AL: 400 W, 60 ciclos/h, 1000 kg. Rotação ~1600–1630 rpm (60 Hz). Linhas Fast: ~5240–5270 rpm, 30 a 120 ciclos/h (50–60 Hz).
- Capacitor, corrente, protetor térmico, cores, inversão: **não constam** neste manual (as cores dos motores Intelbras estão no manual da central CP-1000: comum amarelo, abre/fecha azul e preto).
- Fim de curso: "Suporte fim de curso" com ímã ("Imã permanente ferrite 52×12,7 mm", p. 6).
- Fotocélula (p. 11): "É obrigatório a instalação e uso de fotocélula (anti-aprisionamento) para evitar acidentes de colisão com pessoas."
- Normas (p. 4): "de acordo com as normas de segurança aplicáveis, como por exemplo a NR-10 e NR-35." Nenhuma NBR.
- Central: o manual manda ver "o manual da placa do modelo especificado" (p. 11).

### 10.6 Omegasat KAZA (deslizante) e Omegaport DZ 1000 (manuais no site da Nice)

- KAZA (30007737 Rev 07): https://niceforyou.com/sites/default/files/upload/manuals/30007737-MANUAL-INST-DESL-KAZA-OMS-Rev-07.pdf — KAZA 300: 1/5 CV, 3,5 A (127 V) / 1,8 A (220 V), 1600 rpm, 20 ciclos/hora; KAZA 400: 1/4 CV 4 polos, 225 W (127 V) / 265 W (220 V), 2,2 A / 1,3 A, 1700 rpm, 50 ciclos/hora; KAZA 600: 1/3 CV 4 polos, 330 W / 265 W, 2,3 A / 1,2 A, 1700 rpm, 50 ciclos/hora. Protetor térmico 150 °C; tempo de abertura 12 s; IPX4. Capacitor: não consta. Fotocélula declarada obrigatória (vendida à parte). Cita portaria do Inmetro: "fica proibido o uso de automatizadores em portões que possuem portas sociais embutidas na estrutura do mesmo". Motor trifásico exige relé de falta de fase.
- DZ 1000 (Omegaport): https://niceforyou.com/sites/default/files/upload/manuals/30006663-MANUAL-INST-DESL-1000-OMS.pdf — 220 V: ~360 W, 1,6 A; 127 V: ~320 W, 2,5 A; 1700 rpm; "Protetor Térmico do Motor: 130°C"; tempo de operação "1 min."; 13,0 m/min; até 400 (kg, unidade não impressa). Cores no borne: comum **azul**, abre **branco**, fecha **preto**. Capacitor: só "item 07", sem valor. Central que acompanha: "CENTRAL WIRELESS" (fusível 5 A, saída 12 Vdc). Fotocélula: "Para a segurança do usuário, é obrigatório a instalação do dispositivo de segurança (fotocélula)." e "obrigatória para o funcionamento do automatizador". Cita "PORTARIA 371/09" e cabo "2x(1,0 mm²) (designação código 60245 iec 57)".

### 10.7 Nice deslizantes (Peccinin: LIGHT, SUPER, MAX, GATTER…)

Fonte: https://niceforyou.com/sites/default/files/upload/manuals/30003935-MANUAL-DE-INSTALACAO-DESLIZANTES-Rev-04.pdf (p. 5–10). Ciclos/h, peso, velocidade e força de arraste por modelo, por exemplo LIGHT: 40 ciclos/h, até 500 kg, 15 m/min, 127/220 V, 50 kgf; LIGHT FLASH: 40 ciclos/h, até 400 kg, 30 m/min; SUPER: 100 ciclos/h, até 800 kg, 13 m/min, 80 kgf; MAX: 120 ciclos/h, até 1800 kg, 15 m/min, 240 kgf (associação de colunas incerta no texto extraído). "para rede de 50 Hz a velocidade cai 17 %". Capacitor, corrente, protetor, cores: não constam. "Produto possui certificação de segurança compulsória conforme portaria Inmetro 371:2009" (p. 2). Fim de curso magnético a no máximo 0,5 cm da face da carenagem (p. 13). Motor trifásico: "é obrigatório a utilização de “relé de falta de fase”" (p. 15). Embreagem **mecânica** descrita como item de segurança, ajustada ao peso do portão (p. 14).

### 10.8 Rossi linha deslizante DZ (Atto Turbo, Nano Turbo, DZ3 SK, DZ4 SK…)

Fonte: https://www.sistemaqtecnologia.com.br/anexos/70aa562857529d2dfc475d1fd9b1c3ad.pdf ("Linha Deslizante", Rev 03/17, Cód. 12443; hospedado por revendedor). "Características Técnicas" (Pag. 3): 127/220 V, 50/60 Hz, IP 44, Classe II, -20 °C a 55 °C, módulo M4; potências 370 a 500 W e velocidades 12 ou 17 m/min (associação modelo × linha ambígua no texto extraído; não confirmado). Centrais: KXH30FS e KXHA30FS. Ligação: "O comum (conferir etiqueta no motor) normalmente o de cor amarela deve ser conectado na saída U."; "Caso o 1º comando feche o portão inverta os fios V e W."; "CAP - Capacitor de Partida", "os fios não possuem polaridade"; valor do capacitor "de acordo com a potência do motor" (sem número). Fim de curso Hall com ímãs. SIA 30 FS obrigatório para o anti-aprisionamento (garantia perdida sem ele). NBR 5410:1997. Cabo mínimo 2,5 mm²; seccionador bipolar com abertura de contatos ≥ 3 mm.

### 10.9 Resistência dos enrolamentos (o dado mais raro)

**Nenhum manual de fabricante consultado (PPA, Garen, Rossi, Nice/Peccinin/Omegasat, Intelbras) informa a resistência dos enrolamentos em ohms.** Buscas em português, espanhol, italiano e inglês (fóruns, blogs de técnicos) também não trouxeram valores confiáveis de motores brasileiros. O que foi encontrado:

| Valor | Motor | Tipo de fonte | URL | Observação |
|---|---|---|---|---|
| "139 ohms tous les trois (deux à deux)", isolados da terra | Siminor DPA 0302K (portão de abrir, França), 230 V, capacitor 6 µF (trocado por 10 µF) | **Fórum** (usuário "Gilles", 24/06/2018); outro usuário respondeu que "Les valeurs des bobinages sont bonnes" | https://forum.somfy.fr/questions/1679970-dpa-302k-moteur-grogne-bouge-mesure-139-ohms-chaque-enroulement-faire | (não confirmado) Leitura estranha: num motor com comum + 2 bobinas, a medida entre as pontas das bobinas deveria ser a soma das outras duas. Motor de baixa potência, 230 V; não serve de referência para motor deslizante 127 V. O defeito real era mau contato nos conectores. No mesmo fórum: azul = comum, capacitor entre branco e marrom. |
| "wht-brn .5 ohms, red-blu 4.6 ohms"; depois "red/brn 5.2, wht/brn 1.5, red/blu 9, wht/blu 5.5, wht/red 5.0, brn/blu 5.0" | A.O. Smith 322P711, 1/2 hp, 1000 rpm, testado em 115 VAC (motor de 4+ fios, não é o típico de portão brasileiro) | **Fórum** (All About Circuits) | https://forum.allaboutcircuits.com/threads/follow-up-seeking-basic-non-electronic-gate-opener-circuit.112112/post-866962 | (não confirmado) Só serve para mostrar a ordem de grandeza (ohms a dezenas de ohms) em motor de 115 V. |
| Sem valor; "close, but not identical" entre as duas bobinas | Motor de portão 120 V com capacitor | **Fórum** | https://forum.allaboutcircuits.com/threads/type-of-120-v-ac-single-phase-motor.150396/ | Confirma a topologia: fio 1 comum, fio 2 sentido A, fio 3 sentido B. |
| Sem valor; "There should be a measurable resistance across both the run and start windings" (zero ou infinito = defeito) | Motores PSC de ventilador (fracionários) | Artigo técnico (Joe Marchese, ACHR News, 06/06/2016) | https://achrnews.com/articles/132643-ice-breaker-troubleshooting-fractional-horsepower-psc-fan-motors | Critério de teste, não valor. |

**Estimativa do pesquisador (NÃO é dado de fonte; usar só como ordem de grandeza para simulação e sempre rotular assim no curso):**
- Princípio de medição (física do motor PSC reversível de portão, que tem as duas bobinas iguais): com o motor **desligado da rede e da central**, medir os três pares. Entre os dois fios que não são o comum, a leitura é a **maior** (≈ soma das outras duas); o fio que não participa da leitura maior é o comum. Leituras comum–abre e comum–fecha devem ser parecidas (bobinas simétricas). Zero (ou muito baixo) = espiras em curto; infinito (OL) = bobina aberta, possivelmente pelo protetor térmico aberto (motor quente) ou fio rompido. Também medir cada fio contra a carcaça (deve ser "OL" no multímetro; o certo é megôhmetro).
- Ordem de grandeza esperada por cálculo de perdas no cobre (R ≈ P_cobre / I², assumindo 10 % a 20 % da potência de entrada dissipados na bobina principal, com os dados Garen KDZ FIT RAMP 127 V: 310 W, 3,05 A): **≈ 3 a 7 Ω por bobina em motor 127 V**; para o mesmo motor em 220 V (415,8 W, 2,46 A): **≈ 7 a 14 Ω por bobina**. Em geral, a versão 220 V tem resistência cerca de 2 a 3 vezes maior que a de 127 V (mais espiras de fio mais fino). Estes números são **estimativas** e não devem ser apresentados como dado de fabricante.

---

## 11. Normas, leis e frases de segurança citadas pelas fontes (copiadas, sem inventar)

| Norma / lei citada | Onde | Contexto |
|---|---|---|
| "NBR 5410:1997 - ABNT- Associação Brasileira de Normas Técnicas." | Rossi KXH1024FS (Pag.04) e Rossi linha DZ | Instalação elétrica (seccionador bipolar ≥ 3 mm, cabo ≥ 2,5 mm²) |
| "De acordo com a norma de instalações elétricas (NBR 5410)" | Garen KDZ (p. 7) | Disjuntor de desligamento total obrigatório |
| "NBR NM 247-3" (fiação fixa), "NBR NM 247-5" (cabo interno 3 x 0,75 mm², 500 V), "IEC 60245-57" (cabo externo) | PPA DZ Stark, DZ Hub, DZ Home (p. 6) | Cabos |
| DR: "O aparelho deve ser alimentado através de um dispositivo de corrente diferencial residual (DR)" "com uma corrente de operação residual nominal excedendo 30 mA." | PPA DZ Hub (p. 7), DZ Stark, DZ Home | **Atenção:** o texto diz "excedendo"; o usual é "não excedendo 30 mA" — provável erro do manual. Não copiar sem comentar. |
| "É obrigatório o uso de dispositivos de desligamento total na instalação do automatizador." | PPA DZ Hub (p. 4), DZ Home (p. 3), DZ Stark (p. 5) | Seccionamento |
| "É obrigatório que o terminal de aterramento seja ligado ao cabo de aterramento da rede" | PPA DZ Stark, DZ Hub (p. 7) | Aterramento |
| "portaria Inmetro 371:2009" ("certificação de segurança compulsória") | Nice deslizantes Rev 04 (p. 2) | Certificação do produto |
| "PORTARIA 371/09" | Omegaport DZ 1000 | Advertências de segurança |
| Portaria do Inmetro (número não copiado no texto extraído): "fica proibido o uso de automatizadores em portões que possuem portas sociais embutidas na estrutura do mesmo" | Omegasat KAZA | Portão com porta social embutida |
| "NR-10 e NR-35" | Intelbras motor deslizante (p. 4) | Segurança do instalador (eletricidade, altura) |
| "Lei 01-00190/2017" | Peccinin CP 4010F/4020F (p. 31) | Sinaleira temporizada 15 s antes de abrir (lei citada pelo manual, ente não identificado) |
| Lei 8078/90 | Rossi KXH1024FS | Garantia (Código de Defesa do Consumidor), não é norma técnica |

Nenhuma fonte consultada cita uma **NBR específica de automatizadores de portão** pelo número. A certificação compulsória citada é a Portaria Inmetro 371/2009.

**Fotocélula — o que cada fonte diz:**
- Obrigatória: Intelbras (manual do motor, p. 11: "É obrigatório a instalação e uso de fotocélula (anti-aprisionamento)…"); Peccinin CP 4010F (p. 34) e Nice Pro S10 e Omegasat CT30A ("O uso de fotocélula como dispositivo de segurança é obrigatório!"); Garen TSi Pro ("É obrigatório o uso de fotocélula de segurança.") e Garen KDZ ("é obrigatório o uso de sensor anti-esmagamento (fotocélula modelo PWM)"); PPA Triflex Full Range ("é obrigatório o uso de Fotocélulas nos automatizadores"); Rossi ("É obrigatório o uso do sensor infravermelho Ativo - SIA 30 FS"); Omegaport DZ 1000 ("obrigatória para o funcionamento do automatizador"); Omegasat KAZA.
- Opcional: manuais técnicos de motor PPA DZ Stark, DZ Hub e DZ Home ("fotocélulas de segurança (opcional)").
- Sem menção: PPA Facility Connect, Intelbras CP-1000 (manual da central), Garen Wave Connect.
- **Nenhuma fonte descreve um jumper para "pular" a fotocélula.** Onde a entrada é NA (Intelbras, Peccinin, Nice, Omegasat), a central funciona sem nada ligado na entrada (inferência técnica, não declarada nos manuais). Onde a entrada é NF ou testada (Rossi com FS ligado, Nice Pro S10 configurada em NF, PPA Triflex configurada em NF), a falta da fotocélula impede a operação — a Rossi lista isso como falha. Para o curso: tratar a fotocélula como dispositivo de segurança obrigatório, que é o que a maioria dos fabricantes declara.

---

## 12. Tabela-resumo: nomes de bornes por marca

Legenda: "—" = não consta no texto extraído. Centrais inversoras (sem capacitor) marcadas com (INV).

| Central | Rede | Motor | Capacitor | Fim de curso | Fotocélula (contato; alimentação) | Botoeira | Ajustes | Inverter sentido | Sem fotocélula |
|---|---|---|---|---|---|---|---|---|---|
| **Intelbras CP-1000** | "F", "N", "Terra"; 100–240 Vca | "C" (comum), "A" (abre), "F" (fecha) | "CAP" | Reed, "FCA"/"FCF", conector "CN13" (3, 4 ou 5 fios) | "Foto" + "GND"; 1 entrada NA; "+12 V" 12 Vcc / 300 mA | "BotA", "BotF", "GND" | Menu com 4 teclas (Esc, Ok, setas) e LEDs: Emb, Ace, Desa, Freio, Pausa… | Trocar fios preto e azul (A↔F) | Não consta |
| **Nice/Peccinin CP 4010F/4020F** | "F", "F/N", terra (símbolo); 90–240 VAC | "C1", "A1", "F1" (+ "C2", "A2", "F2") | nos fios marrom e branco | Reed NA, "FCA1 \| GND \| FCF1" | "FTC" + "GND"; NA; "+12V" 700 mA | "BOT" + "GND" | Trimpots "EMBR.", "DESACEL", "FCH.AUTO", "RETARDO", "DIST..FREN"; jumpers "C", "A", "B", "MAN/AUTO"; botão "LEARN" | Inverter fios nos bornes abre/fecha | Obrigatória; sem bypass descrito |
| **Nice Pro S10** | "TERRA", "ALIMENTAÇÃO DA CENTRAL (127v ou 220v)"; 90–240 VCA | "COMUM", "ABRE", "FECHA" | dois bornes "CAPACITOR" | Reed, somente N.A. | "+12V/GND/N.A."; NA (NF por menu); 12 Vcc / 700 mA | entradas "A" e "B" | Grupos de jumper + "LEARN": força 50–100 %, pausa, desaceleração, freio | Inverter fios "ABRE"/"FECHA" (fim de curso por menu) | Obrigatória; sem bypass descrito |
| **Omegasat CT30A** | "F", "F/N", terra (símbolo); 90–240 VCA | "CM" (comum, fio preto), "AB", "FC" | nos fios de "AB" e "FC" | Reed, "FCF \| GND \| FCA" | "GND", "+12V", "N.A."; 12 Vcc / 500 mA | NA sem retenção (nomes não constam) | Trimpots "FORÇA", "PAUSA", "DESACEL"; jumpers "MOD", "MAN/AUT", "CONF"; botão "PROG" | Inverter fios abre/fecha | Obrigatória; sem bypass descrito |
| **Rossi KXH1024FS** | "F", "N" (Neutro/Fase 2); 90–240 VAC; terra exigido, sem borne | "U" (comum, amarelo), "V", "W" | "CAP" (sem polaridade) | Reed ou Hall, "FA", "FF", "CM" | "FOTOCÉLULA" + "TX(-)"; NF com FS (DIP-6 ON) ou NA sem FS; "FTA" (abertura, NA); "12V" 300 mA | "BOT_A", "BOT_F", "GND"/"CM" | DIP 1–6 (PREDIAL, PAUSA, FECHADURA, LV/PS, DZ/BV, FS); trimpots "ACEL.", "DESAC.", "VL.AB", "VL.FC"; botão "APRENDER" | Trocar "V" e "W" | SIA 30 FS obrigatório; com FS ligado e sem sensor, não opera |
| **Garen Wave Connect** | "REDE" 127/220 V | "BR/AZ/PT" (comum provável AZ, não confirmado) | "CAP/CAP" | "FCA/FCF" (3 e 5 vias), reed | entrada polarizada; JP1 aberto = fotocélula comum (sinal negativo), fechado = PWM Garen; "Saída 12V" | "BOT", "GND", "BTA", "BTF" | Jumpers PAUSA, FORÇA (0–20 = 5–100 %), FREIO, RAMPA AB/FC, BV/DZ, REV, FCD, R.AX + botões "TX (-)" / "CURSO (+)" | Trocar "PT" e "BR" e inverter o conector do fim de curso | Não consta (manual do motor KDZ: obrigatória) |
| **Garen TSi Pro (INV)** | "AC/AC-REDE" + chave 127/220 V | "U/V/W" (retirar o capacitor se motor monofásico) | — (não usa) | "FCA/CM/FCF" + "ENCODER"; ímãs obrigatórios | "FOTO"; "15V" (acessórios ≤ 60 mA) | "BTA", "BTF", "GND" | Menu F1–F10/F0 (display) ou jumpers; velocidade em Hz | Trocar "U" por "W" + conector do fim de curso, ou função SENTIDO "1" | Obrigatória |
| **PPA Facility Connect** | "REDE ELÉTRICA" 127 V ou 220 V + "JUMPER SELETOR DE TENSÃO" | fios amarelo + preto/vermelho (220 V) ou branco/vermelho (127 V) | "CAPACITOR DE PARTIDA DO MOTOR" | Reed ("FCA", "FCF") ou encoder (fim de curso digital); "JUMPER DE SELEÇÃO DE FIM DE CURSO" | "FOTOCÉLULA" (contato e alimentação não constam) | "BOTOEIRA" | Jumper "PROG", botão "GRV", programador: força (14 níveis), pausa, rampas, freio… | Trocar preto e vermelho com a central desligada | Não consta |
| **PPA Triflex Full Range (INV)** | "L", "N"; bivolt automático | 3 fios (pretos 127 V / amarelos 220 V), sem sequência | — (não usa) | Reed "CACF" + encoder "ENC" | "FOTA" (abertura) e "FOTF" (fechamento); NA/NF/resistiva/pulsante; 15 V CC / 300 mA | "BOT", "ABR", "FEC" (+ GND) | Botões (+)/(-), jumpers "HRF", "TX"; força 20–100 %, velocidades em Hz | Truncado no texto extraído | Obrigatória |

### Controles remotos (resumo)

| Central | Botão de gravação | Apagar tudo | Memória | RF / código |
|---|---|---|---|---|
| Intelbras CP-1000 | teclas "Esc" + "Ok" | menu "Res" (reset geral) | 800 botões | 433,92 MHz; FSK AES 128 bits Intelbras ou OOK code learning |
| Peccinin CP 4010F | "LEARN" | segurar "LEARN" até o LED piscar rápido | 250 controles (2 botões) | 433,92 MHz; Rolling Code Peccinin; antena whip 17 cm |
| Nice Pro S10 | "LEARN" | segurar "LEARN" 3 s (jumpers das duas primeiras fileiras retirados) | 250 controles | não consta |
| Omegasat CT30A | "PROG" | segurar "PROG" até o LED apagar | 39 botões | 433,92 MHz; learning code |
| Rossi KXH1024FS | "APRENDER" | segurar "APRENDER" até o LED ST apagar | 1024 botões (memória removível) | 433 MHz; HCS; antena 16 cm no borne "ANT" |
| Garen Wave Connect | "TX (-)" | segurar "TX (-)" 5 s | 512 | 433,92 MHz |
| Garen TSi Pro | "TX (-)" ou menu F1 | segurar "TX (-)" 5 s ou F1 → "A" | 250/256 interna, 512 externa (24C16) | 433,92 MHz |
| PPA Facility Connect | jumper "PROG" + botão "GRV" | 2 botões do transmissor gravado 3 vezes + botão direito | 160 | 433,92 MHz; código fixo ou rolante |
| PPA Triflex Full Range | função "Gravar TX" + (+) | segurar (-) 10 s em "Apagar TX" | 256 | código rolante |

### Fusível e tempo limite (resumo)

| Central | Fusível | Tempo limite de percurso |
|---|---|---|
| Intelbras CP-1000 | 10 A, 5 × 20 mm, vidro | 4× o percurso calculado (alarme) |
| Peccinin CP 4010F | 5 A, vidro 20 mm | existe após o Soft Closing (valor não consta) |
| Nice Pro S10 | consta no desenho, valor não | 90 s |
| Omegasat CT30A | consta, valor não | 40 s |
| Rossi KXH1024FS | não consta (disjuntor bipolar 10 A externo) | não consta |
| Garen Wave Connect | 5 A | não consta |
| Garen TSi Pro | 10 A | não consta |
| PPA Facility Connect | não consta | 60 s padrão; 120 s sem percurso memorizado |

---

## 13. URLs consultadas

**Lidas com sucesso (centrais)**
- https://backend.intelbras.com/sites/default/files/2026-08/Manual%20de%20Usu%C3%A1rio%20e%20Programa%C3%A7%C3%A3o%20Central%20Padr%C3%A3o%20Automatizador%20Port%C3%A3o%20CP-1000%20-%20Vers%C3%B5es%20Acima%20de%203.5.x%2008-26_0.pdf
- https://niceforyou.com/sites/default/files/upload/manuals/30004081-MANUAL-DE-CONFIGURACAO-CP4010F-4020F-Rev-06.pdf
- https://www.niceforyou.com/sites/default/files/2026-08/MANUAL-COMPLETO-CENTRAL-NICE-PRO-S10-110826.pdf
- https://niceforyou.com/sites/default/files/upload/manuals/30010120-MANUAL-INST-CENTRAL-CT30A-OMS-Rev-00.pdf
- https://www.rossiportoes.com.br/upload/arquivos/Central%20BIKXH_1024%20Rev.F%20-%20PT.pdf
- https://docs.garen.com.br/manuais/MANUAL_CENTRAL_WAVE_CONNECT.pdf
- https://docs.garen.com.br/manuais/manual_central_tsi_pro.pdf
- https://media.ppa.com.br/files/P04640_Central_FacilityConnect_REV5_1681484102895.pdf
- https://media.ppa.com.br/files/P30906_Manual_Triflex_Full_Range_REV10_1770812221431.pdf
- https://media.ppa.com.br/files/P34924_-_MANUAL_DE_INSTRUCOES_CENTRAL_AGILITY_SLAVE_-_REVISAO_0_1754916341723.pdf
- https://files.irroba.com.br/acreaaoi/download/b54f319895b32ea81cdee43e817db208.ppa-datasheet-lancamento-central-agility-pop-freio_1713357374029.pdf
- https://www.manualslib.tech/guide/108817/ppa-central-agility-pop-connect-manual.html (espelho não oficial, traduzido)
- https://media.easy.cl/is/image/EasySA/1253027-70.pdf (PPA Chile, "Automatizador Rápido" com central Triflex Top; sem dados de enrolamento)

**Lidas com sucesso (motores)**
- https://garen.com.br/wp-content/uploads/2024/07/Manual_livreto-KDZ-digital-port_esp_mult-rev09.pdf
- https://files.irroba.com.br/acreaaoi/download/a65ef3559542b50f6535db1163eb99b1.datasheet_dz-stark-home_1732912770840.pdf
- https://files.irroba.com.br/acreaaoi/download/2d39189036fe0eb8dd101fc23a4e41a7.p33096_tecnico_dzstark_rev0_1696938407875.pdf
- https://files.irroba.com.br/acreaaoi/download/65920c602d09a2b78918649b5e955d7d.p08663_tecnico_dzhub_rev0_1679057533927.pdf
- https://ismartgate.com/manuals/PPA_DZ_HOME_350_JETFLEX_manual.pdf
- https://backend.intelbras.com/sites/default/files/2025-05/Manual_Portao_deslizante_completo_v01_01-25_site%201.pdf
- https://niceforyou.com/sites/default/files/upload/manuals/30003935-MANUAL-DE-INSTALACAO-DESLIZANTES-Rev-04.pdf
- https://niceforyou.com/sites/default/files/upload/manuals/30006663-MANUAL-INST-DESL-1000-OMS.pdf
- https://niceforyou.com/sites/default/files/upload/manuals/30007737-MANUAL-INST-DESL-KAZA-OMS-Rev-07.pdf
- https://www.sistemaqtecnologia.com.br/anexos/70aa562857529d2dfc475d1fd9b1c3ad.pdf
- https://www.intelbras.com/pt-br/automatizador-de-portao-deslizante-dz-1000-fast-afe (página de produto; poucos dados)

**Resistência de enrolamento (fóruns e artigos)**
- https://forum.somfy.fr/questions/1679970-dpa-302k-moteur-grogne-bouge-mesure-139-ohms-chaque-enroulement-faire
- https://forum.somfy.fr/questions/1679970-dpa-302k-moteur-grogne-bouge-mesure-139-ohms-chaque-enroulement-faire/answers/3793183
- https://forum.allaboutcircuits.com/threads/follow-up-seeking-basic-non-electronic-gate-opener-circuit.112112/post-866962
- https://forum.allaboutcircuits.com/threads/type-of-120-v-ac-single-phase-motor.150396/
- https://achrnews.com/articles/132643-ice-breaker-troubleshooting-fractional-horsepower-psc-fan-motors
- https://riut.utfpr.edu.br/jspui/bitstream/1/29881/1/CT_CEAUT_XII_2019_06.pdf (monografia UTFPR sobre motor trifásico rebobinado; não trata de portão)

**Não puderam ser lidas**
- https://mediah.ppa.com.br/files/P30531_Central_TriflexFullRangeDisplay_REV5_1681818175047.pdf (robots.txt)
- https://garen.com.br/wp-content/uploads/2023/12/Manual_livreto-CENTRAL_UNIVERSAL-CXXXX_portugues_espanhol-rev00-1.pdf e a variante com `www.` (robots.txt)
- https://portao-automatico.com/como-identificar-o-fio-comum-do-motor-de-portao-em-diadema (erro do site)
- https://eletricidade.net/viewtopic.php?t=19280 (erro do site)
- https://cial.cialsistemas.com.br/teste-de-funcionamento-portao-eletronico/ (robots.txt)
- Download direto por curl de todos os domínios de fabricante: bloqueado pelo proxy da sessão (HTTP 403).

**Encontradas e não lidas (para aprofundar depois)**
- https://backend.intelbras.com/sites/default/files/2026-08/Manual%20de%20Usu%C3%A1rio%20e%20Programa%C3%A7%C3%A3o%20Central%20Padr%C3%A3o%20Automatizador%20Port%C3%A3o%20CP-1000%20-%20Vers%C3%B5es%203.2.10%20e%203.3.2%2008-26_0.pdf
- https://backend.intelbras.com/sites/default/files/2022-03/Manual_Portao_deslizante_01-22_site.pdf
- https://media.ppa.com.br/files/P36387-MANUAL-DE-INSTRUCOES-TRIFLEX-V2-3-idiomas-REVISAO-0_1777895710981.pdf
- https://media.ppa.com.br/files/Manual-Central-DC-24V-Linea_1754917566887.pdf
- https://files.irroba.com.br/acreaaoi/download/8c9951d056f3cf39ab377fd6252a1609.ppa-datasheet-lancamento-dz-stark_1708632976693.pdf
- https://niceforyou.com/sites/default/files/upload/manuals/30009778-MANUAL-CENTRAL-CT22A-OMS-Rev-02.pdf
- https://niceforyou.com/sites/default/files/upload/manuals/30006288-MANUAL-CP1050F-3050F-S-BOARD-1000-1001A-Rev-06.pdf
- https://niceforyou.com/sites/default/files/upload/manuals/30007007-MANUAL-S-BOARD-2000-2001A-Rev-01.pdf
- https://garen.com.br/wp-content/uploads/2023/12/Manual_livreto-CENTRAL_FIT_RAMP_portugues_espanhol_re01.pdf
- https://garen.com.br/wp-content/uploads/2023/12/Manual_livreto-CENTRAL_WAVE_CONNECT_portugues_espanhol_rev01.pdf
- https://files.irroba.com.br/acreaaoi/download/1394875a8bfd941b6db44afefb84e761.p04985_-_manual_fotocelula_f10_rev5_aprovacao_1680785426780.pdf (fotocélula PPA F10)
