import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from './helpers';

const MODULE = 'm07-instalacoes/';

const LESSONS = ['07-iluminacao', '08-chuveiro-eletrico'];

/** Scrolls through the page so every island hydrates, and waits for the simulations. */
async function hydrateAll(page: Page) {
  for (const island of await page.locator('astro-island').all()) {
    await island.scrollIntoViewIfNeeded();
    await expect(island).not.toHaveAttribute('ssr');
  }
  for (const sim of await page.locator('[data-simulation]').all()) {
    await expect(sim).toHaveAttribute('data-ready', '');
  }
}

/** The simulation `id`, scrolled into view and ready. */
async function simulation(page: Page, id: string) {
  const sim = page.locator(`[data-simulation="${id}"]`);
  await sim.scrollIntoViewIfNeeded();
  await expect(sim).toHaveAttribute('data-ready', '');
  return sim;
}

/** The hydrated lesson widget whose root has `selector`. */
async function widget(page: Page, selector: string) {
  const island = page.locator(`astro-island:has(${selector})`).first();
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr');
  return island.locator(selector);
}

/** The reading of the multimeter on probe `id`. */
function reading(sim: Locator, id: string) {
  return sim.locator(`.dmm[data-probe="${id}"] [data-reading]`);
}

test.describe('módulo 7: iluminação e chuveiro', () => {
  for (const slug of LESSONS) {
    test(`lesson ${slug} loads its simulations and widgets without errors`, async ({ page }) => {
      // With software WebGL (CI) each 3D canvas blocks the page while its shaders compile.
      test.setTimeout(90_000);
      const errors = watchErrors(page);
      await page.goto(`${MODULE}${slug}/`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await hydrateAll(page);
      await expectNoHorizontalOverflow(page);
      await expectAccessible(page);
      errors.expectClean();
    });
  }

  test('the presence sensor of lesson 7.7 keeps the light on TIME after the last movement', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}07-iluminacao/`);
    const sensor = await widget(page, 'section.sensor-presenca');
    await sensor.getByRole('combobox', { name: /Velocidade/ }).selectOption({ index: 1 });
    await sensor.getByRole('combobox', { name: /TIME/ }).selectOption('10');
    await expect(sensor).toHaveAttribute('data-lamp', 'off');
    await sensor.getByRole('button', { name: 'Atravessar o corredor' }).click();
    await expect(sensor).toHaveAttribute('data-lamp', 'on');
    await expect(sensor.locator('[data-status]')).toContainText('acendeu');
    // 6 s walking plus 10 s of TIME, at 5 times the real speed: about 3 s.
    await expect(sensor).toHaveAttribute('data-lamp', 'off', { timeout: 10_000 });

    // In daylight, above the LUX setting, the sensor sees the person and does nothing.
    await sensor.getByRole('combobox', { name: /Luz do ambiente/ }).selectOption('dia');
    await sensor.getByRole('button', { name: 'Atravessar o corredor' }).click();
    await expect(sensor.locator('[data-status]')).toContainText('mais claro que o ajuste LUX');
    await expect(sensor).toHaveAttribute('data-lamp', 'off');
    errors.expectClean();
  });

  test('the photoelectric switch of lesson 7.7 turns the lamp on at dusk', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}07-iluminacao/`);
    const sim = await simulation(page, 'm07/rele-fotoeletrico');
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    // The control side runs on DC: the meter goes to V⎓ CC, as the lesson asks.
    await sim.locator('.dmm[data-probe="VS"]').getByRole('radio', { name: /CC/ }).click();
    await sim
      .locator('.sim-controls')
      .getByRole('combobox', { name: 'Luz sobre o sensor' })
      .selectOption({ label: 'Pôr do sol (20 lx)' });
    await expect(reading(sim, 'VS')).toContainText('7,43 V', { timeout: 10_000 });
    await sim
      .locator('.sim-controls')
      .getByRole('combobox', { name: 'Luz sobre o sensor' })
      .selectOption({ label: 'Anoitecer (3 lx)' });
    await expect(reading(sim, 'VS')).toContainText('3,61 V', { timeout: 10_000 });
    errors.expectClean();
  });

  test('the shower of lesson 7.8 draws 17 A in summer and 34 A in winter', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}08-chuveiro-eletrico/`);
    const sim = await simulation(page, 'm07/chuveiro');
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    const controls = sim.locator('.sim-controls');
    await controls.getByRole('switch', { name: /Água aberta/ }).click();
    await expect(reading(sim, 'I')).toContainText(/:\s17\sA/, { timeout: 10_000 });
    await controls.getByRole('switch', { name: /Posição inverno/ }).click();
    await expect(reading(sim, 'I')).toContainText(/34,1\sA/, { timeout: 10_000 });
    errors.expectClean();
  });
});
