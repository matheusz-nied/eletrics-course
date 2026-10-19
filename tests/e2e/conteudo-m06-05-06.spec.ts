import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from './helpers';

const MODULE = 'm06-corrente-alternada/';

const LESSONS = ['05-potencia-e-fator-de-potencia', '06-ressonancia-e-filtros'];

/**
 * How long an island may take to hydrate: with software WebGL (CI), the 3D
 * view of each lesson blocks the page for a few seconds while it starts.
 */
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
  await expect(island).not.toHaveAttribute('ssr', HYDRATION);
  return island.locator(selector);
}

/** The reading of the multimeter on probe `id`. */
function reading(sim: Locator, id: string) {
  return sim.locator(`.dmm[data-probe="${id}"] [data-reading]`);
}

/** The text alternative of the Bode plot of a simulation. */
function bodeText(sim: Locator) {
  return sim.locator('.sim-chart-box .sim-sr');
}

test.describe('módulo 6: potência e filtros', () => {
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

  test('the correction capacitor of lesson 6.5 lowers the mains current', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}05-potencia-e-fator-de-potencia/`);
    const sim = await simulation(page, 'm06/fator-de-potencia-motor');
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    await expect(reading(sim, 'IT')).toContainText('5,59 A', { timeout: 10_000 });
    await expect(reading(sim, 'P')).toContainText('500 W');
    const controls = sim.locator('.sim-controls');
    await controls.getByRole('switch', { name: /Capacitor de correção ligado/ }).click();
    await expect(reading(sim, 'IT')).toContainText('4,46 A', { timeout: 10_000 });
    await controls
      .getByRole('combobox', { name: 'Capacitância de correção', exact: true })
      .selectOption({ label: '80 µF' });
    await expect(reading(sim, 'IT')).toContainText('3,97 A', { timeout: 10_000 });
    await expect(reading(sim, 'IM')).toContainText('5,59 A');
    await expect(reading(sim, 'P')).toContainText('500 W');
    errors.expectClean();
  });

  test('the power triangle of lesson 6.5 reaches 0,92 with 47 µF on the pump', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}05-potencia-e-fator-de-potencia/`);
    const tri = await widget(page, 'section.tri-pot');
    await expect(tri.locator('[data-pf]')).toHaveText('0,71');
    await expect(tri.locator('[data-current]')).toContainText('5,55 A');
    await expect(tri.locator('[data-capacitors]')).toContainText('46,5 µF');
    await expect(tri.locator('[data-capacitors]')).toContainText('81,6 µF');
    await tri.getByRole('slider', { name: /Capacitor em paralelo/ }).fill('47');
    await expect(tri.locator('[data-pf]')).toHaveText('0,92');
    await expect(tri.locator('[data-current]')).toContainText('4,27 A');
    await tri.locator('label', { hasText: 'Chuveiro' }).click();
    await expect(tri.getByRole('radio', { name: 'Chuveiro' })).toBeChecked();
    await expect(tri.locator('[data-capacitors]')).toContainText('não há o que corrigir');
    errors.expectClean();
  });

  test('the RC filter of lesson 6.6 cuts near 59 Hz', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}06-ressonancia-e-filtros/`);
    const sim = await simulation(page, 'm06/filtro-rc-bode');
    await expect(bodeText(sim)).toContainText(/Frequência de corte: 5[89](,\d+)?\sHz/, {
      timeout: 10_000,
    });
    errors.expectClean();
  });

  test('more resistance flattens the RLC of lesson 6.6', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}06-ressonancia-e-filtros/`);
    const sim = await simulation(page, 'm06/rlc-ressonancia');
    await expect(bodeText(sim)).toContainText('Ganho de −31,9 dB em 40 Hz', { timeout: 10_000 });
    await sim
      .locator('.sim-controls')
      .getByRole('combobox', { name: 'Resistor R', exact: true })
      .selectOption({ label: '100 Ω' });
    await expect(bodeText(sim)).toContainText('Ganho de −12,2 dB em 40 Hz', { timeout: 10_000 });
    errors.expectClean();
  });

  test('the crossover of lesson 6.6 cuts the woofer near 2,7 kHz', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}06-ressonancia-e-filtros/`);
    const sim = await simulation(page, 'm06/divisor-frequencias');
    await expect(bodeText(sim)).toContainText(/Frequência de corte: 2,7\d*\skHz/, {
      timeout: 10_000,
    });
    errors.expectClean();
  });
});
