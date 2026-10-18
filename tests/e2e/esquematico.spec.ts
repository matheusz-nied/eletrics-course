import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  EXAMPLE_LESSON,
  expectAccessible,
  expectNoHorizontalOverflow,
  watchErrors,
} from './helpers';

const GALLERY = 'dev/circuitos/';
const demo = (name: string) => `${GALLERY}demo/${name}/`;

const PREFIX: Record<string, number> = {
  p: 1e-12,
  n: 1e-9,
  µ: 1e-6,
  m: 1e-3,
  '': 1,
  k: 1e3,
  M: 1e6,
};

/** Number in a pt-BR reading such as "Corrente na lâmpada: 326 mA" (in base units). */
function siValue(text: string, unit: string): number {
  const match = new RegExp(`(−|-)?([\\d.]+(?:,\\d+)?)\\s*([pnµmkM]?)${unit}`).exec(text);
  if (!match) throw new Error(`no ${unit} reading in "${text}"`);
  const value = Number(match[2]!.replaceAll('.', '').replace(',', '.'));
  return (match[1] ? -1 : 1) * value * PREFIX[match[3] ?? '']!;
}

/** Reading of a multimeter, as the text screen readers get. */
async function meter(page: Page, probe: string, unit: string): Promise<number> {
  const text = await page.locator(`.dmm[data-probe="${probe}"] [data-reading]`).innerText();
  return siValue(text, unit);
}

async function openSimulation(page: Page, path: string): Promise<Locator> {
  await page.goto(path);
  const sim = page.locator('[data-simulation]').first();
  await sim.scrollIntoViewIfNeeded();
  await expect(sim).toHaveAttribute('data-ready', '');
  return sim;
}

test.describe('circuit gallery', () => {
  test('lists the lesson circuits and the schematic demos', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(GALLERY);
    await expect(page.getByRole('heading', { level: 1, name: 'Circuitos' })).toBeVisible();
    await expect(page.locator('[data-circuit="m00/exemplo"]')).toBeVisible();
    for (const name of [
      'lampada-potenciometro',
      'rc-senoide',
      'filtro-rc-bode',
      'rele-motor',
      'fim-de-curso',
      'motor-capacitor',
    ]) {
      await expect(page.locator(`[data-circuit="demo/${name}"]`)).toBeVisible();
    }
    await page.locator('[data-circuit="demo/lampada-potenciometro"] a').click();
    await expect(page).toHaveURL(/demo\/lampada-potenciometro\/$/);
    await expect(page.locator('[data-simulation]')).toHaveAttribute('data-ready', '');
    errors.expectClean();
  });

  test('the symbol sheet draws every component', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${GALLERY}simbolos/`);
    for (const type of ['resistor', 'lamp', 'switch-spdt', 'relay-spdt', 'npn', 'mains']) {
      await expect(page.locator(`[data-symbol="${type}"] svg`).first()).toBeVisible();
    }
    await expectNoHorizontalOverflow(page);
    errors.expectClean();
  });
});

test.describe('static charts', () => {
  /** The x labels shown on screen, per chart. */
  const xLabels = (page: Page) =>
    page.locator('.sim-plot__x').evaluateAll((axes) =>
      axes.map((axis) =>
        [...axis.querySelectorAll('.sim-plot__ticks')]
          .filter((row) => row.getBoundingClientRect().height > 0)
          .flatMap((row) => [...row.querySelectorAll('span')])
          .map((span) => {
            const r = span.getBoundingClientRect();
            return { text: span.textContent ?? '', left: r.left, right: r.right };
          }),
      ),
    );

  test('x labels never overlap and thin out on narrow screens', async ({ page, isMobile }) => {
    const errors = watchErrors(page);
    await page.goto(`${GALLERY}graficos/`);
    const charts = await xLabels(page);
    expect(charts).toHaveLength(2);
    for (const labels of charts) {
      expect(labels.length).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < labels.length; i++) {
        expect(labels[i]!.left).toBeGreaterThan(labels[i - 1]!.right);
      }
    }
    // 0 a 100 °C: every 20 °C on a wide screen, every 40 °C on a phone.
    const ntc = charts[0]!.map((l) => l.text.replace(/\s/g, ' ')).join(' | ');
    expect(ntc).toBe(
      isMobile ? '0 °C | 40 °C | 80 °C' : '0 °C | 20 °C | 40 °C | 60 °C | 80 °C | 100 °C',
    );
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page);
    errors.expectClean();
  });
});

test.describe('simulation in a lesson', () => {
  test('the example lesson runs its circuit and shows the static chart', async ({ page }) => {
    const errors = watchErrors(page);
    const sim = await openSimulation(page, EXAMPLE_LESSON);
    await expect(sim).toHaveAttribute('data-engine', 'motor');
    await expect(page.locator('[data-stub="Simulation"], [data-stub="Plot"]')).toHaveCount(0);
    await expect(sim.getByRole('group', { name: /^Esquema:/ })).toBeVisible();

    const plot = page.locator('[data-plot]');
    await expect(plot).toContainText('corrente no resistor');
    await expect(plot.getByRole('img')).toHaveAttribute('aria-label', /Corrente no resistor/i);

    // Transient circuits start paused; Play makes simulated time advance.
    const time = sim.locator('.sim-time');
    await expect(time).toHaveText(/t\s=\s0\ss/);
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    await expect(time).not.toHaveText(/t\s=\s0\ss/);
    await expectAccessible(page);
    errors.expectClean();
  });
});

test.describe('interaction', () => {
  test('the switch turns the lamp off and the potentiometer dims it', async ({ page }) => {
    const errors = watchErrors(page);
    const sim = await openSimulation(page, demo('lampada-potenciometro'));
    await expect.poll(() => meter(page, 'IL', 'A')).toBeGreaterThan(0.2);

    // Switch in the control panel, with the mouse.
    const toggle = sim.locator('.sim-controls').getByRole('switch', { name: 'Chave S1' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect.poll(() => meter(page, 'IL', 'A')).toBe(0);

    // The same switch on the schematic, with the keyboard.
    const symbol = sim.locator('.sim-schematic').getByRole('switch', { name: 'Chave S1' });
    await symbol.focus();
    await page.keyboard.press('Space');
    await expect(symbol).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => meter(page, 'IL', 'A')).toBeGreaterThan(0.2);

    // Turning the potentiometer to the end puts all 50 Ω in series.
    const pot = sim.locator('.sim-schematic').getByRole('slider', { name: /Potenciômetro P1/ });
    await pot.focus();
    await page.keyboard.press('End');
    await expect(pot).toHaveAttribute('aria-valuetext', /^100\s%$/);
    await expect.poll(() => meter(page, 'IL', 'A')).toBeLessThan(0.2);

    // And back to the start: the lamp reaches full brightness, the challenge is met.
    await page.keyboard.press('Home');
    await expect.poll(() => meter(page, 'VL', 'V')).toBeGreaterThan(11.9);
    await expect(sim.getByRole('region', { name: 'Desafios' })).toContainText('cumprido');
    errors.expectClean();
  });

  test('a challenge stays marked until the simulation restarts', async ({ page }) => {
    const errors = watchErrors(page);
    const sim = await openSimulation(page, demo('lampada-potenciometro'));
    const goals = sim.getByRole('region', { name: 'Desafios' });
    const pot = sim.locator('.sim-schematic').getByRole('slider', { name: /Potenciômetro P1/ });
    await pot.focus();
    await page.keyboard.press('Home');
    await expect(goals).toContainText('(cumprido)');

    // Dimming the lamp afterwards does not take the mark away.
    await page.keyboard.press('End');
    await expect.poll(() => meter(page, 'IL', 'A')).toBeLessThan(0.2);
    await expect(goals).toContainText('(cumprido)');
    await expect(goals).toContainText('1/1');

    // Restarting clears it, since the lamp is dim now.
    await sim.getByRole('button', { name: 'Reiniciar simulação' }).click();
    await expect(goals).toContainText('(pendente)');
    await expect(goals).toContainText('0/1');
    errors.expectClean();
  });

  test('a slider on a phone screen is dragged with the finger', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch only');
    const sim = await openSimulation(page, demo('led-resistor'));
    const before = await meter(page, 'ID', 'A');
    const slider = sim.locator('.sim-controls input[type="range"]');
    const box = (await slider.boundingBox())!;
    const y = box.y + box.height / 2;
    await page.touchscreen.tap(box.x + box.width * 0.6, y);
    await expect.poll(() => meter(page, 'ID', 'A')).toBeGreaterThan(before);
  });

  test('a push button only conducts while it is held', async ({ page }) => {
    const errors = watchErrors(page);
    const sim = await openSimulation(page, demo('rele-motor'));
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    const hold = sim.locator('.sim-controls').getByRole('button', { name: 'Botão S1' });
    const box = (await hold.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(hold).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => meter(page, 'IM', 'A'), { timeout: 10_000 }).toBeGreaterThan(0.1);
    await page.mouse.up();
    await expect(hold).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => meter(page, 'IM', 'A'), { timeout: 10_000 }).toBeLessThan(0.01);
    errors.expectClean();
  });

  test('part labels sit outside the focusable part, so its name matches the screen', async ({
    page,
  }) => {
    const sim = await openSimulation(page, demo('rele-motor'));
    await expect(sim.locator('.sch-label').first()).toBeAttached();
    // Text inside a control counts for axe's label-content-name-mismatch,
    // which a select control ("R1100 kΩ" vs "Resistência: 100 kΩ") can never pass.
    await expect(sim.locator('.sch-el .sch-label')).toHaveCount(0);
    await expectAccessible(page);
  });
});

test.describe('pin texts', () => {
  test('a changeover switch held by hand keeps NF/NA out of its accessible name', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    const sim = await openSimulation(page, demo('fim-de-curso'));
    const lever = sim.locator('.sim-schematic').getByRole('button', {
      name: 'Chave fim de curso S1',
    });
    // The pin texts are drawn, but not inside the focusable part.
    await expect(sim.locator('.sym-pin-text')).toHaveCount(2);
    await expect(lever.locator('text')).toHaveCount(0);
    await expectAccessible(page);

    // At rest the NF contact feeds the green LED; held, the NA contact the red one.
    await expect.poll(() => meter(page, 'IV', 'A')).toBeGreaterThan(0.005);
    await lever.focus();
    await page.keyboard.down('Space');
    await expect.poll(() => meter(page, 'IR', 'A')).toBeGreaterThan(0.005);
    await expect.poll(() => meter(page, 'IV', 'A')).toBe(0);
    await page.keyboard.up('Space');
    await expect.poll(() => meter(page, 'IR', 'A')).toBe(0);
    errors.expectClean();
  });
});

test.describe('instruments', () => {
  test('the oscilloscope measures the 60 Hz input and the smaller output', async ({ page }) => {
    const errors = watchErrors(page);
    const sim = await openSimulation(page, demo('rc-senoide'));
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    await sim.getByRole('tab', { name: 'Osciloscópio' }).click();
    const scope = sim.getByRole('tabpanel');
    await expect(scope).toContainText(/CH1: Entrada \(fonte\).*10\sV.*60\sHz/, { timeout: 10_000 });
    await expect(scope).toContainText(/CH2: Saída \(capacitor\)/);
    await expect(scope.getByRole('button', { name: 'Autoajuste' })).toBeVisible();

    await sim.getByRole('tab', { name: 'Gráfico' }).click();
    await expect(sim.getByRole('tabpanel').locator('canvas').first()).toBeVisible();

    await sim.getByRole('tab', { name: 'Multímetro' }).click();
    // 5 V peak: 3,54 V RMS.
    await expect.poll(() => meter(page, 'VE', 'V')).toBeCloseTo(3.54, 1);
    errors.expectClean();
  });

  test('the chart tab works in a browser whose language Intl rejects', async ({ page }) => {
    // Chromium started without a locale reports "en-US@posix".
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'language', { value: 'en-US@posix', configurable: true }),
    );
    const errors = watchErrors(page);
    const sim = await openSimulation(page, demo('rc-senoide'));
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    await sim.getByRole('tab', { name: 'Gráfico' }).click();
    await expect(sim.getByRole('tabpanel').locator('canvas').first()).toBeVisible();
    expect(await page.evaluate(() => navigator.language)).toBe('en-US@posix');
    errors.expectClean();
  });

  test('the AC meter reads the current of a 3-pin motor', async ({ page }) => {
    const errors = watchErrors(page);
    const sim = await openSimulation(page, demo('motor-capacitor'));
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    await sim.getByRole('tab', { name: 'Multímetro' }).click();
    // About 0,94 A at full speed; the common carries the same current as the fuse.
    await expect.poll(() => meter(page, 'IF', 'A'), { timeout: 10_000 }).toBeGreaterThan(0.8);
    const motor = await meter(page, 'IM', 'A');
    expect(motor).toBeCloseTo(await meter(page, 'IF', 'A'), 1);
    errors.expectClean();
  });

  test('the Bode plot finds the cut-off frequency', async ({ page }) => {
    const errors = watchErrors(page);
    const sim = await openSimulation(page, demo('filtro-rc-bode'));
    await expect(sim).toContainText(/Frequência de corte \(−3 dB\): 1,59\skHz/);
    errors.expectClean();
  });
});

test.describe('performance', () => {
  test('30 parts animate at 60 frames per second', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop measure');
    const errors = watchErrors(page);
    await openSimulation(page, demo('trinta-elementos'));
    // Intervals between frames for 3 s while the current dots move. The median
    // ignores the odd frame lost to the other tests running at the same time.
    const intervals = await page.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const out: number[] = [];
          let last = 0;
          const tick = (t: number) => {
            if (last) out.push(t - last);
            last = t;
            if (out.length < 180) requestAnimationFrame(tick);
            else resolve(out);
          };
          requestAnimationFrame(tick);
        }),
    );
    const sorted = [...intervals].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    const average = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    test.info().annotations.push({
      type: 'desempenho',
      description: `mediana ${(1000 / median).toFixed(1)} quadros/s, média ${(1000 / average).toFixed(1)}`,
    });
    expect(1000 / median).toBeGreaterThan(55);
    errors.expectClean();
  });
});

test.describe('layout', () => {
  test('the head is drawn and the 3D view sits beside the schematic on a wide screen', async ({
    page,
    isMobile,
  }) => {
    const sim = await openSimulation(page, demo('lampada-3d'));
    const head = sim.locator('.sim-head');
    await expect(head).toBeVisible();
    expect(await head.evaluate((el) => el.getClientRects().length)).toBe(1);
    const columns = await sim
      .locator('.sim-stage')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(isMobile ? 1 : 2);
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  for (const path of [demo('lampada-potenciometro'), demo('rc-senoide'), demo('lampada-3d')]) {
    test(`fits 360 px without sideways scrolling: /${path}`, async ({ page }) => {
      await openSimulation(page, path);
      await expectNoHorizontalOverflow(page);
    });
  }
});
