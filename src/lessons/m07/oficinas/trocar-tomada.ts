/**
 * Workshop of lesson 7.5 (`<Workshop id="trocar-tomada" />`): replace a wall
 * outlet with an NBR 14136 one, in the safe order. No norm values beyond
 * what the lesson explains; the rest is called "típico".
 */
import { defineWorkshop } from '../../../course/workshop/format';

export default defineWorkshop({
  id: 'trocar-tomada',
  title: 'Trocar uma tomada',
  summary:
    'Desligar e confirmar a ausência de tensão, soltar a tomada velha anotando os fios, ligar a nova com fase, neutro e terra nos bornes certos, acomodar tudo na caixa e testar antes de usar.',
  safety: 'rede',
  duration: '30 a 60 minutos',
  tools: [
    'Multímetro com tensão CA (V~) ou um detector de tensão de boa qualidade',
    'Uma tomada que você sabe que está funcionando, para testar o instrumento',
    'Chaves de fenda e Phillips com cabo isolado',
    'Alicate de corte e desencapador de fios',
    'Testador de tomada de três luzes (opcional, para o teste final)',
    'Fita crepe e caneta, para etiquetar os fios',
    'Lanterna',
    'Aviso escrito "Não ligue: manutenção" e fita para prender o disjuntor desligado',
  ],
  materials: [
    'Tomada nova no padrão NBR 14136, de 10 A ou de 20 A, igual à corrente do circuito e do aparelho',
    'Placa (espelho) para caixa 4×2 compatível com o módulo, se a antiga não servir',
    'Um pedaço de fio da mesma bitola e cor, se a ponta de algum fio estiver danificada',
  ],
  sections: [
    {
      title: 'Desligar e confirmar',
      steps: [
        {
          id: 'desligar-disjuntor',
          title: 'Desligue o disjuntor do circuito da tomada',
          text: [
            'Ligue um abajur ou um rádio na tomada e desligue o disjuntor do circuito dela: quando ele se apagar, você achou o disjuntor certo. Se o quadro não tiver identificação ou se houver dúvida, desligue o disjuntor geral.',
            'Tomadas de 220 V com duas fases usam disjuntor bipolar (duas alavancas presas juntas). Desligue as duas.',
          ],
          warning:
            'Desligar o aparelho ou tirar o plugue não basta. A tomada só fica sem tensão com o disjuntor do circuito desligado.',
        },
        {
          id: 'sinalizar',
          title: 'Sinalize o quadro',
          text: 'Prenda o disjuntor desligado com fita, cole o aviso "Não ligue: manutenção" no quadro e avise quem está em casa.',
        },
        {
          id: 'testar-instrumento',
          title: 'Teste o instrumento numa tomada energizada',
          text: 'Meça uma tomada que está funcionando, de outro circuito. O instrumento precisa mostrar a tensão da rede. Se não mostrar, a bateria está fraca, a ponta está quebrada ou a escala está errada: resolva antes de continuar.',
          measure: {
            what: 'Tensão entre os dois furos de força de uma tomada boa',
            expected: 'Perto de 127 V ou de 220 V, conforme a sua rede',
            how: 'Multímetro em V~, numa escala acima de 220 V. Segure as pontas pelo protetor de dedo.',
          },
        },
        {
          id: 'testar-ausencia',
          title: 'Confirme a ausência de tensão na tomada',
          text: 'Meça a tomada em que você vai mexer, nos três pares de furos. Depois de tirar a placa, meça de novo nos bornes, antes de encostar nos fios. Logo em seguida, confira mais uma vez o instrumento na tomada boa.',
          measure: {
            what: 'F–N, F–T e N–T na tomada que você vai trocar',
            expected: '0 V nos três. Qualquer tensão: pare e procure o disjuntor certo.',
          },
          warning:
            'Uma caixa pode ter fios de dois circuitos. Meça todos os fios que estiverem lá dentro, não só os da tomada.',
        },
      ],
    },
    {
      title: 'Soltar a tomada velha',
      steps: [
        {
          id: 'abrir-e-fotografar',
          title: 'Tire a placa e fotografe a ligação',
          text: 'Solte os parafusos da placa e do módulo, puxe a tomada para fora da caixa com cuidado e tire uma foto de frente e de lado, mostrando qual fio vai em qual borne.',
        },
        {
          id: 'identificar-fios',
          title: 'Identifique os fios',
          text: [
            'Etiquete cada fio antes de soltar. O terra costuma ser verde-amarelo ou verde, e o neutro, azul-claro. A cor da fase não é fixa: vermelho, preto e marrom são comuns.',
            'Não confie só na cor: muita instalação antiga tem cores trocadas. Na dúvida, chame um eletricista para identificar os fios com o circuito ligado.',
          ],
          tip: 'Se a caixa tiver mais fios do que a tomada usa (fios que passam para outra tomada), deixe-os como estão e não desfaça as emendas.',
        },
        {
          id: 'soltar',
          title: 'Solte os fios da tomada velha',
          text: 'Afrouxe os parafusos dos bornes, ou aperte a trava dos bornes de engate rápido, e tire os fios. Veja se as pontas estão escurecidas, derretidas ou com o cobre azulado: são sinais de aquecimento por mau contato.',
          warning:
            'Isolação derretida ou ressecada no fio, e não só na ponta, indica um problema maior que a tomada (sobrecarga, emenda ruim). Chame um eletricista.',
        },
      ],
    },
    {
      title: 'Ligar a tomada nova',
      steps: [
        {
          id: 'preparar-pontas',
          title: 'Prepare as pontas na medida certa',
          text: [
            'Se a ponta estiver escurecida ou com fios quebrados, corte esse pedaço e desencape de novo.',
            'Desencape só o comprimento que o borne pede: muitas tomadas trazem a medida gravada no corpo (um gabarito). O cobre inteiro deve ficar dentro do borne, sem sobrar cobre exposto do lado de fora e sem prender a isolação no lugar do cobre.',
          ],
        },
        {
          id: 'ligar-terra',
          title: 'Ligue o terra no borne do terra',
          text: 'O fio terra vai no borne marcado com o símbolo do terra (⏚) ou com "T", que é o borne ligado ao furo do meio, fora da linha dos outros dois.',
          warning:
            'Nunca ligue a fase nem o neutro no borne do terra. Fase no terra deixa a carcaça de todo aparelho ligado ali com a tensão da rede.',
        },
        {
          id: 'ligar-fase-e-neutro',
          title: 'Ligue a fase e o neutro nos bornes laterais',
          text: [
            'A fase e o neutro vão nos dois bornes dos furos laterais. Siga a convenção que a casa já usa (por exemplo, a fase sempre do mesmo lado), para facilitar a próxima manutenção.',
            'Numa tomada de 220 V com duas fases, cada fase vai num dos bornes laterais.',
          ],
        },
        {
          id: 'apertar',
          title: 'Aperte e puxe cada fio',
          text: 'Aperte bem cada parafuso e dê um puxão leve em cada fio. Fio que sai com a mão vai esquentar com a corrente. Fio flexível pede terminal (ponteira) ou um borne próprio para ele.',
        },
        {
          id: 'acomodar',
          title: 'Acomode os fios e fixe a tomada',
          text: 'Dobre os fios em zigue-zague para dentro da caixa 4×2, sem esmagar nem forçar nenhum contra a borda, e fixe o módulo e a placa com os parafusos.',
        },
      ],
    },
    {
      title: 'Religar e testar',
      steps: [
        {
          id: 'religar',
          title: 'Retire o aviso e religue o disjuntor',
          text: 'Confira que não sobrou ferramenta nem fio solto na caixa, retire o aviso e a fita e religue o disjuntor.',
        },
        {
          id: 'testar-tomada',
          title: 'Teste a tomada antes de usar',
          text: 'Com o testador de três luzes ou com o multímetro, confira a ligação. Compare com a legenda do testador e com a tabela da aula.',
          measure: {
            what: 'F–N, F–T e N–T na tomada nova',
            expected:
              'Típico numa rede de 127 V: F–N e F–T perto de 127 V; N–T perto de 0 V (até alguns volts). Numa tomada de 220 V com duas fases: 220 V entre os furos laterais e cerca de 127 V de cada um para o terra.',
          },
          warning:
            'Se o terra mostrar a tensão da rede contra os dois furos laterais, a fase está no terra: desligue o disjuntor na hora e refaça a ligação.',
        },
        {
          id: 'conferir-aquecimento',
          title: 'Confira o aquecimento com o aparelho ligado',
          text: 'Ligue o aparelho que usa essa tomada e, depois de uns minutos de uso, encoste o dorso da mão na placa e no plugue. Morno é normal com aparelhos potentes; quente a ponto de incomodar é sinal de mau contato ou de tomada pequena para o aparelho.',
        },
      ],
    },
  ],
});
