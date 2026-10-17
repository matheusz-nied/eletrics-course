# 01 · Currículo

O curso tem **4 partes, 18 módulos e cerca de 113 aulas**. Ele leva o aluno dos princípios da eletricidade até tarefas reais, como trocar o motor de um portão eletrônico, ligar um interruptor paralelo ou diagnosticar uma fonte queimada.

Legenda usada em cada aula:

- **Sim**: simulação interativa (motor de simulação + esquemático 2D, às vezes ligada a uma cena 3D).
- **3D**: modelo 3D interativo (girar, explodir, cortar, anotações).
- **Caso**: situação real que motiva ou aplica o conceito.
- **Nível**: `B` básico, `I` intermediário, `A` avançado (aulas `A` podem ser puladas sem perder a sequência).

Os slugs de módulo e aula viram URLs (`/m01-eletricidade-do-zero/04-lei-de-ohm`). A frente de conteúdo dona do módulo pode ajustar títulos e dividir/juntar aulas, desde que mantenha a cobertura listada aqui e as aulas que outras partes do curso citam (em especial as da Trilha Portão).

---

## Parte 1 · Fundamentos

### M00 · Comece aqui (`m00-comece-aqui`)

| # | Aula | Conteúdo | Sim / 3D / Caso |
|---|------|----------|-----------------|
| 00.1 | Como usar este curso | Navegação, simulações, modelos 3D, progresso, trilhas, modo oficina | Sim: pilha + chave + lâmpada (tutorial guiado dos controles). 3D: tour pela bancada virtual |
| 00.2 | Segurança em eletricidade | O que o choque faz no corpo, por que a corrente mata (e não a tensão sozinha), resistência da pele seca/molhada, regra de ouro (desligar, testar, sinalizar), DR, EPI, NR-10 em linguagem simples, quando chamar um eletricista | Sim: corpo humano como resistência → corrente → faixas de efeito (IEC 60479). 3D: disjuntor e DR. Caso: choque no registro do chuveiro sem aterramento |
| 00.3 | Ferramentas essenciais | Multímetro, chave de teste (caneta neon), alicates, chaves, fita isolante, conectores de alavanca, ferro de solda | 3D: cada ferramenta, com anotações de uso correto |

### M01 · Eletricidade do zero (`m01-eletricidade-do-zero`)

| # | Aula | Conteúdo | Sim / 3D / Caso |
|---|------|----------|-----------------|
| 01.1 | Átomos, elétrons e carga | Carga elétrica, coulomb, condutores e isolantes, elétrons livres | 3D: átomo de cobre e nuvem de elétrons livres num fio (deriva) |
| 01.2 | Corrente elétrica | Ampère, sentido convencional × real, velocidade de deriva × velocidade do sinal | Sim: pilha + lâmpada com animação de corrente (alternar elétrons/convencional) |
| 01.3 | Tensão | Diferença de potencial, referência (terra), pilhas e baterias, analogia hidráulica e seus limites | Sim: medir tensão entre vários pontos. 3D: pilha AA em corte |
| 01.4 | Resistência e Lei de Ohm | Resistividade, bitola, comprimento, temperatura; V = R·I; curva I×V | Sim: sliders V/R com gráfico I×V ao vivo. 3D: fios de bitolas diferentes. Caso: por que extensão fina esquenta |
| 01.5 | Potência e energia | Watt, efeito Joule, kWh, conta de luz | Sim: chuveiro com chave verão/inverno. 3D: resistência de chuveiro. Caso: calcular o custo mensal do chuveiro |
| 01.6 | Unidades e ordens de grandeza | Prefixos (m, µ, k, M), notação científica, leitura de valores em componentes | Interativo: conversor e "jogo das grandezas" |

### M02 · Circuitos de corrente contínua (`m02-circuitos-cc`)

| # | Aula | Conteúdo | Sim / 3D / Caso |
|---|------|----------|-----------------|
| 02.1 | O circuito elétrico | Fonte, carga, condutor, chave; circuito aberto e curto-circuito | Sim: curto com fusível queimando (efeito visual). Caso: pilha esquentando no bolso com moedas |
| 02.2 | Associação em série | Corrente igual, tensões somam, resistência equivalente | Sim: lâmpadas em série. Caso: pisca-pisca de Natal antigo (queima uma, apagam todas) |
| 02.3 | Associação em paralelo | Tensão igual, correntes somam | Sim: lâmpadas em paralelo. Caso: as tomadas da casa estão em paralelo |
| 02.4 | Circuitos mistos | Simplificação passo a passo, resistência equivalente | Sim com redução animada passo a passo |
| 02.5 | Leis de Kirchhoff | Lei dos nós e das malhas | Sim com amperímetros nos nós e voltímetros nas malhas |
| 02.6 | Divisores de tensão e de corrente | Fórmulas, carga no divisor, potenciômetro | Sim: divisor com NTC/LDR. Caso: luz noturna automática |
| 02.7 | Fontes reais e baterias | Resistência interna, queda sob carga, capacidade (Ah) | Sim: bateria de carro na partida. 3D: bateria automotiva em corte |
| 02.8 | Thévenin, Norton e superposição (A) | Equivalentes e métodos de análise | Sim: comparar circuito original × equivalente |
| 02.9 | Máxima transferência de potência (A) | Casamento de carga | Sim: varredura da carga com gráfico de potência |

### M03 · Medições e instrumentos (`m03-medicoes`)

| # | Aula | Conteúdo | Sim / 3D / Caso |
|---|------|----------|-----------------|
| 03.1 | O multímetro por dentro e por fora | Seletor, bornes COM/VΩ/mA/10A, categorias CAT, fusível interno | 3D: multímetro interativo (girar seletor, trocar pontas de borne) |
| 03.2 | Medindo tensão CC e CA com segurança | Paralelo com o circuito, escala, referência, tomada 127/220 V | Sim + 3D: pontas de prova na bancada virtual. Caso: medir a tomada |
| 03.3 | Medindo corrente | Série com o circuito, erro clássico de medir corrente em paralelo, alicate amperímetro | Sim: o erro queima o fusível do multímetro (virtual). 3D: alicate amperímetro |
| 03.4 | Resistência, continuidade e teste de diodo | Sempre com o circuito desligado; achar fio rompido; testar fusível | Sim: continuidade num cabo com defeito. Caso: fio rompido dentro da parede |
| 03.5 | Osciloscópio | Base de tempo, escala vertical, trigger, ponta ×1/×10 | Sim: osciloscópio virtual com sinais variados |
| 03.6 | Protoboard e fonte de bancada | Trilhas internas, montagem, limite de corrente | 3D: protoboard com trilhas reveladas. Sim: montar e medir |

### M04 · Componentes passivos (`m04-passivos`)

| # | Aula | Conteúdo | Sim / 3D / Caso |
|---|------|----------|-----------------|
| 04.1 | Resistores | Tipos, código de cores, tolerância, potência, SMD | 3D paramétrico (faixas geradas pelo valor). Jogo: ler código de cores |
| 04.2 | Resistores variáveis | Potenciômetro, trimpot, NTC, PTC, LDR | 3D: trimpot (o mesmo da central do portão). Sim: sensores |
| 04.3 | Capacitores | Como armazenam energia, dielétrico, tipos (cerâmico, poliéster, eletrolítico, capacitor de motor), polaridade, tensão nominal | 3D em corte; eletrolítico estufado. Sim: eletrolítico invertido estoura |
| 04.4 | Circuito RC | Carga, descarga, constante de tempo τ | Sim + osciloscópio. Caso: temporizador de luz de escada, fechamento automático do portão |
| 04.5 | Indutores e circuito RL | Indutância, energia no campo, faísca ao abrir carga indutiva | Sim: pico de tensão ao abrir a chave. Caso: por que relé precisa de diodo |
| 04.6 | Fusíveis e proteção | Fusível, I²t, rápido × retardado, fusível automotivo | Sim: fusível rompendo. 3D: fusível de vidro e lâmina |
| 04.7 | Chaves, botões e relés (introdução) | NA, NF, COM; contato seco; botão pulsador × chave com retenção | 3D: relé explodido com armadura animada. Sim: botão aciona relé que acende lâmpada |

## Parte 2 · Eletromagnetismo, corrente alternada e instalações

### M05 · Magnetismo e eletromagnetismo (`m05-magnetismo`)

| # | Aula | Conteúdo | Sim / 3D / Caso |
|---|------|----------|-----------------|
| 05.1 | Ímãs e campo magnético | Polos, linhas de campo, materiais | 3D: linhas de campo calculadas em torno de ímãs |
| 05.2 | Eletroímãs e solenoides | Corrente gera campo, bobina, núcleo | Sim + 3D: eletroímã. Caso: fechadura elétrica do portão social |
| 05.3 | Indução eletromagnética | Faraday e Lenz | 3D: ímã atravessando bobina e gerando tensão no osciloscópio. Caso: dínamo e alternador |
| 05.4 | Transformadores | Relação de espiras, núcleo laminado, perdas, isolamento | 3D: trafo EI explodido. Sim: relação de espiras. Caso: trafo 220 → 12 V de uma central antiga |
| 05.5 | Sensores magnéticos | Reed switch, efeito Hall | 3D: reed (lâminas na ampola de vidro). Sim: ímã se aproximando. Caso: fim de curso do portão, sensor de alarme de porta |
| 05.6 | Relés e contatores em detalhe | Bobina, contatos, selo, intertravamento | Sim: partida com selo e intertravamento. Caso: contator de motor |

### M06 · Corrente alternada (`m06-corrente-alternada`)

| # | Aula | Conteúdo | Sim / 3D / Caso |
|---|------|----------|-----------------|
| 06.1 | Da corrente contínua à alternada | Senoide, frequência, período, 60 Hz no Brasil | 3D: gerador girando ligado a um osciloscópio |
| 06.2 | Pico, eficaz (RMS) e médio | Por que 127 V tem pico de ~180 V | Sim: comparar valores com o osciloscópio |
| 06.3 | Fase e fasores | Defasagem, diagrama fasorial | Interativo: fasores girando sincronizados com as ondas |
| 06.4 | Reatância e impedância | Capacitor e indutor em CA, variação com a frequência | Sim: varrer frequência e ver corrente |
| 06.5 | Potência em CA e fator de potência | Ativa, reativa, aparente, correção | Sim: motor com fator de potência baixo e correção com capacitor |
| 06.6 | Ressonância e filtros (A) | RLC, passa-baixa, passa-alta, diagrama de Bode | Sim: varredura AC com Bode. Caso: divisor de frequências de caixa de som |
| 06.7 | Sistemas monofásico, bifásico e trifásico | Fases, neutro, 127/220 e 220/380 V, por que √3 | 3D: gerador trifásico. Sim: tensões entre fases. Caso: o padrão de entrada de uma casa |

### M07 · Instalações elétricas residenciais (`m07-instalacoes`)

| # | Aula | Conteúdo | Sim / 3D / Caso |
|---|------|----------|-----------------|
| 07.1 | Da rua até a tomada | Padrão de entrada, medidor, quadro de distribuição | 3D: quadro com disjuntores, DR, DPS e barramentos |
| 07.2 | Fase, neutro e terra | Esquemas TN-S e TT, para que serve o terra | Sim: falha de isolação com e sem terra/DR. Caso: choque na máquina de lavar |
| 07.3 | Disjuntores, DR e DPS | Curvas B/C, sobrecarga × curto × fuga | Sim: os três tipos de falha e quem desarma |
| 07.4 | Fios e cabos | Bitola, capacidade de condução, queda de tensão (NBR 5410), cores | Calculadora interativa. Caso: dimensionar o circuito do chuveiro |
| 07.5 | Tomadas e plugues | NBR 14136, 10 A × 20 A, ligação correta | 3D: tomada explodida. Prática: ligar uma tomada |
| 07.6 | Interruptores | Simples, paralelo (three-way), intermediário (four-way) | Sim interativo: montar a ligação e testar. Caso: escada com dois interruptores |
| 07.7 | Iluminação | Incandescente, LED e driver, dimmer, sensor de presença, relé fotoelétrico | Sim: sensor de presença. 3D: lâmpada LED por dentro |
| 07.8 | Chuveiro elétrico por dentro | Resistência, diafragma, chave de temperatura, aterramento | 3D explodido. Caso: trocar a resistência com segurança |

### M08 · Motores elétricos (`m08-motores`)

| # | Aula | Conteúdo | Sim / 3D / Caso |
|---|------|----------|-----------------|
| 08.1 | Motor de corrente contínua | Força num condutor, comutador, escovas, força contraeletromotriz | 3D explodido. Sim: tensão → rotação, carga → corrente. Caso: vidro elétrico do carro |
| 08.2 | Ponte H e PWM | Inverter sentido e controlar velocidade | Sim: ponte H com PWM |
| 08.3 | Motor de indução trifásico | Campo girante, escorregamento, partida | 3D: campo girante animado. Sim: estrela × triângulo |
| 08.4 | Motor monofásico com capacitor | Por que precisa do capacitor, enrolamentos, inversão do sentido, identificar fios com o multímetro | Sim: motor com capacitor (gira, inverte, sem capacitor só zumbe). 3D: motor em corte. Caso: ventilador de teto e motor de portão |
| 08.5 | Passo, servo e brushless | Como funcionam e onde aparecem | 3D de cada um. Caso: impressora 3D, drone, portões com motor CC/inversor |
| 08.6 | Redutores, torque e potência mecânica | Engrenagens, coroa e sem-fim, CV × W, torque × rotação | 3D: redutor coroa e sem-fim. Caso: por que o motor do portão tem redutor |

## Parte 3 · Eletrônica

### M09 · Semicondutores (`m09-semicondutores`)

| # | Aula | Conteúdo | Sim / 3D / Caso |
|---|------|----------|-----------------|
| 09.1 | Semicondutores e junção PN | Dopagem, lacunas, camada de depleção | Animação 2D/3D de portadores |
| 09.2 | Diodo | Curva I×V, polarização, teste com multímetro | Sim: curva característica ao vivo. 3D: 1N4007 |
| 09.3 | Retificadores | Meia onda, onda completa, ponte, filtro capacitivo, ripple | Sim + osciloscópio. Caso: fonte linear de 12 V |
| 09.4 | LEDs | Cor e tensão direta, resistor limitador, brilho | Sim: LED queima sem resistor (efeito 3D). Caso: fita de LED 12 V |
| 09.5 | Diodo Zener e regulação | Tensão de Zener, regulador simples | Sim: regulação com carga variável |
| 09.6 | Transistor bipolar como chave | Corte e saturação, acionar relé, diodo de roda livre | Sim: sem o diodo o pico queima o transistor. 3D: TO-92 |
| 09.7 | Transistor como amplificador (A) | Polarização, ganho, classes | Sim: amplificador emissor comum com osciloscópio |
| 09.8 | MOSFET | Tensão de gate, Rds(on), dissipação, PWM | Sim: fita LED com PWM. 3D: TO-220 com dissipador |
| 09.9 | Tiristores e isolamento | SCR, TRIAC, dimmer, optoacoplador | Sim: dimmer com TRIAC. Caso: centrais que acionam o motor com TRIAC |

### M10 · Fontes de alimentação e energia (`m10-fontes`)

| # | Aula | Conteúdo | Sim / 3D / Caso |
|---|------|----------|-----------------|
| 10.1 | Fonte linear completa | Trafo, ponte, filtro, regulador (78xx, LM317), dissipação | Sim completo. 3D: placa de fonte linear |
| 10.2 | Fontes chaveadas | Buck, boost, flyback (conceito), eficiência | Sim: buck. 3D: carregador de celular por dentro |
| 10.3 | Baterias e nobreak | Chumbo-ácido, Li-ion, carga e cuidados, senoidal × semi-senoidal | Caso: bateria de backup do portão e nobreak |
| 10.4 | Energia solar fotovoltaica | Célula, painel, curva I×V, MPPT, inversor (conceitual) | Sim: curva do painel com sombra |

### M11 · Eletrônica digital (`m11-digital`)

| # | Aula | Conteúdo | Sim / 3D / Caso |
|---|------|----------|-----------------|
| 11.1 | Analógico × digital | Binário, níveis lógicos, ruído | Sim: limiar de entrada |
| 11.2 | Portas lógicas | E, OU, NÃO, OU-exclusivo, álgebra booleana | Sim interativo. Caso: o portão só fecha se a fotocélula estiver livre |
| 11.3 | Pull-up, pull-down e debounce | Entradas flutuantes, trepidação de contato | Sim: trepidação vista no osciloscópio. Caso: entradas da central do portão |
| 11.4 | Flip-flops, contadores e memória | Estado, clock, contagem | Sim |
| 11.5 | O CI 555 | Astável e monostável | Sim. 3D: DIP-8. Caso: pisca-alerta e temporizador |
| 11.6 | Conversão AD/DA e PWM | Resolução, amostragem, PWM como "tensão média" | Sim |

### M12 · Microcontroladores, sensores e automação (`m12-microcontroladores`)

| # | Aula | Conteúdo | Sim / 3D / Caso |
|---|------|----------|-----------------|
| 12.1 | O que é um microcontrolador | GPIO, ADC, PWM, timers, memória | 3D: placa estilo Arduino/ESP32 genérica |
| 12.2 | Máquinas de estado | Como um equipamento "pensa" | Sim: diagrama de estados ao vivo. Caso: lógica da central do portão |
| 12.3 | Sensores | Temperatura, luz, presença (PIR), ultrassom, infravermelho, corrente | Sim de cada um |
| 12.4 | Atuadores | Relé, MOSFET, motores, buzzer | Sim |
| 12.5 | Programando um microcontrolador | Lógica simples num microcontrolador simulado (código editável) | Sim: editar o programa e ver o circuito reagir |
| 12.6 | Automação residencial | ESP32, Wi-Fi, relé inteligente, segurança | Caso: acender a luz pelo celular; módulo Wi-Fi no portão |

### M13 · Comunicação sem fio e controle remoto (`m13-sem-fio`)

| # | Aula | Conteúdo | Sim / 3D / Caso |
|---|------|----------|-----------------|
| 13.1 | Ondas eletromagnéticas | Frequência, comprimento de onda, espectro | 3D: onda se propagando |
| 13.2 | Antenas | Por que 17 cm em 433 MHz (¼ de onda), alcance, obstáculos | Sim: comprimento da antena × alcance. Caso: antena da central do portão |
| 13.3 | Controles remotos | OOK/ASK, code learning, rolling code, clonagem e segurança | Sim: bits sendo transmitidos. Caso: cadastrar e apagar controles |
| 13.4 | Infravermelho, Bluetooth e Wi-Fi | Visão geral e onde cada um aparece | Caso: controle da TV visto pela câmera do celular |

## Parte 4 · Oficina (prática e casos reais)

### M14 · Placas eletrônicas: leitura, montagem e solda (`m14-placas`)

| # | Aula | Conteúdo | Sim / 3D / Caso |
|---|------|----------|-----------------|
| 14.1 | Símbolos e leitura de esquemas | Símbolos, referências (R1, C3, K1), redes | Interativo: esquema ↔ placa 3D (passar o mouse destaca o componente nos dois) |
| 14.2 | Anatomia de uma placa de circuito impresso | Camadas, trilhas, vias, serigrafia, PTH × SMD | 3D: placa em camadas explodidas |
| 14.3 | Identificando componentes numa placa | Bornes, conectores, jumpers, DIP switch, trimpots, LEDs, fusível, relés | 3D: jogo "o que é isso?" numa placa real genérica |
| 14.4 | Jumpers, DIP switches e configuração | Como um jumper muda o comportamento | Sim: jumper alterando a lógica |
| 14.5 | Soldagem e dessoldagem | Temperatura, estanho, fluxo, boa solda × solda fria, segurança | 3D: animação da solda; comparação de juntas |
| 14.6 | Bornes, conectores e emendas | Borne de parafuso, conectores de alavanca, terminais, emendas corretas | 3D de cada tipo |

### M15 · Diagnóstico e manutenção (`m15-diagnostico`)

| # | Aula | Conteúdo | Sim / 3D / Caso |
|---|------|----------|-----------------|
| 15.1 | Método de diagnóstico | Do sintoma à causa, dividir para conquistar, registrar | Sim: "encontre o defeito" num circuito simples |
| 15.2 | Testando componentes | Fusível, resistor, capacitor, diodo, transistor, relé, motor | Sim: bancada com multímetro e componentes bons e ruins |
| 15.3 | Defeitos comuns em placas e fontes | Capacitor estufado, trilha rompida, solda fria, varistor estourado | 3D: placa com defeitos para achar |
| 15.4 | Caso guiado: aparelho que não liga | Roteiro completo de diagnóstico | Sim: diagnóstico passo a passo |

### M16 · Projeto real: automatizador de portão (`m16-portao`)

Este é o módulo de referência do curso. A especificação completa está em [05-portao.md](05-portao.md).

| # | Aula | Conteúdo | Sim / 3D / Caso |
|---|------|----------|-----------------|
| 16.1 | Anatomia de um automatizador | Tipos (deslizante, basculante, pivotante), motor, redutor, pinhão, cremalheira, fim de curso, central, fotocélula, desbloqueio | 3D: portão deslizante completo e motor explodido |
| 16.2 | O motor do portão | Monofásico com capacitor, por que gira para um lado ou outro, identificar comum/abre/fecha com o multímetro | Sim: motor com capacitor ligado à central. Exercício: medir os três fios e descobrir o comum |
| 16.3 | A central por dentro | Fonte, microcontrolador, relés ou TRIACs, receptor, entradas e saídas, bornes | 3D: central genérica com cada bloco destacado. Sim: esquema simplificado |
| 16.4 | Fim de curso e sensores | Reed e ímãs, NA/NF, como a central lê, LEDs indicadores | Sim: portão andando e ímã passando pelo reed |
| 16.5 | Segurança e acessórios | Fotocélula, botoeira, trava, sinaleira, reversão por obstáculo, por que não "jumpear" a fotocélula | Sim: feixe interrompido durante o fechamento |
| 16.6 | Controle remoto e receptor | 433,92 MHz, code learning × rolling code, cadastrar/apagar, antena | Sim: cadastro de controle na central virtual |
| 16.7 | Prática: trocar o motor e a central | Passo a passo completo em modo oficina | Exercício de ligação na bancada 3D com validação e consequências simuladas |
| 16.8 | Ajustes e testes finais | Força, pausa, ímãs, teste de obstáculo e fotocélula | Sim: ajustar trimpots e ver o efeito |
| 16.9 | Diagnóstico de defeitos do portão | Motor zumbe e não gira, portão não para, não fecha, controle sem alcance, central não liga | Sim: cenários com defeito para o aluno descobrir |

### M17 · Mais projetos da vida real (`m17-projetos`)

| # | Aula | Conteúdo | Sim / 3D / Caso |
|---|------|----------|-----------------|
| 17.1 | Ventilador de teto | Ligação com capacitor, velocidades, controle de parede | Sim + 3D |
| 17.2 | Escada com interruptor paralelo e sensor de presença | Projeto completo | Exercício de ligação |
| 17.3 | Fita de LED com fonte e dimmer | Dimensionar fonte, bitola e queda de tensão, PWM | Sim |
| 17.4 | Fechadura elétrica e porteiro eletrônico | Fechadura 12 V, acionamento, interfone | Sim + 3D |
| 17.5 | Sistema elétrico do carro | Bateria, alternador, relés, caixa de fusíveis | Sim + 3D |
| 17.6 | Backup de energia | Nobreak, bateria do portão, kit solar simples | Sim |
| 17.7 | Automatizar uma lâmpada com ESP32 e relé | Projeto completo e segurança | Sim |

---

## Trilhas

Trilhas são caminhos curtos pelo currículo para quem tem um objetivo prático. Ficam em `src/content/trilhas/*.yaml`.

| Trilha | Para quem | Aulas |
|--------|-----------|-------|
| **Portão eletrônico** | Quem vai instalar, trocar ou consertar um automatizador | 00.2, 00.3, 01.2–01.5, 03.1–03.4, 04.3, 04.7, 05.5, 06.1–06.2, 07.2–07.3, 08.4, 08.6, 14.3–14.4, 14.6, M16 inteiro |
| **Eletricista residencial** | Tomadas, interruptores, chuveiro, quadro | M00, M01, 02.1–02.3, 03.1–03.4, 06.1–06.2, 06.7, M07, 17.1–17.2 |
| **Eletrônica maker** | Arduino/ESP32, LEDs, sensores | M00, M01, M02, 03.5–03.6, M04, M09, M11, M12, 17.3, 17.7 |
| **Curso completo** | Todos | M00 → M17 em ordem |

## Mapa de casos reais por tema

| Caso real | Onde aparece |
|-----------|--------------|
| Motor de portão eletrônico | 04.4, 05.5, 08.4, 08.6, 09.9, 11.2, 11.3, 12.2, 13.2, 13.3, M16 |
| Chuveiro elétrico | 00.2, 01.5, 07.4, 07.8 |
| Tomadas, interruptores, quadro | 02.3, 07.1–07.7, 17.2 |
| Fontes e carregadores | 09.3, 10.1, 10.2, 15.3, 15.4 |
| Carro | 02.7, 04.6, 05.3, 08.1, 17.5 |
| Ventilador de teto | 08.4, 17.1 |
| Iluminação LED | 07.7, 09.4, 09.8, 17.3 |
| Automação | 12.2, 12.6, 17.7 |
