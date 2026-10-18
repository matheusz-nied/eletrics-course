# Fontes do módulo do portão (M16)

Pesquisa feita em 17/10/2026 nos manuais públicos dos fabricantes, para basear a central genérica CD-1, os valores típicos das aulas e a aula "Do genérico para a sua central". As marcas aparecem só no texto das aulas; nenhuma vai para o 3D.

## Como foi feito

- Os PDFs foram lidos pela ferramenta de leitura da web (o download direto dos sites dos fabricantes foi bloqueado). Por isso as citações podem estar encurtadas e as páginas podem estar deslocadas em 1.
- Só entrou nas aulas o que o manual diz. Onde é dedução nossa, a aula diz que é dedução.
- Dois manuais da lista inicial não puderam ser lidos (PPA Triflex Full Range Display REV5 e Garen Central Universal). Usamos outros manuais das mesmas marcas.
- As notas completas da leitura, central por central e motor por motor, com página e citação, estão em [`PESQUISA.md`](PESQUISA.md). Este arquivo é o resumo. Os detalhes de cada central nas aulas 16.4, 16.6 e 16.10 (distância dos ímãs, memória de controles, como cadastrar e apagar, LEDs, faixas de pausa e de força, tempos máximos) saem de lá.

## Centrais lidas

| Central | Tipo | Manual |
|---|---|---|
| Intelbras CP-1000 / CP-1001 (firmware 3.5.x ou maior) | Motor com capacitor | [manual](https://backend.intelbras.com/sites/default/files/2026-08/Manual%20de%20Usu%C3%A1rio%20e%20Programa%C3%A7%C3%A3o%20Central%20Padr%C3%A3o%20Automatizador%20Port%C3%A3o%20CP-1000%20-%20Vers%C3%B5es%20Acima%20de%203.5.x%2008-26_0.pdf) |
| Peccinin (Nice) CP 4010F / CP 4020F, Rev. 06 | Motor com capacitor | [manual](https://niceforyou.com/sites/default/files/upload/manuals/30004081-MANUAL-DE-CONFIGURACAO-CP4010F-4020F-Rev-06.pdf) |
| Nice Pro S10, Rev. 03 | Motor com capacitor | [manual](https://www.niceforyou.com/sites/default/files/2026-08/MANUAL-COMPLETO-CENTRAL-NICE-PRO-S10-110826.pdf) |
| Omegasat CT30A, Rev. 00 (hospedado no site da Nice; a marca no texto é Omegasat) | Motor com capacitor | [manual](https://niceforyou.com/sites/default/files/upload/manuals/30010120-MANUAL-INST-CENTRAL-CT30A-OMS-Rev-00.pdf) |
| Rossi Bi KXH1024FS Fail Safe, Rev. F | Motor com capacitor | [manual](https://www.rossiportoes.com.br/upload/arquivos/Central%20BIKXH_1024%20Rev.F%20-%20PT.pdf) |
| Garen Wave Connect | Motor com capacitor | [manual](https://docs.garen.com.br/manuais/MANUAL_CENTRAL_WAVE_CONNECT.pdf) |
| Garen TSi Pro / TSi Pro Max | **Inversora**, sem capacitor | [manual](https://docs.garen.com.br/manuais/manual_central_tsi_pro.pdf) |
| PPA Facility Connect, P04640 Rev. 5 | Motor com capacitor | [manual](https://media.ppa.com.br/files/P04640_Central_FacilityConnect_REV5_1681484102895.pdf) |
| PPA Triflex Full Range, P30906 Rev. 10 | **Inversora**, sem capacitor | [manual](https://media.ppa.com.br/files/P30906_Manual_Triflex_Full_Range_REV10_1770812221431.pdf) |

## Motores lidos

| Motor | O que trouxe | Manual |
|---|---|---|
| Garen KDZ (linha 1/4, 1/3, 1/2 CV), Rev. 09 | Capacitor em µF por tensão, corrente, potência, velocidade, protetor térmico | [manual](https://garen.com.br/wp-content/uploads/2024/07/Manual_livreto-KDZ-digital-port_esp_mult-rev09.pdf) |
| PPA DZ Stark Home (datasheet) | Capacitor em µF por tensão, rotação, tempo em 3 m | [datasheet](https://files.irroba.com.br/acreaaoi/download/a65ef3559542b50f6535db1163eb99b1.datasheet_dz-stark-home_1732912770840.pdf) |
| PPA DZ Stark, manual técnico P33096 | Potência, corrente, velocidade; fotocélula como "opcional" | [manual](https://files.irroba.com.br/acreaaoi/download/2d39189036fe0eb8dd101fc23a4e41a7.p33096_tecnico_dzstark_rev0_1696938407875.pdf) |
| PPA DZ Hub, P08663 | Potência, corrente; DR e cabos | [manual](https://files.irroba.com.br/acreaaoi/download/65920c602d09a2b78918649b5e955d7d.p08663_tecnico_dzhub_rev0_1679057533927.pdf) |
| Intelbras deslizantes DR/DC/DZ, v01 01-25 | Potência, ciclos; fotocélula obrigatória; NR-10 e NR-35 | [manual](https://backend.intelbras.com/sites/default/files/2025-05/Manual_Portao_deslizante_completo_v01_01-25_site%201.pdf) |
| Omegasat KAZA, Rev. 07 | Corrente, rotação, protetor 150 °C | [manual](https://niceforyou.com/sites/default/files/upload/manuals/30007737-MANUAL-INST-DESL-KAZA-OMS-Rev-07.pdf) |
| Omegaport DZ 1000 | Cores dos fios (comum azul), protetor 130 °C | [manual](https://niceforyou.com/sites/default/files/upload/manuals/30006663-MANUAL-INST-DESL-1000-OMS.pdf) |
| Peccinin deslizantes, Rev. 04 | Velocidade, Portaria Inmetro 371:2009 | [manual](https://niceforyou.com/sites/default/files/upload/manuals/30003935-MANUAL-DE-INSTALACAO-DESLIZANTES-Rev-04.pdf) |
| Rossi linha deslizante DZ, Rev. 03/17 (hospedado por revendedor) | Ligação U/V/W, NBR 5410, cabo e seccionador | [manual](https://www.sistemaqtecnologia.com.br/anexos/70aa562857529d2dfc475d1fd9b1c3ad.pdf) |

## O que o curso usa

### Valores típicos (sempre chamados de "típico" nas aulas)

| Grandeza | Valor no curso | De onde vem |
|---|---|---|
| Capacitor do motor, 127 V | 25 a 40 µF | Garen KDZ (30, 35 e 40 µF), PPA DZ Stark Home (25 e 35 µF) |
| Capacitor do motor, 220 V | 12 a 15 µF | Garen KDZ (12 e 15 µF), PPA DZ Stark Home (12 e 15 µF) |
| Tensão do capacitor (VCA) | Não citamos número | Nenhum manual imprime; a aula manda ler a etiqueta do próprio capacitor |
| Corrente do motor, 1/4 a 1/2 CV | cerca de 2 a 5 A | Garen KDZ (3,05 A a 5,06 A em 127 V; 2,2 A a 3,08 A em 220 V), PPA DZ Stark (2,1 a 3,7 A) |
| Velocidade do portão | cerca de 13 a 23 m/min (o simulador usa 15 m/min) | Garen KDZ (15,78 a 23,35 m/min), PPA DZ Stark (13,3 a 17,1 m/min), Peccinin LIGHT (15 m/min) |
| Protetor térmico do motor | 130 °C a 150 °C | Garen KDZ e Omegasat KAZA (150 °C), Omegaport DZ 1000 (130 °C) |
| Pausa do fechamento automático | até 120 s | Peccinin "FCH.AUTO" 0 a 120 s, Omegasat "PAUSA" até 120 s, Garen 0 a 120 s, Intelbras 2 a 120 s |
| Tempo máximo de percurso | 40 s na CD-1 | Omegasat CT30A (40 s); outras usam 90 s (Nice Pro S10), 60 s (PPA) ou 4 vezes o percurso aprendido (Intelbras) |
| Fonte auxiliar para fotocélula | 12 Vcc, 300 mA na CD-1 | Intelbras e Rossi (300 mA), Omegasat (500 mA), Peccinin e Nice Pro S10 (700 mA) |
| Fusível da central | 10 A na CD-1 | Intelbras e Garen TSi Pro (10 A); Peccinin e Garen Wave Connect (5 A) |
| Rádio | 433,92 MHz | Todas as que informam |
| Antena de fio | cerca de 17 cm | Peccinin (17 cm), Rossi (16 cm) |

### Resistência dos enrolamentos: estimativa, não dado de fabricante

Nenhum manual informa a resistência dos enrolamentos em ohms, e as buscas em fóruns não trouxeram valores confiáveis de motores brasileiros. O curso usa uma **estimativa** de ordem de grandeza, e as aulas dizem isso:

- Motor de 1/4 CV em 127 V: cerca de 3 a 7 Ω por enrolamento.
- O mesmo motor em 220 V: cerca de 7 a 14 Ω por enrolamento.

A conta: perdas no cobre de 10 % a 20 % da potência de entrada, com os dados do Garen KDZ FIT RAMP (310 W e 3,05 A em 127 V; 415,8 W e 2,46 A em 220 V), e $R \approx P_\text{cobre} / I^2$. O que importa para o aluno não é o número exato, e sim o método: a maior leitura é entre as pontas, o fio que sobra é o comum, as outras duas leituras são parecidas, zero indica curto e OL indica enrolamento aberto.

### Fatos que as aulas ensinam

- **Dois tipos de central.** A maioria das centrais residenciais é para motor de indução monofásico com capacitor (três fios e dois bornes de capacitor). As centrais inversoras (Garen TSi Pro, PPA Triflex Full Range) acionam motores de três fios U/V/W **sem capacitor**, com a velocidade em Hz. A Garen manda retirar o capacitor quando se usa motor monofásico na TSi Pro. Trocar o motor sem conferir o tipo da central não funciona.
- **Nomes dos bornes do motor variam:** `C`/`A`/`F` (Intelbras), `C1`/`A1`/`F1` (Peccinin), `COMUM`/`ABRE`/`FECHA` (Nice Pro S10), `CM`/`AB`/`FC` (Omegasat), `U`/`V`/`W` com U = comum (Rossi), `BR`/`AZ`/`PT` (Garen Wave Connect). Na Intelbras, a letra `F` aparece para a fase da rede e para o fio de fechamento do motor, em bornes diferentes.
- **Cor do fio comum varia:** amarelo (Intelbras, Rossi, PPA), azul (Omegaport DZ 1000), preto (Omegasat CT30A). Por isso a aula manda medir.
- **Inverter o sentido:** todas mandam trocar os fios de abrir e fechar (A↔F, V↔W, PT↔BR); algumas mandam também inverter o conector do fim de curso (Garen). A PPA manda desligar a central antes. A Garen TSi Pro tem também a função SENTIDO.
- **Fim de curso:** reed com ímã é o padrão; Peccinin e Nice Pro S10 só aceitam reed NA. Há também sensor Hall (Rossi) e encoder (PPA, Garen TSi).
- **Fotocélula:** a maioria das centrais tem entrada **NA** (Intelbras, Peccinin, Nice Pro S10, Omegasat). A Rossi com Fail Safe ligado exige contato **NF** e testa a fotocélula. A CD-1 usa NF de propósito, para ensinar por que um fio partido deve parar o portão.
- **Fotocélula é obrigatória** segundo Intelbras, Peccinin, Nice, Omegasat, Garen, PPA Triflex e Rossi. Só os manuais técnicos de motor PPA DZ Stark, DZ Hub e DZ Home a chamam de "opcional". **Nenhum manual descreve um jumper para dispensar a fotocélula.** Onde a entrada é NA, a central funciona sem nada ligado ali (dedução nossa), o que torna fácil instalar sem fotocélula; as aulas explicam por que não fazer isso. O jumper `J1 FOTO` da CD-1 representa esse "atalho" para ser discutido, e não um item comum das placas atuais.
- **Força:** trimpot "FORÇA" (Omegasat), "EMBR." (Peccinin), menu "Emb" (Intelbras, onde o valor menor dá **mais** força), níveis de 5 % a 100 % (Garen), 14 níveis (PPA). Peccinin e PPA mandam conferir segurando o portão.
- **Controles:** cadastro por botão (LEARN, PROG, APRENDER, TX, GRV) ou menu; apagar tudo segurando o botão. Code learning (Omegasat), rolling code (Peccinin, PPA), HCS (Rossi), FSK com AES de 128 bits (Intelbras).

### Normas e leis citadas pelas fontes

As aulas citam só o que as fontes citam, sem inventar número de item:

- NBR 5410 (instalações elétricas de baixa tensão): Rossi e Garen, para seccionamento, disjuntor e cabos.
- NBR NM 247-3, NBR NM 247-5 e IEC 60245-57 (cabos): manuais de motor PPA.
- Portaria Inmetro 371/2009 (certificação compulsória): Peccinin e Omegaport.
- NR-10 e NR-35 (segurança do trabalhador em eletricidade e em altura): Intelbras.
- DR de 30 mA: os manuais PPA pedem DR, mas o texto diz "excedendo 30 mA", provável erro de impressão. A aula fala em DR sem copiar essa frase.

Nenhuma fonte cita uma NBR específica de automatizadores de portão.

## Equivalência para a aula "Do genérico para a sua central"

As tabelas da aula 16.10 saem deste levantamento e das seções de cada central em `PESQUISA.md`. Quando uma informação não está no manual, a tabela diz "o manual não informa".

## Lacunas para aprofundar

- Resistência real dos enrolamentos: medir motores de 127 V e 220 V e registrar aqui.
- Tensão nominal (VCA) dos capacitores de motor por fabricante.
- Manuais encontrados e ainda não lidos: Intelbras CP-1000 (firmware 3.2.10 e 3.3.2), PPA Triflex V2, PPA DC 24 V Linea, Omegasat CT22A, Peccinin CP1050F/3050F e S-Board, Garen Fit Ramp, fotocélula PPA F10.
