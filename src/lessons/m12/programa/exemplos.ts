/**
 * Example programs of the microcontroller widget. The comments inside the
 * code are pt-BR on purpose: the student reads and edits them. Each one
 * stays short (25 lines at most, checked in exemplos.test.ts).
 */

export interface Exemplo {
  id: string;
  /** Name in the picker. */
  titulo: string;
  /** One sentence on what it shows. */
  resumo: string;
  codigo: string;
}

export const EXEMPLOS: Exemplo[] = [
  {
    id: 'pisca',
    titulo: 'Piscar o LED',
    resumo: 'O LED vermelho do pino 13 acende por 1 segundo e apaga por 1 segundo.',
    codigo: `// Pisca o LED vermelho do pino 13: 1 segundo aceso, 1 apagado.
const int LED = 13;

void setup() {
  pinMode(LED, OUTPUT);     // o pino 13 vira uma saída
}

void loop() {
  digitalWrite(LED, HIGH);  // 5 V no pino: o LED acende
  delay(1000);              // espera 1000 ms (1 segundo)
  digitalWrite(LED, LOW);   // 0 V no pino: o LED apaga
  delay(1000);
}
`,
  },
  {
    id: 'botao',
    titulo: 'Botão acende o LED',
    resumo: 'Enquanto o botão do pino 2 estiver apertado, o LED do pino 13 fica aceso.',
    codigo: `// Enquanto o botão (pino 2) estiver apertado, o LED 13 acende.
const int BOTAO = 2;
const int LED = 13;

void setup() {
  pinMode(BOTAO, INPUT_PULLUP); // resistor interno puxa o pino para 5 V
  pinMode(LED, OUTPUT);
}

void loop() {
  // Solto: o pull-up deixa o pino em HIGH.
  // Apertado: o botão liga o pino ao GND, e ele lê LOW.
  if (digitalRead(BOTAO) == LOW) {
    digitalWrite(LED, HIGH);
  } else {
    digitalWrite(LED, LOW);
  }
}
`,
  },
  {
    id: 'potenciometro',
    titulo: 'Potenciômetro e PWM',
    resumo:
      'Lê o potenciômetro em A0 e usa o valor para o brilho do LED verde (PWM no pino 9), mostrando os números no monitor serial.',
    codigo: `// Lê o potenciômetro (A0) e controla o brilho do LED verde (pino 9).
void setup() {
  Serial.begin(9600);     // liga a comunicação com o monitor serial
}

void loop() {
  int leitura = analogRead(A0);                // de 0 a 1023
  int brilho = map(leitura, 0, 1023, 0, 255);  // de 0 a 255
  analogWrite(9, brilho);                      // PWM no pino 9

  Serial.print("A0 = ");
  Serial.print(leitura);
  Serial.print("   brilho = ");
  Serial.println(brilho);
  delay(200);
}
`,
  },
  {
    id: 'sem-delay',
    titulo: 'Piscar sem delay()',
    resumo:
      'Pisca o LED 13 olhando o relógio com millis(), e o botão acende o LED verde na hora, ao mesmo tempo.',
    codigo: `// Pisca o LED 13 sem delay() e, ao mesmo tempo, atende o botão.
const int LED = 13, VERDE = 9, BOTAO = 2;
unsigned long ultimaTroca = 0;  // quando o LED 13 mudou pela última vez
bool aceso = false;

void setup() {
  pinMode(LED, OUTPUT);
  pinMode(VERDE, OUTPUT);
  pinMode(BOTAO, INPUT_PULLUP);
}

void loop() {
  // Já passou meio segundo desde a última troca? Então troca.
  if (millis() - ultimaTroca >= 500) {
    ultimaTroca = millis();
    aceso = !aceso;
    digitalWrite(LED, aceso);
  }
  // O loop roda milhares de vezes por segundo: o botão responde na hora.
  digitalWrite(VERDE, digitalRead(BOTAO) == LOW);
}
`,
  },
  {
    id: 'alarme',
    titulo: 'Alarme com LDR',
    resumo:
      'O botão arma e desarma. Armado, se a luz no LDR (A1) cair, o relé acende a lâmpada e o buzzer apita.',
    codigo: `// Alarme: o botão arma e desarma. Armado, se escurecer no LDR, dispara.
const int BOTAO = 2, RELE = 7, BUZZER = 8, LED = 13;
bool armado = false;
void setup() {
  pinMode(BOTAO, INPUT_PULLUP);
  pinMode(RELE, OUTPUT);
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  if (digitalRead(BOTAO) == LOW) {       // apertou: arma ou desarma
    armado = !armado;
    digitalWrite(LED, armado);           // LED 13 aceso = armado
    digitalWrite(RELE, LOW);             // desliga a lâmpada
    noTone(BUZZER);                      // e o buzzer
    Serial.println(armado ? "Armado" : "Desarmado");
    while (digitalRead(BOTAO) == LOW) {} // espera soltar o botão
    delay(50);
  }
  if (armado && analogRead(A1) < 300) {  // ficou escuro: alguém passou
    digitalWrite(RELE, HIGH);            // o relé acende a lâmpada
    tone(BUZZER, 880);                   // e o buzzer apita
  }
}
`,
  },
  {
    id: 'sos',
    titulo: 'SOS com uma função',
    resumo: 'Uma função própria, piscar(), toca o SOS do código Morse no LED 13 e no buzzer.',
    codigo: `// SOS em código Morse no LED 13 e no buzzer, com uma função própria.
const int LED = 13, BUZZER = 8;

// Pisca 'vezes' vezes, cada uma com 'duracao' milissegundos de som.
void piscar(int vezes, int duracao) {
  for (int i = 0; i < vezes; i++) {
    digitalWrite(LED, HIGH);
    tone(BUZZER, 660);
    delay(duracao);
    digitalWrite(LED, LOW);
    noTone(BUZZER);
    delay(150);
  }
}

void setup() {
  pinMode(LED, OUTPUT);
}

void loop() {
  piscar(3, 150);  // S: três pontos
  piscar(3, 450);  // O: três traços
  piscar(3, 150);  // S
  delay(1000);     // pausa antes de repetir
}
`,
  },
];

export function exemploPorId(id: string | undefined): Exemplo | undefined {
  return EXEMPLOS.find((e) => e.id === id);
}
