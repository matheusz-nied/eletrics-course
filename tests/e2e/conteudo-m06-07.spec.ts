import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from './helpers';

const LESSON = 'm06-corrente-alternada/07-monofasico-bifasico-e-trifasico/';

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

test.describe('aula 6.7: sistemas monofásico, bifásico e trifásico', () => {
  test('loads its simulations, widget and 3D view without errors', async ({ page }) => {
    // With software WebGL (CI) each 3D canvas blocks the page while its shaders compile.
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await page.goto(LESSON);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await hydrateAll(page);
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page);
    errors.expectClean();
  });

  test('the phasors put 220 V between two phases and 380 V in a 220/380 V supply', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(LESSON);
    const tri = await widget(page, 'section.trifasico');
    await expect(tri.locator('[data-phase-rms]')).toHaveText('127 V');
    await expect(tri.locator('[data-line-rms]')).toHaveText('220 V');
    await tri.getByRole('slider', { name: /Instante/ }).fill('90');
    await expect(tri.locator('[data-now]')).toHaveText('L1: 180 V · L2: −90 V · L3: −90 V');
    await expect(tri.locator('[data-sum]')).toHaveText('L1 + L2 + L3 = 0 V');
    await tri.locator('label', { hasText: '220/380 V' }).click();
    await expect(tri.getByRole('radio', { name: '220/380 V' })).toBeChecked();
    await expect(tri.locator('[data-phase-rms]')).toHaveText('220 V');
    await expect(tri.locator('[data-line-rms]')).toHaveText('380 V');
    errors.expectClean();
  });

  test('the three-phase supply reads 127 V and 220 V, and the neutral carries the unbalance', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(LESSON);
    const sim = await simulation(page, 'm06/trifasico');
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    await expect(reading(sim, 'V1N')).toContainText(/:\s12[67]\sV/, { timeout: 10_000 });
    await expect(reading(sim, 'V12')).toContainText(/:\s2(19|20)\sV/, { timeout: 10_000 });
    await expect(reading(sim, 'IN')).toContainText('mA', { timeout: 10_000 });
    await sim
      .locator('.sim-controls')
      .getByRole('switch', { name: /Lâmpada da fase L3 ligada/ })
      .click();
    await expect(reading(sim, 'IN')).toContainText(/7[89]\d\smA/, { timeout: 10_000 });
    errors.expectClean();
  });

  test('breaking the neutral of the two-phase house burns the small lamp', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(LESSON);
    const sim = await simulation(page, 'm06/neutro-rompido');
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    await expect(reading(sim, 'VL')).toContainText(/:\s12[67]\sV/, { timeout: 10_000 });
    await sim
      .locator('.sim-controls')
      .getByRole('switch', { name: /Neutro ligado/ })
      .click();
    await expect(reading(sim, 'VL')).toContainText(/:\s2(19|20)\sV/, { timeout: 15_000 });
    await expect(reading(sim, 'VH')).not.toContainText(/:\s\d{2,3}\sV/);
    errors.expectClean();
  });
});
