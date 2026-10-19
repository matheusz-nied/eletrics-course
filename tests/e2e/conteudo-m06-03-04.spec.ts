import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from './helpers';

const MODULE = 'm06-corrente-alternada/';

const LESSONS = ['03-fase-e-fasores', '04-reatancia-e-impedancia'];

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

test.describe('módulo 6: fase, fasores, reatância e impedância', () => {
  for (const slug of LESSONS) {
    test(`lesson ${slug} loads its simulations and widgets without errors`, async ({ page }) => {
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

  test('the phasors of lesson 6.3 add to 141 % at 90° and to zero in opposition', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}03-fase-e-fasores/`);
    const fasores = await widget(page, 'section.fasores');
    await fasores.getByRole('button', { name: 'Adiantada 90° (capacitor)' }).click();
    await expect(fasores.locator('[data-shift]')).toContainText('90° adiantada');
    await expect(fasores.locator('[data-sum]')).toContainText('141');
    await fasores.getByRole('button', { name: 'Oposição (180°)' }).click();
    await expect(fasores.locator('[data-sum]')).toHaveText(/^0\s%$/);
    await fasores.getByRole('button', { name: /Girar/ }).click();
    await expect(fasores.getByRole('button', { name: 'Pausar' })).toBeVisible();
    errors.expectClean();
  });

  test('the resistor and the coil of lesson 6.3 draw 102 mA together, not 141 mA', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}03-fase-e-fasores/`);
    const sim = await simulation(page, 'm06/fase-ramos');
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    await expect(reading(sim, 'IT')).toContainText('70,7 mA', { timeout: 15_000 });
    await sim
      .locator('.sim-controls')
      .getByRole('switch', { name: /Ramo da bobina/ })
      .click();
    await expect(reading(sim, 'IT')).toContainText('102 mA', { timeout: 15_000 });
    errors.expectClean();
  });

  test('the capacitor current of lesson 6.4 grows ten times from 60 Hz to 600 Hz', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}04-reatancia-e-impedancia/`);
    const sim = await simulation(page, 'm06/reatancia-frequencia');
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    await expect(reading(sim, 'IC')).toContainText('26,7 mA', { timeout: 15_000 });
    await expect(reading(sim, 'IR')).toContainText('70,7 mA');
    // The slider runs 50 → 1.000 Hz over 0 → 1.000 steps: 600 Hz is step 579.
    await sim
      .locator('.sim-controls')
      .getByRole('slider', { name: 'Frequência do gerador' })
      .fill('579');
    await expect(reading(sim, 'IC')).toContainText('267 mA', { timeout: 15_000 });
    await expect(reading(sim, 'IL')).toContainText('18,7 mA', { timeout: 15_000 });
    errors.expectClean();
  });
});
