import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from './helpers';

const MODULE = 'm06-corrente-alternada/';

const LESSONS = ['01-da-cc-a-ca', '02-pico-eficaz-e-medio'];

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

test.describe('módulo 6: corrente alternada (aulas 6.1 e 6.2)', () => {
  test('the module page lists the lessons', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(MODULE);
    for (const slug of LESSONS) {
      await expect(page.locator(`a[href$="/${MODULE}${slug}/"]`).first()).toBeVisible();
    }
    errors.expectClean();
  });

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

  test('the generator of lesson 6.1 gives 20 ms and 2,5 cycles at 50 turns per second', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}01-da-cc-a-ca/`);
    const gerador = await widget(page, 'section.gerador');
    await expect(gerador.locator('[data-period]')).toContainText('16,7 ms');
    await expect(gerador.locator('[data-cycles]')).toHaveText('3');
    await gerador.getByRole('slider', { name: /Velocidade/ }).fill('50');
    await expect(gerador.locator('[data-frequency]')).toContainText('50 Hz');
    await expect(gerador.locator('[data-period]')).toContainText('20 ms');
    await expect(gerador.locator('[data-cycles]')).toHaveText('2,5');
    await gerador.getByRole('button', { name: 'Girar' }).click();
    await expect(gerador.getByRole('button', { name: 'Parar' })).toBeVisible();
    errors.expectClean();
  });

  test('the lamp of lesson 6.1 takes the same 0,42 A on the battery and on the generator', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}01-da-cc-a-ca/`);
    const sim = await simulation(page, 'm06/cc-ca-lampada');
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    await sim.getByRole('tab', { name: 'Multímetro' }).click();
    await expect(reading(sim, 'IL')).toContainText(/41[67]\smA/, { timeout: 10_000 });
    await sim
      .locator('.sim-controls')
      .getByRole('combobox', { name: 'A lâmpada está ligada', exact: true })
      .selectOption({ label: 'Na bateria (CC)' });
    // On the battery the meter goes to DC (A⎓): in AC it would read zero.
    await sim
      .getByRole('radiogroup', { name: 'Modo do multímetro: Corrente na lâmpada' })
      .getByRole('radio', { name: 'A⎓ CC' })
      .click();
    await expect(reading(sim, 'IL')).toContainText(/41[67]\smA/, { timeout: 10_000 });
    errors.expectClean();
  });

  test('the lamps of lesson 6.2 read 127 V and 89,8 V on the meter', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}02-pico-eficaz-e-medio/`);
    const sim = await simulation(page, 'm06/eficaz-lampadas');
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    await expect(reading(sim, 'V2')).toContainText('127 V', { timeout: 10_000 });
    await expect(reading(sim, 'V3')).toContainText('89,8 V', { timeout: 10_000 });
    errors.expectClean();
  });

  test('the common meter of lesson 6.2 reads 99,7 V on the semi-sine wave', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}02-pico-eficaz-e-medio/`);
    const formas = await widget(page, 'section.formas');
    await expect(formas.locator('[data-meter]')).toHaveText('127 V');
    await formas.locator('label', { hasText: 'Semi-senoidal' }).click();
    await expect(formas.locator('[data-rms]')).toHaveText('127 V');
    await expect(formas.locator('[data-meter]')).toHaveText('99,7 V');
    await formas.locator('label', { hasText: 'Dimmer' }).click();
    await expect(formas.locator('[data-rms]')).toHaveText('89,8 V');
    await expect(formas.locator('[data-meter]')).toHaveText('63,5 V');
    errors.expectClean();
  });
});
