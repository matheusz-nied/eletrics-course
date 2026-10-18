/**
 * Lesson 0.3 (essential tools): check the multimeter, the probes and the
 * voltage tester before a job. Low voltage only; testing on a live outlet is
 * taught in lesson 3.2 and only mentioned here.
 */
import { defineWorkshop } from '../../../course/workshop/format';

export default defineWorkshop({
  id: 'conferir-ferramentas',
  title: 'Conferir as ferramentas antes do serviço',
  summary:
    'Antes de mexer em qualquer instalação, confira se o multímetro, as pontas de prova e as ferramentas isoladas estão em condições. Leva poucos minutos e evita que um instrumento com defeito diga que um fio está desligado quando não está.',
  safety: 'baixa-tensao',
  duration: '10 minutos',
  tools: [
    'Multímetro digital com pontas de prova',
    'Chave de teste ou detector de tensão',
    'Chaves de fenda e alicates isolados',
  ],
  materials: ['Uma pilha AA ou de 9 V (de preferência nova)'],
  sections: [
    {
      title: 'Inspecionar',
      steps: [
        {
          id: 'olhar-pontas',
          title: 'Olhe as pontas de prova de ponta a ponta',
          text: 'Passe os dedos pelo cabo inteiro das pontas de prova, do conector até a ponta metálica. Procure rachaduras, partes derretidas, cobre aparecendo e pontas tortas ou soltas.',
          warning:
            'Ponta de prova com o isolamento danificado vai para o lixo. Não remende com fita: é por ela que a sua mão fica perto da tensão.',
        },
        {
          id: 'olhar-cabos-ferramentas',
          title: 'Confira o isolamento das ferramentas',
          text: 'O cabo das chaves de fenda e dos alicates isolados precisa estar inteiro, sem cortes nem lascas. Procure a marcação "1000 V" com o símbolo de dois triângulos.',
        },
        {
          id: 'categoria',
          title: 'Leia a categoria do multímetro',
          text: 'Perto dos bornes, o multímetro informa a categoria de medição, por exemplo CAT III 600 V. Para tomadas e quadros de casa, use um instrumento de pelo menos CAT III com tensão maior que a da instalação.',
        },
      ],
    },
    {
      title: 'Testar o multímetro',
      steps: [
        {
          id: 'encaixar-pontas',
          title: 'Encaixe as pontas nos bornes certos',
          text: 'Ponta **preta** no borne **COM**. Ponta **vermelha** no borne **VΩ** (às vezes escrito V Ω mA).',
          warning:
            'Nunca deixe a ponta vermelha no borne de corrente (mA ou 10A) quando for medir tensão: o multímetro vira um fio e provoca um curto-circuito.',
        },
        {
          id: 'testar-continuidade',
          title: 'Teste a continuidade encostando uma ponta na outra',
          text: 'Gire o seletor para continuidade (o símbolo de som ou de diodo) e encoste as duas pontas metálicas. O multímetro deve apitar e mostrar perto de zero.',
          measure: {
            what: 'Resistência com as pontas encostadas',
            expected:
              'Típico: menos de 1 Ω e um apito. Se não apitar ou mostrar um valor alto, a ponta ou o cabo estão rompidos por dentro.',
          },
        },
        {
          id: 'medir-pilha',
          title: 'Meça a tensão de uma pilha conhecida',
          text: 'Gire o seletor para tensão contínua (V com uma linha reta e outra tracejada em cima). Encoste a ponta vermelha no polo positivo e a preta no negativo.',
          measure: {
            what: 'Tensão da pilha',
            expected:
              'Típico: perto de 1,6 V numa pilha AA alcalina nova, ou perto de 9 V numa bateria de 9 V nova. Se o multímetro mostrar zero ou um valor sem sentido, não use o instrumento.',
          },
          tip: 'Se o visor mostrar o símbolo de bateria, troque a bateria do multímetro antes de confiar em qualquer medida.',
        },
      ],
    },
    {
      title: 'Antes de cada serviço na rede',
      steps: [
        {
          id: 'testar-antes-depois',
          title: 'Lembre da regra: testar, medir e testar de novo',
          text: [
            'Na hora do serviço, o multímetro ou o detector de tensão é conferido numa tomada que você sabe que está funcionando, logo antes de testar os fios desligados, e de novo logo depois.',
            'Assim, se o instrumento parar de funcionar no meio do caminho, você percebe. O passo a passo dessa medição está na aula 3.2.',
          ],
        },
        {
          id: 'guardar',
          title: 'Guarde tudo do jeito certo',
          text: 'Volte o seletor para OFF, enrole as pontas sem dobrar o cabo junto do conector e guarde as ferramentas longe de umidade.',
        },
      ],
    },
  ],
});
