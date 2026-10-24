import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from './helpers';

const MODULE = 'm11-digital/';

const LESSONS = [
  '01-analogico-e-digital',
  '02-portas-logicas',
  '03-pull-up-pull-down-e-debounce',
  '04-flip-flops-contadores-e-memoria',
  '05-ci-555',
  '06-conversao-ad-da-e-pwm',
];

/** How long an island may take to hydrate on a loaded runner (software WebGL). */
const HYDRATION = { timeout: 20_000 };

/** Scrolls through the page so every island hydrates, and waits for the simulations. */
async function hydrateAll(page: Page) {
  for (const island of await page.locator('astro-island').all()) {
    await island.scrollIntoViewIfNeeded();
    await expect(island).not.toHaveAttribute('ssr', HYDRATION);
  }
  for (const sim of await page.locator('[data-simulation]').all()) {
    await expect(sim).toHaveAttribute('data-ready', '');
  }
}

/** The hydrated island that contains `inner`. */
async function hydrated(page: Page, inner: string): Promise<Locator> {
  const island = page.locator(`astro-island:has(${inner})`).first();
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr', HYDRATION);
  return island.locator(inner).first();
}

/** A simulation, scrolled into view and ready. */
async function simulation(page: Page, id: string): Promise<Locator> {
  const sim = page.locator(`[data-simulation="${id}"]`);
  await sim.scrollIntoViewIfNeeded();
  await expect(sim).toHaveAttribute('data-ready', '', HYDRATION);
  return sim;
}

const reading = (sim: Locator, probe: string) =>
  sim.locator(`.dmm[data-probe="${probe}"] [data-reading]`);

test.describe('módulo 11: eletrônica digital', () => {
  test('the module page lists the six lessons', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(MODULE);
    for (const slug of LESSONS) {
      await expect(page.locator(`a[href$="/${MODULE}${slug}/"]`).first()).toBeVisible();
    }
    errors.expectClean();
  });

  for (const slug of LESSONS) {
    test(`lesson ${slug} loads its simulations and widgets without errors`, async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(`${MODULE}${slug}/`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await hydrateAll(page);
      await expectNoHorizontalOverflow(page);
      await expectAccessible(page);
      errors.expectClean();
    });
  }

  test('the bits of lesson 11.1 add up to a number', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}01-analogico-e-digital/`);
    const widget = await hydrated(page, '.binario');
    await expect(widget.locator('.lw__value')).toHaveText('5');
    await widget.getByLabel('Bit de peso 128').check({ force: true });
    await expect(widget.locator('.lw__value')).toHaveText('133');
    await expect(widget.locator('.lw__formula')).toContainText('128 + 4 + 1 = 133');
    errors.expectClean();
  });

  test('the D flip-flop of lesson 11.4 copies D only when the clock rises', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}04-flip-flops-contadores-e-memoria/`);
    const sim = await simulation(page, 'm11/flip-flop-d');
    const controls = sim.locator('.sim-controls');
    await controls.getByLabel('Dado D').selectOption({ label: '1 (5 V)' });
    await expect(reading(sim, 'VDADO')).toContainText('5 V');
    await expect(reading(sim, 'VQ')).toContainText(': 0 V');
    await controls.getByLabel('Clock').selectOption({ label: '1 (5 V)' });
    await expect(reading(sim, 'VQ')).toContainText(/4,\d+\sV/);
    errors.expectClean();
  });

  test('the 555 calculator of lesson 11.5 gives about 1 Hz and 1,1 s', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}05-ci-555/`);
    const widget = await hydrated(page, '.calc555');
    await expect(widget.locator('.lw__output')).toContainText('0,99 Hz');
    await expect(widget.locator('.lw__output')).toContainText('53 %');
    await widget.getByLabel('Monoestável (temporizador)').check({ force: true });
    await widget.getByLabel('R (do VCC aos pinos 6 e 7)').selectOption('100000');
    await expect(widget.locator('.lw__output')).toContainText('1,1 s');
    errors.expectClean();
  });

  test('the ADC of lesson 11.6 shows the step and warns about too few samples', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}06-conversao-ad-da-e-pwm/`);
    const widget = await hydrated(page, '.adc');
    await expect(widget.locator('.lw__output')).toContainText('625 mV');
    await widget.getByLabel('10 bits').check({ force: true });
    await expect(widget.locator('.lw__output')).toContainText('4,88 mV');
    await expect(widget.locator('.lw__status')).toHaveCount(0);
    await widget.getByLabel('1,5 por segundo').check({ force: true });
    await expect(widget.locator('.lw__status')).toContainText('Poucas amostras');
    errors.expectClean();
  });

  test('the R-2R ladder of lesson 11.6 gives 5 V · code / 16', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}06-conversao-ad-da-e-pwm/`);
    const sim = await simulation(page, 'm11/dac-r2r');
    const controls = sim.locator('.sim-controls');
    await controls.getByLabel('Bit 3 (vale 8)').selectOption({ label: '1 (5 V)' });
    await expect(reading(sim, 'VOUT')).toContainText(/2,50*\sV/);
    await controls.getByLabel('Bit 1 (vale 2)').selectOption({ label: '1 (5 V)' });
    await controls.getByLabel('Bit 0 (vale 1)').selectOption({ label: '1 (5 V)' });
    await expect(reading(sim, 'VOUT')).toContainText(/3,4[34]\d*\sV/);
    errors.expectClean();
  });
});
