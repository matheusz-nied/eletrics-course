/**
 * Demo workshop used by the example lesson (`<Workshop id="exemplo">`), kept
 * small and safe (low voltage). Real workshops follow the same format, e.g.
 * src/lessons/m16/oficinas/trocar-motor-portao.ts.
 */
import { defineWorkshop } from '../../../course/workshop/format';

export default defineWorkshop({
  id: 'exemplo',
  title: 'Testar uma pilha com o multímetro',
  summary:
    'Um procedimento curto para conhecer o modo oficina: preparar o multímetro, medir a tensão de uma pilha AA e guardar o instrumento.',
  safety: 'baixa-tensao',
  duration: '5 minutos',
  tools: ['Multímetro digital com pontas de prova'],
  materials: ['Uma pilha AA (nova ou usada)'],
  sections: [
    {
      title: 'Preparar',
      steps: [
        {
          id: 'encaixar-pontas',
          title: 'Encaixe as pontas de prova',
          text: 'A ponta **preta** vai no borne **COM**. A ponta **vermelha** vai no borne **VΩ** (às vezes escrito V Ω mA).',
          warning:
            'Nunca meça tensão com a ponta vermelha no borne de corrente (mA ou 10A): nessa posição o multímetro vira um fio e provoca um curto.',
        },
        {
          id: 'escolher-escala',
          title: 'Gire o seletor para tensão contínua',
          text: [
            'Procure o símbolo V com uma linha reta e outra tracejada em cima (V⎓), que indica tensão contínua.',
            'Se o multímetro tiver escalas, escolha a primeira maior que o valor esperado: para uma pilha de 1,5 V, a escala de 2 V ou de 20 V.',
          ],
        },
      ],
    },
    {
      title: 'Medir',
      steps: [
        {
          id: 'medir-pilha',
          title: 'Encoste as pontas nos polos da pilha',
          text: 'Ponta vermelha no polo positivo (+, o lado com o "botão") e ponta preta no negativo (−, o lado plano). Segure pelas partes isoladas das pontas.',
          measure: {
            what: 'Tensão entre os polos da pilha',
            expected:
              'Típico: perto de 1,6 V numa pilha alcalina nova. Quanto mais gasta, menor a tensão; muitos aparelhos já não funcionam bem abaixo de cerca de 1,2 V.',
          },
        },
        {
          id: 'conferir-sinal',
          title: 'Confira o sinal no visor',
          text: 'Um sinal de menos (−) antes do número quer dizer que as pontas estão invertidas. O valor está certo; só a polaridade trocou.',
          tip: 'Esse sinal ajuda a descobrir qual fio é o positivo numa fonte sem marcação.',
        },
      ],
    },
    {
      title: 'Guardar',
      steps: [
        {
          id: 'desligar',
          title: 'Volte o seletor para OFF',
          text: 'Desligue o multímetro e guarde as pontas enroladas sem dobrar o cabo junto do conector.',
        },
      ],
    },
  ],
});
