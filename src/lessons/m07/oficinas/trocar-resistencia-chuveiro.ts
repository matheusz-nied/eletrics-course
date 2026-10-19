/**
 * Workshop of lesson 7.8 (`<Workshop id="trocar-resistencia-chuveiro" />`):
 * replace the heating element of an electric shower, in the safe order of
 * the lesson. Generic: the way a shower opens and the element fits change
 * from model to model, so the steps send the student to the manual for
 * those details and keep the safety steps fixed.
 */
import { defineWorkshop } from '../../../course/workshop/format';

export default defineWorkshop({
  id: 'trocar-resistencia-chuveiro',
  title: 'Trocar a resistência do chuveiro',
  summary:
    'Desligar o circuito do chuveiro no quadro, confirmar a ausência de tensão, trocar a resistência queimada por uma igual e religar só depois de a água encher o chuveiro. Leve o manual do chuveiro (ou procure o do seu modelo) e, se o chuveiro tiver sinal de queimado nos fios ou nos contatos, chame um eletricista.',
  safety: 'rede',
  duration: '30 minutos a 1 hora',
  tools: [
    'Multímetro com tensão CA (V~), em bom estado, ou detector de tensão testado',
    'Chave de fenda e chave Phillips com cabo isolado',
    'Escada firme, que não balance no piso molhado',
    'Fita isolante ou um aviso escrito "Não ligue: manutenção no chuveiro"',
    'Lanterna ou celular com lanterna',
  ],
  materials: [
    'Resistência nova indicada pelo fabricante para o seu modelo, com a mesma tensão (127 V ou 220 V) e a mesma potência do chuveiro',
    'Diafragma reserva, se o seu estiver ressecado ou furado',
  ],
  sections: [
    {
      title: 'Antes de abrir',
      steps: [
        {
          id: 'ler-etiqueta',
          title: 'Leia a etiqueta e compre a resistência certa',
          text: [
            'Na etiqueta do chuveiro (ou no manual) estão o modelo, a **tensão** e a **potência**. A resistência nova precisa ser a do modelo, com os mesmos dois números. Leve a antiga ou uma foto dela à loja.',
            'Resistência de 127 V num chuveiro de 220 V puxa mais do que o circuito aguenta e queima; a de 220 V num chuveiro de 127 V deixa o banho frio.',
          ],
          warning:
            'Não troque por uma resistência "mais forte" para esquentar mais. Mais potência quer dizer mais corrente, e o fio e o disjuntor do circuito foram escolhidos para a potência original.',
        },
        {
          id: 'desligar-disjuntor',
          title: 'Desligue o disjuntor do chuveiro no quadro',
          text: [
            'A chave do chuveiro na posição desligado **não** basta: ela pode cortar só um dos fios, e o diafragma não é proteção. Desligue no quadro o disjuntor do circuito do chuveiro.',
            'Se o quadro não tiver identificação, desligue o disjuntor geral.',
          ],
        },
        {
          id: 'sinalizar',
          title: 'Sinalize o quadro',
          text: 'Cole um aviso no quadro ou prenda a alavanca com fita: "Não ligue: manutenção no chuveiro". Avise as pessoas da casa.',
        },
        {
          id: 'testar-ausencia',
          title: 'Teste a ausência de tensão',
          text: [
            'Primeiro teste o multímetro numa tomada que está ligada: ele precisa mostrar perto de 127 V ou 220 V. Depois meça nos fios do chuveiro.',
            'Volte à tomada e meça de novo, para ter certeza de que o multímetro continua bom.',
          ],
          measure: {
            what: 'Tensão CA entre os dois fios do chuveiro e entre cada um deles e o fio terra',
            expected: '0 V nas três medições',
            how: 'Multímetro em V~, numa escala acima de 220 V. Encoste as pontas só nos bornes ou nas pontas dos fios, segurando pelo protetor de dedo.',
          },
          warning:
            'Se marcar qualquer tensão, pare. Você desligou o disjuntor errado, ou o circuito tem outra alimentação. Chame um eletricista.',
        },
      ],
    },
    {
      title: 'Trocar',
      steps: [
        {
          id: 'fechar-registro',
          title: 'Feche o registro e abra o chuveiro',
          text: [
            'Feche o registro para a água não escorrer enquanto você trabalha. Abra o chuveiro do jeito que o manual mostra: muitos modelos soltam o espalhador ou a tampa de baixo girando ou soltando parafusos.',
            'Repare como a resistência velha está encaixada e tire uma foto antes de soltar.',
          ],
        },
        {
          id: 'olhar-contatos',
          title: 'Olhe os contatos e o diafragma',
          text: 'Contatos escurecidos, plástico derretido ou fios com a isolação queimada perto dos bornes mostram mau contato e aquecimento. Nesse caso, trocar só a resistência não resolve.',
          warning:
            'Bornes derretidos ou fio queimado: não religue. Chame um eletricista para conferir as conexões, o fio e o disjuntor do circuito.',
        },
        {
          id: 'encaixar-resistencia',
          title: 'Encaixe a resistência nova',
          text: [
            'Encaixe a resistência nova do mesmo jeito que estava a antiga, com cada terminal no seu lugar. Não estique a espiral, não dobre o fio e não deixe uma volta encostar na outra: espira encostada vira um curto que queima a peça.',
            'A espiral precisa ficar livre dentro da câmara, sem tocar nas paredes.',
          ],
          tip: 'Pegue a resistência pela base, não pela espiral.',
        },
        {
          id: 'fechar-chuveiro',
          title: 'Feche o chuveiro',
          text: 'Monte as peças na ordem inversa, com a vedação no lugar. Confira se os fios de alimentação e o fio terra continuam presos nos bornes do chuveiro.',
        },
      ],
    },
    {
      title: 'Religar',
      steps: [
        {
          id: 'abrir-agua-antes',
          title: 'Abra a água antes de religar e deixe o ar sair',
          text: [
            'Com o disjuntor **ainda desligado**, abra o registro e deixe a água correr por uns 30 segundos (típico), até sair um jato contínuo, sem ar.',
            'A câmara estava vazia. Se o chuveiro for ligado com ar lá dentro, o trecho da resistência que fica fora da água esquenta sem nada que o resfrie e rompe em segundos.',
          ],
          warning: 'Nunca religue o disjuntor com o chuveiro seco ou com o registro fechado.',
        },
        {
          id: 'religar-disjuntor',
          title: 'Religue o disjuntor e teste',
          text: [
            'Com a água correndo, tire o aviso e religue o disjuntor. Teste as posições verão e inverno.',
            'Feche o registro e confira se o chuveiro desliga.',
          ],
          measure: {
            what: 'O que você sente e ouve',
            expected:
              'Água morna no verão e quente no inverno, sem cheiro de queimado, sem estalos e sem formigamento no registro',
          },
          warning:
            'Formigamento no registro ou no cano é corrente de fuga: desligue o disjuntor e chame um eletricista para conferir o terra e o DR.',
        },
      ],
    },
  ],
});
