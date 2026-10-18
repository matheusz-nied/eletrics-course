/**
 * Workshop of lesson 16.7 (`<Workshop id="trocar-motor-portao" />`): swap
 * the motor and the central of a sliding gate, in the 22 steps of
 * docs/plano/05-portao.md, section 6. Real products, values and norms come
 * only from src/lessons/m16/FONTES.md; the rest is called "típico".
 * Scenes and photos come later, when the 3D gate scene exists.
 */
import { defineWorkshop } from '../../../course/workshop/format';

export default defineWorkshop({
  id: 'trocar-motor-portao',
  title: 'Trocar o motor e a central do portão deslizante',
  summary:
    'Do planejamento ao teste final: escolher o conjunto novo, desligar e confirmar a ausência de tensão, registrar e soltar as ligações antigas, montar o motor, ligar a central na ordem segura, ajustar e testar a segurança. Na primeira vez, tenha um ajudante para segurar o portão e o motor.',
  safety: 'rede',
  duration: '4 a 6 horas na primeira vez',
  tools: [
    'Multímetro com tensão CA (V~), tensão CC (V⎓), resistência (Ω), continuidade e capacitância',
    'Pontas de prova com protetor de dedo, em bom estado',
    'Resistor de 10 kΩ e 5 W com fios isolados e garras, para descarregar o capacitor',
    'Chaves de fenda e Phillips com cabo isolado',
    'Chaves de boca ou soquete para os parafusos do motor e da base',
    'Alicate de corte, desencapador de fios e alicate para terminais',
    'Fita crepe e caneta, para etiquetar os fios',
    'Celular com câmera e lanterna',
    'Cadeado ou trava de disjuntor e um aviso escrito "Não ligue: manutenção no portão"',
    'Óculos de proteção, luvas de trabalho para a parte mecânica e calçado fechado',
  ],
  materials: [
    'Motor novo com a mesma tensão do anterior e potência indicada para o seu portão',
    'Central nova para motor com capacitor (não inversora), com o manual',
    'Capacitor com o valor em µF e a tensão (VCA) pedidos na etiqueta do motor (costuma vir com o motor)',
    'Ímãs e sensor de fim de curso compatíveis com a central (costumam vir no kit)',
    'Terminais tubulares (ponteiras) para os fios flexíveis e conectores de emenda',
    'Fusível reserva do mesmo tamanho e da mesma corrente do fusível da central',
    'Abraçadeiras plásticas, parafusos e buchas para a base do motor e a caixa da central',
  ],
  sections: [
    {
      title: 'Antes de comprar',
      steps: [
        {
          id: 'anotar-e-escolher',
          title: 'Anote os dados do conjunto antigo e escolha o novo',
          text: [
            'Tire uma foto da etiqueta do motor antigo e anote os itens abaixo. Eles decidem o motor e a central que você vai comprar.',
            'O **motor** novo precisa ter a mesma tensão da rede do portão e a potência indicada no manual dele para o peso e o comprimento do seu portão. O pinhão precisa casar com a cremalheira (o mesmo módulo, o tamanho do dente).',
            'A **central** nova precisa ser para motor de indução **com capacitor**: no manual e na placa aparecem os bornes do motor (comum, abre e fecha, com nomes que variam) e o capacitor. Confira também se ela aceita o tipo de fim de curso do motor.',
          ],
          items: [
            'Tensão do motor: 127 V ou 220 V (na etiqueta)',
            'Potência: 1/4, 1/3 ou 1/2 CV (na etiqueta)',
            'Capacitor: valor em µF e tensão em VCA (na etiqueta do capacitor). Típico: 25 a 40 µF em 127 V e 12 a 15 µF em 220 V',
            'Tipo de portão: deslizante, basculante ou pivotante',
            'Peso e comprimento aproximados do portão',
            'Tipo de fim de curso: sensor reed com ímãs, microchave ou encoder',
            'Módulo do dente da cremalheira (leve um pedaço ou uma foto com régua à loja)',
            'Acessórios ligados na central antiga: fotocélula, botoeira, trava, luz de garagem',
          ],
          warning:
            'Centrais **inversoras** acionam o motor com três fios U, V e W, **sem capacitor**, e ajustam a velocidade em hertz (Hz). Elas não são a troca direta de uma central para motor com capacitor. Leia o manual antes de comprar: as letras U, V e W sozinhas não bastam, porque há central para motor com capacitor que também usa esses nomes.',
          tip: 'Comprar motor e central do mesmo kit evita surpresa com o fim de curso e com o conector do sensor.',
        },
        {
          id: 'conferir-disjuntor-e-terra',
          title: 'Confira o disjuntor do portão e o terra',
          text: [
            'No quadro, ache o disjuntor que alimenta o portão e veja se ele está identificado. O ideal é um circuito só do portão, com disjuntor próprio e DR. Manuais de automatizador pedem DR e uma instalação conforme a NBR 5410, com disjuntor, um jeito de desligar só o automatizador (o seccionamento) e cabos adequados.',
            'Na central antiga, veja se há um fio de terra (verde ou verde e amarelo) no borne de terra e se ele vai até a carcaça do motor.',
          ],
          measure: {
            what: 'Tensão entre F e N, entre F e o terra e entre N e o terra, na entrada da central antiga',
            expected:
              'Típico numa rede de 127 V: F–N e F–terra perto de 127 V; N–terra perto de 0 V (poucos volts). Em 220 V entre duas fases: F–N perto de 220 V e cada fase com o terra perto de 127 V. F–terra bem menor que F–N, ou instável, indica terra ausente ou mal ligado.',
            how: 'Esta medição é feita com o circuito ligado. Multímetro em V~, numa escala acima de 220 V. Segure as pontas pelo protetor de dedo e encoste só nos parafusos dos bornes. Se não se sentir seguro, peça a um eletricista.',
          },
          warning:
            'Sem disjuntor próprio, sem terra ou com cabos ressecados, chame um eletricista habilitado antes de trocar o automatizador.',
        },
      ],
    },
    {
      title: 'Desmontar',
      steps: [
        {
          id: 'deixar-portao-seguro',
          title: 'Deixe o portão parado numa posição segura e avise a casa',
          text: [
            'Leve o portão até uma posição em que ninguém precise passar por ele durante o serviço e deixe-o parado. Tire o carro antes, se for preciso.',
            'Avise quem mora na casa que o portão vai ficar sem automação por algumas horas e que ninguém deve apertar o controle nem a botoeira.',
          ],
        },
        {
          id: 'desligar-e-sinalizar',
          title: 'Desligue o disjuntor do portão e sinalize o quadro',
          text: 'Desligue o disjuntor do portão. Trave a alavanca com um cadeado ou uma trava de disjuntor, se tiver, e cole o aviso escrito no quadro, para ninguém religar enquanto você trabalha.',
          tip: 'Se a central tiver bateria ou nobreak próprio, desconecte também, depois do disjuntor: ela mantém a placa energizada mesmo com a rede desligada.',
        },
        {
          id: 'testar-ausencia-de-tensao',
          title: 'Teste o multímetro, meça a ausência de tensão e teste de novo',
          text: 'Primeiro, prove que o multímetro funciona numa tomada energizada. Depois meça a central. Por fim, volte à tomada: se o instrumento continuar medindo, o zero na central era verdadeiro.',
          measure: {
            what: 'Tensão entre F e N, entre F e o terra e entre N e o terra, nos bornes da central',
            expected:
              '0 V nos três pares. Na tomada, antes e depois, perto de 127 V (ou 220 V, conforme a rede). Algumas décimas de volt são ruído; acima de alguns volts, pare e descubra de onde vem a tensão.',
            how: 'Multímetro em V~, numa escala acima de 220 V. Tomada, central e tomada de novo, sem mudar o seletor entre uma medição e outra.',
          },
          warning:
            'Se aparecer tensão na central com o disjuntor desligado, o disjuntor desligado não é o do portão (ou há outra alimentação). Não mexa em nada até descobrir.',
        },
        {
          id: 'fotografar-e-etiquetar',
          title: 'Fotografe a placa e etiquete cada fio',
          text: [
            'Fotografe a central de longe, para ver a placa inteira, e de perto, cada fileira de bornes, com o nome de cada borne legível. Fotografe também os jumpers, as chaves DIP e a posição dos trimpots.',
            'Antes de soltar qualquer fio, enrole nele um pedaço de fita crepe com o nome do borne em que ele está, do jeito que está escrito na placa antiga.',
          ],
          items: [
            'Rede: fase, neutro e terra',
            'Motor: comum, abre e fecha (e os fios do capacitor)',
            'Fim de curso: o conector ou os fios do sensor',
            'Fotocélula: alimentação e saída do receptor',
            'Botoeira, trava e luz de garagem',
          ],
          tip: 'Os nomes mudam de marca para marca. Em algumas centrais a mesma letra aparece em dois lugares (F de fase e F de fechar). Etiquete com o nome que está na placa antiga e, depois, anote o borne equivalente da central nova pelo manual.',
        },
        {
          id: 'descarregar-capacitor',
          title: 'Descarregue o capacitor',
          text: 'Um capacitor de motor pode guardar carga depois que a rede é desligada, principalmente se estiver solto ou com um fio desligado. Meça antes de tocar nos terminais e, se houver tensão, descarregue pelo resistor.',
          measure: {
            what: 'Tensão CC entre os terminais do capacitor',
            expected:
              'Abaixo de 5 V antes de tocar. Um capacitor de 40 µF que ficou com 180 V cai abaixo de 5 V em cerca de 1,5 s com o resistor de 10 kΩ encostado.',
            how: 'Multímetro em V⎓ (CC). Encoste as garras do resistor de 10 kΩ, 5 W, nos dois terminais por alguns segundos, segurando só pelas partes isoladas, e meça de novo.',
          },
          warning:
            'Não descarregue o capacitor em curto com uma chave de fenda: a faísca marca a ferramenta, pode danificar o capacitor e espirrar pedacinhos de metal.',
        },
        {
          id: 'soltar-e-testar-a-mao',
          title: 'Solte as ligações, a central e o motor e teste o portão à mão',
          text: [
            'Solte primeiro fase e neutro e isole as pontas com conectores ou fita isolante. Depois solte o motor, o capacitor e os fios de baixa tensão. O terra sai por último.',
            'Abra o desbloqueio, solte o motor da base com a ajuda de outra pessoa e corra o portão à mão de uma ponta à outra.',
          ],
          warning:
            'Se o portão não corre leve à mão, o problema é mecânico (trilho, roldanas, portão desalinhado). Um motor novo não resolve isso: conserte antes de montar.',
        },
      ],
    },
    {
      title: 'Montar',
      steps: [
        {
          id: 'fixar-motor-e-alinhar-pinhao',
          title: 'Fixe o motor e alinhe o pinhão com a cremalheira',
          text: [
            'Fixe o motor na base com o desbloqueio aberto. O pinhão tem que ficar alinhado com a cremalheira, com uma folga pequena entre os dentes (siga o valor do manual do motor).',
            'O peso do portão não pode ficar apoiado no pinhão: quem carrega o portão são as roldanas no trilho. Corra o portão à mão de ponta a ponta e confira que os dentes não apertam nem escapam em nenhum ponto.',
          ],
          tip: 'Se a folga muda muito ao longo do percurso, a cremalheira está torta ou mal fixada. Acerte antes de continuar.',
        },
        {
          id: 'identificar-fios-do-motor',
          title: 'Identifique COMUM, ABRE e FECHA com o multímetro',
          text: 'Com os três fios do motor soltos, meça a resistência dos três pares. A cor do fio comum muda de fabricante para fabricante (amarelo, azul, preto…), então a medida decide, e o manual confirma.',
          measure: {
            what: 'Resistência entre os três pares de fios do motor',
            expected:
              'A maior leitura é entre as duas pontas dos enrolamentos (ABRE–FECHA). O fio que fica de fora desse par é o COMUM. As outras duas leituras ficam perto da metade da maior. Estimativa para 1/4 CV: 3 a 7 Ω por enrolamento em 127 V e 7 a 14 Ω em 220 V. Perto de 0 Ω indica curto; OL, enrolamento aberto.',
            how: 'Multímetro em Ω. Encoste uma ponta na outra antes (deve dar perto de 0 Ω). Meça fio 1–fio 2, fio 1–fio 3 e fio 2–fio 3 e anote.',
          },
          tip: 'Qual das duas pontas é ABRE e qual é FECHA não aparece na medida: os dois enrolamentos são iguais. Quem decide é o primeiro teste, no passo 17.',
        },
        {
          id: 'ligar-terra-motor-capacitor',
          title: 'Ligue o terra, o motor e o capacitor',
          text: 'Com o disjuntor ainda desligado, ligue nesta ordem e aperte cada borne com firmeza, sem cobre aparente para fora do borne. Em fio flexível, use terminal tubular.',
          items: [
            'Terra na carcaça do motor e no borne de terra (⏚) da central',
            'Fio comum no borne COM',
            'As duas pontas dos enrolamentos nos bornes ABRE e FECHA',
            'Capacitor nos dois bornes CAP (ele não tem polaridade)',
          ],
          warning:
            'Use o capacitor com o valor em µF e a tensão em VCA pedidos na etiqueta do motor. Capacitor de outro valor faz o motor perder força ou esquentar.',
        },
        {
          id: 'ligar-fim-de-curso',
          title: 'Ligue o fim de curso e posicione os ímãs',
          text: [
            'Encaixe o conector do sensor de fim de curso (FCA, GND e FCF) na central, no lado certo, conforme o manual.',
            'Prenda os ímãs na cremalheira perto das duas pontas do percurso: cada um deve passar pelo sensor poucos centímetros antes de o portão chegar ao batente. O ajuste fino é no passo 18.',
          ],
        },
        {
          id: 'ligar-fotocelula-e-botoeira',
          title: 'Ligue e alinhe a fotocélula; ligue a botoeira',
          text: [
            'Ligue o receptor da fotocélula em +12V, GND e FOTO, e o transmissor na alimentação, conforme o manual. Monte os dois na mesma altura, um de frente para o outro, nos pilares.',
            'Ligue a botoeira (o botão interno ou do interfone) entre BOT e GND.',
          ],
          items: [
            'Confira se a entrada de fotocélula da sua central espera contato NF ou NA (na CD-1 do curso, NF)',
            'A soma do consumo dos acessórios precisa caber na fonte auxiliar da central (na CD-1, 300 mA)',
            'Passe os fios de baixa tensão longe dos fios da rede e do motor',
          ],
          warning:
            'Não coloque jumper nem fio no lugar da fotocélula para "testar sem ela". Os manuais das centrais tratam a fotocélula como obrigatória.',
        },
        {
          id: 'configurar-para-o-primeiro-teste',
          title: 'Configure jumpers, DIP e trimpots para o primeiro teste',
          items: [
            'J1 FOTO retirado: a fotocélula funcionando',
            'J2 AUT retirado nos primeiros testes: o portão só fecha quando você mandar (você coloca o J2 no passo 19)',
            'DIP INV desligado e DIP LUZ como você preferir',
            'Trimpot PAUSA no meio',
            'Trimpot FORÇA no meio: ponto de partida, ajustado no passo 19',
          ],
          tip: 'Em centrais com menu em vez de trimpots, procure no manual os itens equivalentes (pausa, força ou embreagem, sentido).',
        },
        {
          id: 'revisar-e-ligar-rede',
          title: 'Revise as ligações e, por último, ligue F e N',
          text: 'Confira cada fio contra as fotos, as etiquetas e o manual da central nova. Só no fim, ainda com o disjuntor desligado, ligue a fase em F e o neutro (ou a segunda fase, em 220 V entre fases) em N.',
          items: [
            'Cada fio no borne certo, bem apertado, sem fio solto nem fiapo de cobre',
            'Terra ligado na central e na carcaça do motor',
            'Capacitor nos bornes CAP',
            'Fios de baixa tensão longe dos fios da rede',
            'Nenhuma ferramenta, parafuso ou pedaço de fio sobre a placa',
          ],
        },
      ],
    },
    {
      title: 'Testar e ajustar',
      steps: [
        {
          id: 'energizar-e-conferir-leds',
          title: 'Trave o desbloqueio, ligue o disjuntor e confira os LEDs',
          text: [
            'Deixe o portão no meio do percurso, longe das duas pontas, e trave o desbloqueio. Assim o primeiro teste mostra o sentido sem o portão bater em nada.',
            'Tire o aviso, ligue o disjuntor e olhe a placa sem tocar nela.',
          ],
          measure: {
            what: 'LEDs da central',
            expected:
              'REDE aceso. FOTO aceso com o feixe livre. Com um ímã encostado no sensor de fim de curso, o LED FCA ou FCF acende; sem o ímã, apaga.',
            how: 'Encoste o ímã reserva no sensor, por fora da tampa do motor, sem mexer nos bornes da central.',
          },
          warning:
            'Se o LED REDE não acender, ou se algo esquentar, cheirar a queimado ou estalar, desligue o disjuntor e revise as ligações antes de tentar de novo.',
        },
        {
          id: 'primeiro-comando-abre',
          title: 'Dê o primeiro comando: o portão tem que abrir',
          text: [
            'Com o portão no meio, a central não sabe onde ele está, e o primeiro comando é sempre de abrir. Fique com o controle ou a botoeira na mão: um comando durante o movimento para o portão.',
            'Se o portão **fechar**, pare o movimento, desligue o disjuntor, confirme a ausência de tensão e troque os fios ABRE e FECHA de borne. Outra saída é ligar o DIP INV, também com o disjuntor desligado.',
          ],
          tip: 'Trocar ABRE com FECHA funciona porque o sentido depende de qual enrolamento recebe a fase direto e qual recebe pelo capacitor.',
        },
        {
          id: 'conferir-fins-de-curso',
          title: 'Confira que o portão para nos dois fins de curso',
          text: [
            'Abra o portão até o fim: ele tem que parar pelo fim de curso, poucos centímetros antes do batente, com o LED FCA aceso. Depois feche e confira o mesmo do outro lado, com o LED FCF.',
            'Se o portão bate no batente antes de parar, ou para longe dele, desligue o disjuntor, solte o ímã daquela ponta, mova-o um pouco na cremalheira e teste de novo.',
          ],
        },
        {
          id: 'ajustar-forca-e-pausa',
          title: 'Ajuste a FORÇA e a PAUSA',
          text: [
            '**FORÇA**: gire para baixo e depois suba aos poucos, abrindo e fechando a cada ajuste, até o portão fazer o percurso inteiro, nos dois sentidos, sem parar sozinho. Então suba só um pouco mais, para ter folga. Use chave de fenda isolada e uma mão só: os trimpots ficam perto dos bornes da rede.',
            '**PAUSA**: com o disjuntor desligado, coloque o J2 AUT; depois ligue e ajuste o tempo que o portão espera aberto antes de fechar sozinho. Na CD-1, de 0 a 120 s; no mínimo, o fechamento automático fica desligado.',
          ],
          warning:
            'FORÇA alta demais faz o portão empurrar com mais força uma pessoa, um animal ou um carro antes de reverter. Use a menor que move o portão com folga.',
          tip: 'Em algumas centrais o ajuste de força é ao contrário (número menor = mais força). Confira no manual.',
        },
        {
          id: 'cadastrar-controles',
          title: 'Cadastre os controles',
          text: [
            'Toque no botão PROG: o LED PROG acende. Aperte o botão do controle em até 10 s: o LED pisca três vezes, e o controle está gravado. Repita para cada controle da casa.',
            'Se a central já foi usada em outro lugar, apague a memória antes: segure o PROG por 10 s até o LED piscar rápido e o buzzer apitar.',
          ],
          tip: 'Teste cada controle da calçada, longe da central, para conferir o alcance.',
        },
        {
          id: 'testar-seguranca',
          title: 'Teste a fotocélula, a reversão por obstáculo e o desbloqueio',
          items: [
            'Fotocélula: durante o fechamento, interrompa o feixe com uma caixa. O portão tem que voltar a abrir. Com o portão aberto e o feixe interrompido, ele não pode fechar',
            'Obstáculo no fechamento: deixe um objeto macio (uma almofada dobrada, um bloco de espuma) no caminho e mande fechar. Ao encostar, o portão tem que voltar a abrir',
            'Obstáculo na abertura: segure a folha do portão pelo meio, do lado de fora, longe do pilar, do pinhão e da cremalheira. O portão tem que parar',
            'Desbloqueio: desligue o disjuntor, abra o desbloqueio, corra o portão à mão e trave de novo',
          ],
          warning:
            'Nunca teste a reversão com o corpo, com a mão entre o portão e o pilar, nem com pessoa ou animal no caminho. Se um teste falhar, o portão não está pronto: desligue e corrija antes de liberar o uso.',
        },
        {
          id: 'fechar-e-guardar',
          title: 'Feche as tampas e guarde o manual e as fotos',
          text: [
            'Fotografe a central nova ligada, feche as tampas da central e do motor e confira as vedações contra chuva.',
            'Guarde o manual, as fotos das ligações antigas e novas e um papel com os ajustes (FORÇA, PAUSA, DIP) e a data. Mostre a quem mora na casa como usar o desbloqueio numa falta de energia.',
          ],
        },
      ],
    },
  ],
});
