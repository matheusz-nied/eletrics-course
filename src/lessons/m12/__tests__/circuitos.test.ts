/**
 * The numbers the module 12 lessons quote about their simulations, checked
 * against the engine: if a device model changes, the lesson text must too.
 */
import { describe, expect, it } from 'vitest';
import luzAutomatica from '../luz-automatica.circuit';
import minuteria from '../minuteria.circuit';
import motorPwm from '../motor-pwm.circuit';
import primeiroPrograma from '../primeiro-programa.circuit';
import releInteligente from '../rele-inteligente.circuit';
import releLampada from '../rele-lampada.circuit';
import termometro from '../termometro.circuit';
import { run } from './sim';

const num = (r: Record<string, unknown>, key: string) => Number(r[key]);

describe('12.1 primeiro programa', () => {
  it('reads the potentiometer and the button as the lesson says', () => {
    const x = run(primeiroPrograma).to(0.05);
    let r = x.readouts();
    expect(num(r, 'VA0')).toBeCloseTo(2.49, 2);
    expect(r['U1.leitura']).toBe(510);
    x.set('P1.position', 0.25).to(0.1);
    r = x.readouts();
    expect(num(r, 'VA0')).toBeCloseTo(1.25, 1);
    expect(r['U1.leitura']).toBe(255);
    x.set('P1.position', 1).to(0.15);
    expect(x.readouts()['U1.leitura']).toBe(1023);
    expect(num(x.readouts(), 'VD2')).toBeGreaterThan(4.9);
    x.set('S1.pressed', true).to(0.25);
    r = x.readouts();
    expect(num(r, 'VD2')).toBeLessThan(0.05);
    expect(num(r, 'ID13') * 1000).toBeCloseTo(11.5, 0);
  });

  it('blinks D12 every 500 ms', () => {
    const x = run(primeiroPrograma).to(0.25);
    const on = num(x.readouts(), 'D2.brightness') > 0.5;
    x.to(0.75);
    expect(num(x.readouts(), 'D2.brightness') > 0.5).toBe(!on);
    x.to(1.25);
    expect(num(x.readouts(), 'D2.brightness') > 0.5).toBe(on);
  });
});

describe('12.2 minuteria', () => {
  it('lights for 10 s on a touch, restarts on a second touch and goes FIXA when held', () => {
    const x = run(minuteria).to(0.05);
    expect(x.readouts()['U1.tempo']).toBe(10);
    x.set('S1.pressed', true).to(0.2).set('S1.pressed', false).to(0.3);
    expect(x.readouts()['U1.estado']).toBe('ACESA');
    x.to(7.3);
    expect(num(x.readouts(), 'U1.restante')).toBeCloseTo(3, 0);
    x.set('S1.pressed', true).to(7.4).set('S1.pressed', false).to(7.5);
    expect(num(x.readouts(), 'U1.restante')).toBeCloseTo(10, 0);
    x.to(17.6);
    expect(x.readouts()['U1.estado']).toBe('APAGADA');
    x.set('S1.pressed', true).to(20);
    expect(x.readouts()['U1.estado']).toBe('FIXA');
    x.set('S1.pressed', false).to(40);
    expect(x.readouts()['U1.estado']).toBe('FIXA');
    x.set('S1.pressed', true).to(40.2).set('S1.pressed', false).to(40.3);
    expect(x.readouts()['U1.estado']).toBe('APAGADA');
    x.set('P1.position', 1).to(40.4);
    expect(x.readouts()['U1.tempo']).toBe(60);
  });
});

describe('12.3 sensores', () => {
  it('termometro: 508 and about 25,4 °C at 25 °C, hysteresis between 30 and 28 °C', () => {
    const x = run(termometro).to(0.5);
    let r = x.readouts();
    expect(r['U1.leitura']).toBe(508);
    expect(num(r, 'U1.temperature')).toBeCloseTo(25.4, 1);
    x.set('TH1.temperature', 40).to(20);
    r = x.readouts();
    expect(r['U1.leitura']).toBe(350);
    expect(num(r, 'U1.temperature')).toBeCloseTo(40.5, 1);
    expect(r['U1.ventilador']).toBe(true);
    x.set('TH1.temperature', 28).to(40);
    r = x.readouts();
    expect(num(r, 'U1.temperature')).toBeCloseTo(28.6, 1);
    expect(r['U1.ventilador']).toBe(true);
    x.set('TH1.temperature', 27).to(60);
    expect(x.readouts()['U1.ventilador']).toBe(false);
  });

  it('luz automática: 729 at 100 lx, 141 at 2 lx and NOITE after 3 s', () => {
    const x = run(luzAutomatica).to(0.5);
    expect(x.readouts()['U1.leitura']).toBe(729);
    x.set('LDR1.lux', 2).to(1);
    expect(x.readouts()['U1.leitura']).toBe(141);
    expect(x.readouts()['U1.estado']).not.toBe('NOITE');
    x.to(4.5);
    expect(x.readouts()['U1.estado']).toBe('NOITE');
  });
});

describe('12.4 atuadores', () => {
  it('rele-lampada: base, coil, lamp and buzzer currents', () => {
    const x = run(releLampada).to(0.2);
    expect(x.readouts()['K1.closed']).toBe(false);
    let buzzer = 0;
    let inrush = 0;
    x.set('S1.pressed', true).to(0.3, (r) => {
      buzzer = Math.max(buzzer, Math.abs(num(r, 'IBZ')));
      inrush = Math.max(inrush, Math.abs(num(r, 'IL')));
    });
    x.set('S1.pressed', false).to(0.8);
    const r = x.readouts();
    expect(r['K1.closed']).toBe(true);
    expect(num(r, 'IB') * 1000).toBeCloseTo(4.05, 1);
    expect(num(r, 'IK') * 1000).toBeCloseTo(30.5, 0);
    expect(num(r, 'Q1.vce')).toBeCloseTo(0.04, 2);
    expect(num(r, 'IL')).toBeCloseTo(0.42, 2);
    expect(buzzer * 1000).toBeCloseTo(10.4, 0);
    expect(inrush).toBeGreaterThan(1.4);
    expect(num(r, 'IBZ')).toBe(0);
  });

  it('motor-pwm: soft start cuts the starting peak, same final speed', () => {
    const peaks: number[] = [];
    for (const suave of [true, false]) {
      const x = run(motorPwm, { 'S1.closed': suave }).to(0.2);
      let peak = 0;
      x.set('P1.position', 1).to(2.5, (r) => {
        peak = Math.max(peak, Math.abs(num(r, 'IM')));
      });
      peaks.push(peak);
      expect(num(x.readouts(), 'M1.rpm')).toBeCloseTo(5220, -1.5);
      if (suave) {
        x.set('P1.position', 0.5).to(4.5);
        let sum = 0;
        let n = 0;
        x.to(4.6, (r) => {
          sum += num(r, 'M1.rpm');
          n++;
        });
        expect(x.readouts()['U1.ciclo']).toBe(50);
        expect(sum / n).toBeCloseTo(3100, -2);
      }
    }
    expect(peaks[0]).toBeCloseTo(1.54, 1);
    expect(peaks[1]).toBeCloseTo(5.59, 1);
  }, 60_000);
});

describe('12.6 automação residencial', () => {
  it('rele-inteligente: the switch toggles the lamp in either position, and so does the app', () => {
    const x = run(releInteligente).to(0.3);
    expect(x.readouts()['U1.lampada']).toBe('apagada');
    x.set('S2.closed', true).to(0.8);
    let r = x.readouts();
    expect(r['U1.lampada']).toBe('acesa');
    expect(num(r, 'VL')).toBeCloseTo(126.9, 0);
    expect(num(r, 'IK') * 1000).toBeCloseTo(72, -0.5);
    expect(num(r, 'IB') * 1000).toBeCloseTo(2.4, 1);
    x.set('S2.closed', false).to(1.3);
    expect(x.readouts()['U1.lampada']).toBe('apagada');
    x.set('S1.pressed', true).to(1.4).set('S1.pressed', false).to(1.9);
    r = x.readouts();
    expect(r['U1.lampada']).toBe('acesa');
    expect(r['U1.origem']).toBe('aplicativo');
  });
});
